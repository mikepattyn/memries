package index

import (
	"testing"

	"github.com/memries/memries/internal/db"
)

func TestRelocatedStorageUpdatesMovedPath(t *testing.T) {
	got, moved := relocatedStorage(db.StoragePtr{Backend: "local", Path: "admin@example.com/IMG_2272.png"}, "admin@example.com/71ef5782.jpg", "local")
	if !moved {
		t.Fatal("expected move")
	}
	if got.Path != "admin@example.com/71ef5782.jpg" || got.Backend != "local" {
		t.Fatalf("got %+v", got)
	}
}

func TestRelocatedStorageNoopsWhenPathMatches(t *testing.T) {
	in := db.StoragePtr{Backend: "local", Path: "admin@example.com/shot.jpg"}
	got, moved := relocatedStorage(in, "admin@example.com/shot.jpg", "local")
	if moved {
		t.Fatal("expected no move")
	}
	if got != in {
		t.Fatalf("got %+v", got)
	}
}
