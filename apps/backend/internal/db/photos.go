package db

import (
	"context"
	"errors"
	"strings"
	"time"

	driver "github.com/arangodb/go-driver"
)

var ErrNotFound = errors.New("not found")
var ErrForbidden = errors.New("forbidden")

func (c *Client) UpsertPhoto(ctx context.Context, p *Photo) error {
	col, err := c.db.Collection(ctx, ColPhotos)
	if err != nil {
		return err
	}
	_, err = col.CreateDocument(ctx, p)
	if err == nil {
		return nil
	}
	if driver.IsConflict(err) {
		_, err = col.UpdateDocument(ctx, p.Key, p)
		return err
	}
	return err
}

func (c *Client) GetPhoto(ctx context.Context, key string) (*Photo, error) {
	col, err := c.db.Collection(ctx, ColPhotos)
	if err != nil {
		return nil, err
	}
	var p Photo
	if _, err := col.ReadDocument(ctx, key, &p); err != nil {
		if driver.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &p, nil
}

type Bucket struct {
	Bucket       string    `json:"bucket"`
	Count        int       `json:"count"`
	CoverPhotoID string    `json:"cover_photo_id"`
	First        time.Time `json:"first"`
	Last         time.Time `json:"last"`
}

func (c *Client) Timeline(ctx context.Context, ownerID, granularity string, from, to time.Time) ([]Bucket, error) {
	pattern := granularityToPattern(granularity)
	q := `
		FOR p IN photos
		  FILTER p.taken_at >= @from AND p.taken_at < @to
		  FILTER p.deleted_at == null
		  FILTER p.owner_id == @uid
		  LET bucket = ` + bucketExpr(granularity, "p.taken_at", pattern) + `
		  COLLECT b = bucket INTO g KEEP p
		  SORT b DESC
		  RETURN {
		    bucket: b,
		    count: LENGTH(g),
		    cover_photo_id: g[0].p._key,
		    first: MIN(g[*].p.taken_at),
		    last:  MAX(g[*].p.taken_at)
		  }`
	cur, err := c.db.Query(ctx, q, map[string]interface{}{
		"from": from,
		"to":   to,
		"uid":  ownerID,
	})
	if err != nil {
		return nil, err
	}
	defer cur.Close()
	var out []Bucket
	for cur.HasMore() {
		var b Bucket
		if _, err := cur.ReadDocument(ctx, &b); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, nil
}

type PhotoFilter struct {
	Years     []string
	Months    []string
	Favorite  *bool
	Query     string
	LocalFrom string
	LocalTo   string
}

func (c *Client) Photos(ctx context.Context, ownerID string, from, to time.Time, limit int, cursor string) ([]Photo, string, error) {
	return c.PhotosFiltered(ctx, ownerID, from, to, limit, cursor, PhotoFilter{})
}

func (c *Client) PhotosFiltered(ctx context.Context, ownerID string, from, to time.Time, limit int, cursor string, filter PhotoFilter) ([]Photo, string, error) {
	limit = ClampPhotoLimit(limit)
	bind := map[string]interface{}{
		"from":  from,
		"to":    to,
		"uid":   ownerID,
		"limit": limit + 1,
	}
	cursorFilter := ""
	if cursor != "" {
		taken, key, err := DecodeCursor(cursor)
		if err != nil {
			return nil, "", err
		}
		bind["cursorTaken"] = taken
		bind["cursorKey"] = key
		cursorFilter = `FILTER p.taken_at < @cursorTaken OR (p.taken_at == @cursorTaken AND p._key < @cursorKey)`
	}
	extra := photoFilterAQL(filter, bind)
	q := `
		FOR p IN photos
		  FILTER p.taken_at >= @from AND p.taken_at < @to
		  FILTER p.deleted_at == null
		  FILTER p.owner_id == @uid
		  ` + extra + `
		  ` + cursorFilter + `
		  SORT p.taken_at DESC, p._key DESC
		  LIMIT @limit
		  RETURN p`
	cur, err := c.db.Query(ctx, q, bind)
	if err != nil {
		return nil, "", err
	}
	defer cur.Close()
	var out []Photo
	for cur.HasMore() {
		var p Photo
		if _, err := cur.ReadDocument(ctx, &p); err != nil {
			return nil, "", err
		}
		out = append(out, p)
	}
	page, next := ClipPage(out, limit)
	return page, next, nil
}

func (c *Client) CountOwnerPhotos(ctx context.Context, ownerID string) (int64, error) {
	q := `
		FOR p IN photos
		  FILTER p.owner_id == @uid
		  FILTER p.deleted_at == null
		  COLLECT WITH COUNT INTO n
		  RETURN n`
	cur, err := c.db.Query(ctx, q, map[string]interface{}{"uid": ownerID})
	if err != nil {
		return 0, err
	}
	defer cur.Close()
	if !cur.HasMore() {
		return 0, nil
	}
	var n int64
	if _, err := cur.ReadDocument(ctx, &n); err != nil {
		return 0, err
	}
	return n, nil
}

type PhotoStorageRef struct {
	Key  string `json:"_key"`
	Path string `json:"path"`
}

func (c *Client) ListOwnerPhotoStorage(ctx context.Context, ownerID string) ([]PhotoStorageRef, error) {
	q := `
		FOR p IN photos
		  FILTER p.owner_id == @uid
		  FILTER p.deleted_at == null
		  RETURN { _key: p._key, path: p.storage.path }`
	cur, err := c.db.Query(ctx, q, map[string]interface{}{"uid": ownerID})
	if err != nil {
		return nil, err
	}
	defer cur.Close()
	var out []PhotoStorageRef
	for cur.HasMore() {
		var ref PhotoStorageRef
		if _, err := cur.ReadDocument(ctx, &ref); err != nil {
			return nil, err
		}
		out = append(out, ref)
	}
	return out, nil
}

func (c *Client) SoftDeletePhoto(ctx context.Context, key string) error {
	col, err := c.db.Collection(ctx, ColPhotos)
	if err != nil {
		return err
	}
	now := time.Now().UTC()
	_, err = col.UpdateDocument(ctx, key, map[string]interface{}{"deleted_at": now})
	return err
}

func granularityToPattern(g string) string {
	switch g {
	case "year":
		return "%yyyy"
	case "month":
		return "%yyyy-%mm"
	case "day":
		return "%yyyy-%mm-%dd"
	default:
		return "%yyyy-%mm"
	}
}

// bucketExpr returns AQL expression producing the bucket string.
// Week granularity uses ISO year+week. ArangoDB lacks DATE_ISOWEEK_YEAR, so the ISO
// year is derived from the Thursday of the ISO week (calendar year of Thursday == ISO year).
func bucketExpr(g, field, pattern string) string {
	if g == "week" {
		// ISO day-of-week 1..7 (Mon..Sun) derived from DATE_DAYOFWEEK (Sun=0..Sat=6).
		isoDow := `(((DATE_DAYOFWEEK(` + field + `) + 6) % 7) + 1)`
		thursday := `DATE_ADD(` + field + `, 4 - ` + isoDow + `, "day")`
		return `CONCAT(DATE_YEAR(` + thursday + `), "-W", RIGHT(CONCAT("00", TO_STRING(DATE_ISOWEEK(` + field + `))), 2))`
	}
	return `DATE_FORMAT(` + field + `, "` + pattern + `")`
}

func photoFilterAQL(filter PhotoFilter, bind map[string]interface{}) string {
	var parts []string
	if len(filter.Years) > 0 {
		bind["years"] = filter.Years
		parts = append(parts, `FILTER SUBSTRING(p.taken_at_local, 0, 4) IN @years`)
	}
	if len(filter.Months) > 0 {
		bind["months"] = filter.Months
		parts = append(parts, `FILTER SUBSTRING(p.taken_at_local, 5, 2) IN @months`)
	}
	if filter.LocalFrom != "" {
		bind["localFrom"] = filter.LocalFrom
		parts = append(parts, `FILTER SUBSTRING(p.taken_at_local, 0, 10) >= @localFrom`)
	}
	if filter.LocalTo != "" {
		bind["localTo"] = filter.LocalTo
		parts = append(parts, `FILTER SUBSTRING(p.taken_at_local, 0, 10) < @localTo`)
	}
	if filter.Favorite != nil {
		bind["favorite"] = *filter.Favorite
		parts = append(parts, `FILTER p.favorite == @favorite`)
	}
	if q := strings.ToLower(strings.TrimSpace(filter.Query)); q != "" {
		bind["q"] = q
		parts = append(parts, `FILTER CONTAINS(LOWER(p.taken_at_local), @q)`)
	}
	return strings.Join(parts, "\n		  ")
}

func (c *Client) GetPhotoByHash(ctx context.Context, hash string) (*Photo, error) {
	q := `
		FOR p IN photos
		  FILTER p.hash == @hash
		  SORT p.deleted_at == null DESC
		  LIMIT 1
		  RETURN p`
	return c.readPhotoQuery(ctx, q, map[string]interface{}{"hash": hash})
}

func (c *Client) GetPhotoByOwnerPath(ctx context.Context, ownerID, path string) (*Photo, error) {
	q := `
		FOR p IN photos
		  FILTER p.owner_id == @uid
		  FILTER p.storage.path == @path
		  SORT p.deleted_at == null DESC
		  LIMIT 1
		  RETURN p`
	return c.readPhotoQuery(ctx, q, map[string]interface{}{"uid": ownerID, "path": path})
}

func (c *Client) readPhotoQuery(ctx context.Context, q string, bind map[string]interface{}) (*Photo, error) {
	cur, err := c.db.Query(ctx, q, bind)
	if err != nil {
		return nil, err
	}
	defer cur.Close()
	if !cur.HasMore() {
		return nil, ErrNotFound
	}
	var p Photo
	if _, err := cur.ReadDocument(ctx, &p); err != nil {
		return nil, err
	}
	return &p, nil
}

func (c *Client) UpdateIndexedPhoto(ctx context.Context, p *Photo) error {
	col, err := c.db.Collection(ctx, ColPhotos)
	if err != nil {
		return err
	}
	patch := map[string]interface{}{
		"taken_at":        p.TakenAt,
		"taken_at_local":  p.TakenAtLocal,
		"taken_at_source": p.TakenAtSource,
		"tz_offset":       p.TZOffset,
		"storage":         p.Storage,
		"hash":            p.Hash,
		"size_bytes":      p.SizeBytes,
		"mime":            p.MIME,
		"dims":            p.Dims,
		"orientation":     p.Orientation,
		"exif":            p.EXIF,
		"thumbs":          p.Thumbs,
		"deleted_at":      nil,
	}
	_, err = col.UpdateDocument(ctx, p.Key, patch)
	return err
}

func (c *Client) SetFavorite(ctx context.Context, ownerID, photoID string, favorite bool) (*Photo, error) {
	p, err := c.GetPhoto(ctx, photoID)
	if err != nil {
		return nil, err
	}
	if p.OwnerID != ownerID {
		return nil, ErrForbidden
	}
	col, err := c.db.Collection(ctx, ColPhotos)
	if err != nil {
		return nil, err
	}
	if _, err := col.UpdateDocument(ctx, photoID, map[string]interface{}{"favorite": favorite}); err != nil {
		return nil, err
	}
	p.Favorite = favorite
	return p, nil
}
