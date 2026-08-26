package api

import (
	"errors"
	"io/fs"
	"net/http"
	"testing"

	"github.com/memries/memries/internal/db"
	"github.com/memries/memries/internal/storage"
)

func TestLargestThumbPrefersLongestEdge(t *testing.T) {
	got := largestThumb(db.Thumbs{S256: "s.jpg", S512: "m.jpg", S1024: "l.jpg"})
	if got != "l.jpg" {
		t.Fatalf("got %q, want l.jpg", got)
	}
	got = largestThumb(db.Thumbs{S256: "s.jpg"})
	if got != "s.jpg" {
		t.Fatalf("got %q, want s.jpg", got)
	}
}

func TestMediaOpenStatusMapsMissingFileToNotFound(t *testing.T) {
	if got := mediaOpenStatus(fs.ErrNotExist); got != http.StatusNotFound {
		t.Fatalf("got %d, want 404", got)
	}
	if got := mediaOpenStatus(errors.New("path escape: ../x")); got != http.StatusNotFound {
		t.Fatalf("got %d, want 404 for path escape", got)
	}
	if got := mediaOpenStatus(fs.ErrPermission); got != http.StatusInternalServerError {
		t.Fatalf("got %d, want 500", got)
	}
	if got := originalErrorBody(http.StatusNotFound); got != "not found" {
		t.Fatalf("got %q, want not found", got)
	}
	if !storage.IsNotFound(fs.ErrNotExist) {
		t.Fatal("expected IsNotFound for ErrNotExist")
	}
}
