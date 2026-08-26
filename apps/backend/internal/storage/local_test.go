package storage

import (
	"bytes"
	"context"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestResolveKeepsRootOnUnix(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("unix join semantics")
	}
	l := &Local{root: "/data/photos"}
	full, err := l.resolve("admin@example.com/foo.jpg")
	if err != nil {
		t.Fatalf("resolve: %v", err)
	}
	want := "/data/photos/admin@example.com/foo.jpg"
	if full != want {
		t.Fatalf("got %q want %q", full, want)
	}
}

func TestLocalGetReadsOwnerPrefixedKey(t *testing.T) {
	root := t.TempDir()
	store, err := NewLocal(root)
	if err != nil {
		t.Fatal(err)
	}
	key := "admin@example.com/71ef5782-09ef-486d-85e2-f73558d18d7a.jpg"
	full := filepath.Join(root, filepath.FromSlash(key))
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatal(err)
	}
	want := []byte("jpeg-bytes")
	if err := os.WriteFile(full, want, 0o644); err != nil {
		t.Fatal(err)
	}

	rc, err := store.Get(context.Background(), key)
	if err != nil {
		t.Fatalf("Get(%q): %v", key, err)
	}
	defer rc.Close()
	got, err := io.ReadAll(rc)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(got, want) {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestLocalGetRejectsPathEscape(t *testing.T) {
	root := t.TempDir()
	store, err := NewLocal(root)
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.Get(context.Background(), "../outside.jpg")
	if err == nil {
		t.Fatal("expected path escape error")
	}
	if !strings.Contains(err.Error(), "path escape") {
		t.Fatalf("got %v, want path escape", err)
	}
}

func TestLocalGetMissingFile(t *testing.T) {
	root := t.TempDir()
	store, err := NewLocal(root)
	if err != nil {
		t.Fatal(err)
	}
	_, err = store.Get(context.Background(), "admin@example.com/missing.jpg")
	if !IsNotFound(err) {
		t.Fatalf("got %v, want not found", err)
	}
}
