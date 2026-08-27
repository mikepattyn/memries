package index

import (
	"testing"
	"time"

	"github.com/memries/memries/internal/db"
)

func TestResolveIdentityKeepsKeyWhenPathMatchesAndHashChanges(t *testing.T) {
	existing := &db.Photo{Key: "old-hash", Hash: "old-hash", Favorite: true}
	key, action := ResolveIdentity("owner/a.jpg", "new-hash", existing, nil)
	if action != IdentityUpdate {
		t.Fatalf("action %q, want %q", action, IdentityUpdate)
	}
	if key != "old-hash" {
		t.Fatalf("key %q, want old-hash", key)
	}
}

func TestResolveIdentityRelocatesWhenHashMatchesNewPath(t *testing.T) {
	existing := &db.Photo{Key: "same-hash", Hash: "same-hash"}
	key, action := ResolveIdentity("owner/moved.jpg", "same-hash", nil, existing)
	if action != IdentityRelocate {
		t.Fatalf("action %q, want %q", action, IdentityRelocate)
	}
	if key != "same-hash" {
		t.Fatalf("key %q", key)
	}
}

func TestResolveIdentityCreatesWhenUnknown(t *testing.T) {
	key, action := ResolveIdentity("owner/new.jpg", "fresh-hash", nil, nil)
	if action != IdentityCreate {
		t.Fatalf("action %q, want %q", action, IdentityCreate)
	}
	if key != "fresh-hash" {
		t.Fatalf("key %q", key)
	}
}

func TestCaptureChangedDetectsLocalClockDrift(t *testing.T) {
	p := db.Photo{
		TakenAt:       time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		TakenAtLocal:  "2024-01-01T00:00:00",
		TakenAtSource: SourceMtime,
	}
	next := Capture{TakenAt: p.TakenAt, TakenAtLocal: "2024-06-01T00:00:00", Source: SourceMtime}
	if !CaptureChanged(p, next) {
		t.Fatal("expected change")
	}
	same := Capture{TakenAt: p.TakenAt, TakenAtLocal: p.TakenAtLocal, TZOffset: p.TZOffset, Source: SourceMtime}
	if CaptureChanged(p, same) {
		t.Fatal("expected no change")
	}
}
