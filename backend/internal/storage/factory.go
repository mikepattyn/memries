package storage

import (
	"fmt"

	"github.com/memries/memries/internal/config"
)

func New(cfg *config.Config) (Storage, error) {
	switch cfg.StorageBackend {
	case "local":
		return NewLocal(cfg.LocalRoot)
	case "s3":
		return nil, fmt.Errorf("s3 backend coming in phase 3")
	default:
		return nil, fmt.Errorf("unknown storage backend: %s", cfg.StorageBackend)
	}
}
