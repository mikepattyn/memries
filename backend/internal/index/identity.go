package index

import "github.com/memries/memries/internal/db"

const (
	IdentityCreate   = "create"
	IdentityUpdate   = "update"
	IdentityRelocate = "relocate"
)

func ResolveIdentity(path, hash string, byPath, byHash *db.Photo) (key string, action string) {
	if byPath != nil {
		return byPath.Key, IdentityUpdate
	}
	if byHash != nil {
		return byHash.Key, IdentityRelocate
	}
	return hash, IdentityCreate
}
