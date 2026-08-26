package db

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	driver "github.com/arangodb/go-driver"
)

type AlbumView struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	CreatedAt    time.Time `json:"created_at"`
	PhotoCount   int       `json:"photo_count"`
	CoverPhotoID string    `json:"cover_photo_id,omitempty"`
	PhotoIDs     []string  `json:"photo_ids"`
}

type AlbumDetail struct {
	AlbumView
	Photos []Photo `json:"photos"`
}

func newDocumentKey() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func (c *Client) CreateAlbum(ctx context.Context, ownerID, name string) (*AlbumView, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("album name is required")
	}
	col, err := c.db.Collection(ctx, ColAlbums)
	if err != nil {
		return nil, err
	}
	a := Album{
		Key:        newDocumentKey(),
		Name:       name,
		OwnerID:    ownerID,
		Visibility: "private",
		CreatedAt:  time.Now().UTC(),
	}
	if _, err := col.CreateDocument(ctx, a); err != nil {
		return nil, err
	}
	return &AlbumView{ID: a.Key, Name: a.Name, CreatedAt: a.CreatedAt, PhotoIDs: []string{}}, nil
}

func (c *Client) ListAlbums(ctx context.Context, ownerID string) ([]AlbumView, error) {
	q := `
		FOR a IN albums
		  FILTER a.owner_id == @uid
		  SORT a.created_at DESC
		  LET pics = (
		    FOR e IN in_album
		      FILTER e._to == a._id
		      RETURN PARSE_IDENTIFIER(e._from).key
		  )
		  RETURN {
		    id: a._key,
		    name: a.name,
		    created_at: a.created_at,
		    photo_count: LENGTH(pics),
		    cover_photo_id: pics[0],
		    photo_ids: pics
		  }`
	cur, err := c.db.Query(ctx, q, map[string]interface{}{"uid": ownerID})
	if err != nil {
		return nil, err
	}
	defer cur.Close()
	out := []AlbumView{}
	for cur.HasMore() {
		var v AlbumView
		if _, err := cur.ReadDocument(ctx, &v); err != nil {
			return nil, err
		}
		if v.PhotoIDs == nil {
			v.PhotoIDs = []string{}
		}
		out = append(out, v)
	}
	return out, nil
}

func (c *Client) GetAlbum(ctx context.Context, albumID string) (*Album, error) {
	col, err := c.db.Collection(ctx, ColAlbums)
	if err != nil {
		return nil, err
	}
	var a Album
	if _, err := col.ReadDocument(ctx, albumID, &a); err != nil {
		if driver.IsNotFound(err) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}

func (c *Client) albumPhotos(ctx context.Context, albumID string) ([]Photo, []string, error) {
	q := `
		FOR e IN in_album
		  FILTER e._to == @to
		  FOR p IN photos
		    FILTER p._id == e._from AND p.deleted_at == null
		    SORT p.taken_at DESC, p._key DESC
		    RETURN p`
	cur, err := c.db.Query(ctx, q, map[string]interface{}{"to": ColAlbums + "/" + albumID})
	if err != nil {
		return nil, nil, err
	}
	defer cur.Close()
	photos := []Photo{}
	ids := []string{}
	for cur.HasMore() {
		var p Photo
		if _, err := cur.ReadDocument(ctx, &p); err != nil {
			return nil, nil, err
		}
		photos = append(photos, p)
		ids = append(ids, p.Key)
	}
	return photos, ids, nil
}

func (c *Client) GetAlbumView(ctx context.Context, ownerID, albumID string) (*AlbumDetail, error) {
	album, err := c.GetAlbum(ctx, albumID)
	if err != nil {
		return nil, err
	}
	if album.OwnerID != ownerID {
		return nil, ErrForbidden
	}
	photos, ids, err := c.albumPhotos(ctx, albumID)
	if err != nil {
		return nil, err
	}
	cover := ""
	if len(ids) > 0 {
		cover = ids[0]
	}
	return &AlbumDetail{
		AlbumView: AlbumView{
			ID:           album.Key,
			Name:         album.Name,
			CreatedAt:    album.CreatedAt,
			PhotoCount:   len(ids),
			CoverPhotoID: cover,
			PhotoIDs:     ids,
		},
		Photos: photos,
	}, nil
}

func (c *Client) albumViewForOwner(ctx context.Context, ownerID, albumID string) (*AlbumView, error) {
	views, err := c.ListAlbums(ctx, ownerID)
	if err != nil {
		return nil, err
	}
	for i := range views {
		if views[i].ID == albumID {
			return &views[i], nil
		}
	}
	return nil, ErrNotFound
}

func (c *Client) AddPhotoToAlbum(ctx context.Context, ownerID, albumID, photoID string) (*AlbumView, error) {
	album, err := c.GetAlbum(ctx, albumID)
	if err != nil {
		return nil, err
	}
	if album.OwnerID != ownerID {
		return nil, ErrForbidden
	}
	photo, err := c.GetPhoto(ctx, photoID)
	if err != nil {
		return nil, err
	}
	if photo.OwnerID != ownerID {
		return nil, ErrForbidden
	}
	if photo.DeletedAt != nil {
		return nil, ErrNotFound
	}
	from := ColPhotos + "/" + photoID
	to := ColAlbums + "/" + albumID
	exists, err := c.inAlbumExists(ctx, from, to)
	if err != nil {
		return nil, err
	}
	if !exists {
		col, err := c.db.Collection(ctx, ColInAlbum)
		if err != nil {
			return nil, err
		}
		if _, err := col.CreateDocument(ctx, map[string]interface{}{"_from": from, "_to": to}); err != nil {
			return nil, err
		}
	}
	return c.albumViewForOwner(ctx, ownerID, albumID)
}

func (c *Client) RemovePhotoFromAlbum(ctx context.Context, ownerID, albumID, photoID string) (*AlbumView, error) {
	album, err := c.GetAlbum(ctx, albumID)
	if err != nil {
		return nil, err
	}
	if album.OwnerID != ownerID {
		return nil, ErrForbidden
	}
	from := ColPhotos + "/" + photoID
	to := ColAlbums + "/" + albumID
	q := `
		FOR e IN in_album
		  FILTER e._from == @from AND e._to == @to
		  REMOVE e IN in_album`
	cur, err := c.db.Query(ctx, q, map[string]interface{}{"from": from, "to": to})
	if err != nil {
		return nil, err
	}
	cur.Close()
	return c.albumViewForOwner(ctx, ownerID, albumID)
}

func (c *Client) inAlbumExists(ctx context.Context, from, to string) (bool, error) {
	q := `
		FOR e IN in_album
		  FILTER e._from == @from AND e._to == @to
		  LIMIT 1
		  RETURN 1`
	cur, err := c.db.Query(ctx, q, map[string]interface{}{"from": from, "to": to})
	if err != nil {
		return false, err
	}
	defer cur.Close()
	return cur.HasMore(), nil
}

func (c *Client) ClearOwnerAlbumsAndFavorites(ctx context.Context, ownerID string) error {
	q := `
		FOR a IN albums
		  FILTER a.owner_id == @uid
		  FOR e IN in_album
		    FILTER e._to == a._id
		    REMOVE e IN in_album`
	cur, err := c.db.Query(ctx, q, map[string]interface{}{"uid": ownerID})
	if err != nil {
		return err
	}
	cur.Close()
	q = `
		FOR a IN albums
		  FILTER a.owner_id == @uid
		  REMOVE a IN albums`
	cur, err = c.db.Query(ctx, q, map[string]interface{}{"uid": ownerID})
	if err != nil {
		return err
	}
	cur.Close()
	q = `
		FOR p IN photos
		  FILTER p.owner_id == @uid
		  UPDATE p WITH { favorite: false } IN photos`
	cur, err = c.db.Query(ctx, q, map[string]interface{}{"uid": ownerID})
	if err != nil {
		return err
	}
	cur.Close()
	return nil
}
