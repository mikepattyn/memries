package index

import (
	"context"

	"github.com/memries/memries/internal/db"
	"github.com/memries/memries/internal/storage"
)

func (i *Indexer) pruneMissingOriginals(ctx context.Context, ownerID string) error {
	refs, err := i.DB.ListOwnerPhotoStorage(ctx, ownerID)
	if err != nil {
		return err
	}
	for _, ref := range refs {
		if ref.Path == "" {
			continue
		}
		if _, err := i.Store.Stat(ctx, ref.Path); err == nil {
			continue
		} else if !storage.IsNotFound(err) {
			i.Log.Warn("stat original", "key", ref.Key, "path", ref.Path, "err", err)
			continue
		}
		if err := i.DB.SoftDeletePhoto(ctx, ref.Key); err != nil {
			return err
		}
		i.Log.Info("prune missing original", "key", ref.Key, "path", ref.Path)
	}
	return nil
}

func (i *Indexer) touchRelocatedPath(ctx context.Context, existing *db.Photo, key, hash string) error {
	ptr, moved := relocatedStorage(existing.Storage, key, i.Store.Backend())
	if !moved && existing.DeletedAt == nil {
		return nil
	}
	existing.Storage = ptr
	existing.DeletedAt = nil
	if err := i.DB.UpsertPhoto(ctx, existing); err != nil {
		return err
	}
	if moved {
		i.Log.Info("update relocated path", "key", key, "hash", hash[:12])
	}
	return nil
}
