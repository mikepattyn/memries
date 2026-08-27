package storage

import (
	"context"
	"io"
	"time"
)

type ObjectInfo struct {
	Key       string
	Size      int64
	ModTime   time.Time
	CreatedAt time.Time
}

type Storage interface {
	Backend() string
	Put(ctx context.Context, key string, r io.Reader) error
	Get(ctx context.Context, key string) (io.ReadCloser, error)
	Stat(ctx context.Context, key string) (ObjectInfo, error)
	URL(ctx context.Context, key string, ttl time.Duration) (string, error)
	Delete(ctx context.Context, key string) error
	Walk(ctx context.Context, prefix string, fn func(ObjectInfo) error) error
}
