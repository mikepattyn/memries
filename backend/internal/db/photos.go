package db

import (
	"context"
	"errors"
	"time"

	driver "github.com/arangodb/go-driver"
)

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
			return nil, errors.New("not found")
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

func (c *Client) Photos(ctx context.Context, ownerID string, from, to time.Time, limit int, cursor string) ([]Photo, string, error) {
	if limit <= 0 || limit > 500 {
		limit = 200
	}
	bind := map[string]interface{}{
		"from":  from,
		"to":    to,
		"uid":   ownerID,
		"limit": limit,
	}
	cursorFilter := ""
	if cursor != "" {
		bind["cursor"] = cursor
		cursorFilter = `FILTER p.taken_at < @cursor`
	}
	q := `
		FOR p IN photos
		  FILTER p.taken_at >= @from AND p.taken_at < @to
		  FILTER p.deleted_at == null
		  FILTER p.owner_id == @uid
		  ` + cursorFilter + `
		  SORT p.taken_at DESC
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
	next := ""
	if len(out) == limit {
		next = out[len(out)-1].TakenAt.Format(time.RFC3339Nano)
	}
	return out, next, nil
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
