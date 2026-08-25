package db

import (
	"context"
	"fmt"

	driver "github.com/arangodb/go-driver"
	"github.com/arangodb/go-driver/http"

	"github.com/memries/memries/internal/config"
)

const (
	ColPhotos      = "photos"
	ColUsers       = "users"
	ColAlbums      = "albums"
	ColOwns        = "owns"
	ColSharedWith  = "shared_with"
	ColInAlbum     = "in_album"
	ColAlbumShared = "album_shared"
)

type Client struct {
	driver driver.Client
	db     driver.Database
}

func Connect(ctx context.Context, cfg *config.Config) (*Client, error) {
	conn, err := http.NewConnection(http.ConnectionConfig{Endpoints: []string{cfg.ArangoURL}})
	if err != nil {
		return nil, fmt.Errorf("arango conn: %w", err)
	}
	c, err := driver.NewClient(driver.ClientConfig{
		Connection:     conn,
		Authentication: driver.BasicAuthentication(cfg.ArangoUser, cfg.ArangoPassword),
	})
	if err != nil {
		return nil, fmt.Errorf("arango client: %w", err)
	}
	exists, err := c.DatabaseExists(ctx, cfg.ArangoDB)
	if err != nil {
		return nil, err
	}
	var d driver.Database
	if !exists {
		d, err = c.CreateDatabase(ctx, cfg.ArangoDB, nil)
	} else {
		d, err = c.Database(ctx, cfg.ArangoDB)
	}
	if err != nil {
		return nil, err
	}
	cli := &Client{driver: c, db: d}
	if err := cli.ensureSchema(ctx); err != nil {
		return nil, err
	}
	return cli, nil
}

func (c *Client) DB() driver.Database { return c.db }

func (c *Client) ensureSchema(ctx context.Context) error {
	docCols := []string{ColPhotos, ColUsers, ColAlbums}
	for _, name := range docCols {
		if err := ensureCollection(ctx, c.db, name, false); err != nil {
			return err
		}
	}
	edgeCols := []string{ColOwns, ColSharedWith, ColInAlbum, ColAlbumShared}
	for _, name := range edgeCols {
		if err := ensureCollection(ctx, c.db, name, true); err != nil {
			return err
		}
	}
	photos, _ := c.db.Collection(ctx, ColPhotos)
	if _, _, err := photos.EnsurePersistentIndex(ctx, []string{"taken_at"}, &driver.EnsurePersistentIndexOptions{Name: "idx_taken_at"}); err != nil {
		return err
	}
	if _, _, err := photos.EnsurePersistentIndex(ctx, []string{"owner_id", "taken_at"}, &driver.EnsurePersistentIndexOptions{Name: "idx_owner_taken_at"}); err != nil {
		return err
	}
	if _, _, err := photos.EnsurePersistentIndex(ctx, []string{"hash"}, &driver.EnsurePersistentIndexOptions{Unique: true, Name: "idx_hash"}); err != nil {
		return err
	}
	users, _ := c.db.Collection(ctx, ColUsers)
	if _, _, err := users.EnsurePersistentIndex(ctx, []string{"email"}, &driver.EnsurePersistentIndexOptions{Unique: true, Name: "idx_email"}); err != nil {
		return err
	}
	return nil
}

func ensureCollection(ctx context.Context, d driver.Database, name string, edge bool) error {
	ok, err := d.CollectionExists(ctx, name)
	if err != nil {
		return err
	}
	if ok {
		return nil
	}
	opts := &driver.CreateCollectionOptions{}
	if edge {
		opts.Type = driver.CollectionTypeEdge
	}
	_, err = d.CreateCollection(ctx, name, opts)
	return err
}
