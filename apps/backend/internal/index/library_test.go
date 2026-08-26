package index

import (
	"context"
	"errors"
	"io/fs"
	"testing"
	"time"

	"github.com/memries/memries/internal/db"
	"github.com/memries/memries/internal/storage"
)

type fakePhotoLister struct {
	photos []db.Photo
	err    error
}

func (f fakePhotoLister) Photos(context.Context, string, time.Time, time.Time, int, string) ([]db.Photo, string, error) {
	return f.photos, "", f.err
}

type fakeStater struct {
	missing map[string]bool
}

func (f fakeStater) Stat(_ context.Context, key string) (storage.ObjectInfo, error) {
	if f.missing[key] {
		return storage.ObjectInfo{}, fs.ErrNotExist
	}
	return storage.ObjectInfo{Key: key}, nil
}

func TestRecentOriginalsMissingWhenEverySampleIsGone(t *testing.T) {
	lib := Library{
		Photos: fakePhotoLister{photos: []db.Photo{
			{Storage: db.StoragePtr{Path: "admin@example.com/IMG_2272.png"}},
			{Storage: db.StoragePtr{Path: "admin@example.com/old.jpg"}},
		}},
		Store: fakeStater{missing: map[string]bool{
			"admin@example.com/IMG_2272.png": true,
			"admin@example.com/old.jpg":      true,
		}},
	}
	missing, err := lib.RecentOriginalsMissing(context.Background(), "owner1")
	if err != nil {
		t.Fatal(err)
	}
	if !missing {
		t.Fatal("expected missing library")
	}
}

func TestRecentOriginalsMissingIfAnyFileExists(t *testing.T) {
	lib := Library{
		Photos: fakePhotoLister{photos: []db.Photo{
			{Storage: db.StoragePtr{Path: "admin@example.com/gone.jpg"}},
			{Storage: db.StoragePtr{Path: "admin@example.com/here.jpg"}},
		}},
		Store: fakeStater{missing: map[string]bool{"admin@example.com/gone.jpg": true}},
	}
	missing, err := lib.RecentOriginalsMissing(context.Background(), "owner1")
	if err != nil {
		t.Fatal(err)
	}
	if missing {
		t.Fatal("existing original should keep the library")
	}
}

func TestRecentOriginalsMissingNoPhotos(t *testing.T) {
	lib := Library{Photos: fakePhotoLister{}, Store: fakeStater{}}
	missing, err := lib.RecentOriginalsMissing(context.Background(), "owner1")
	if err != nil {
		t.Fatal(err)
	}
	if missing {
		t.Fatal("empty list is not a missing library")
	}
}

func TestRecentOriginalsMissingPropagatesListError(t *testing.T) {
	lib := Library{Photos: fakePhotoLister{err: errors.New("db down")}, Store: fakeStater{}}
	if _, err := lib.RecentOriginalsMissing(context.Background(), "owner1"); err == nil {
		t.Fatal("expected error")
	}
}
