package index

import "github.com/memries/memries/internal/db"

func relocatedStorage(existing db.StoragePtr, key, backend string) (db.StoragePtr, bool) {
	if existing.Path == key && (existing.Backend == "" || existing.Backend == backend) {
		return existing, false
	}
	existing.Path = key
	existing.Backend = backend
	return existing, true
}
