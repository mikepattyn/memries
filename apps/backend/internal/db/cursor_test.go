package db

import (
	"testing"
	"time"
)

func TestEncodeDecodeCursor(t *testing.T) {
	taken := time.Date(2024, 8, 25, 18, 30, 1, 123, time.UTC)
	raw := EncodeCursor(taken, "abc")
	gotT, gotK, err := DecodeCursor(raw)
	if err != nil {
		t.Fatal(err)
	}
	if !gotT.Equal(taken) || gotK != "abc" {
		t.Fatalf("got %v %q", gotT, gotK)
	}
}

func TestDecodeCursorRejectsGarbage(t *testing.T) {
	for _, raw := range []string{"", "only-time", "2024-08-25T18:30:01Z|", "|key", "not-a-time|key"} {
		if _, _, err := DecodeCursor(raw); err != ErrBadCursor {
			t.Fatalf("%q: got %v", raw, err)
		}
	}
}

func TestClipPageEmitsCursorOnlyWhenMoreRemain(t *testing.T) {
	t0 := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	photos := []Photo{
		{Key: "c", TakenAt: t0},
		{Key: "b", TakenAt: t0},
		{Key: "a", TakenAt: t0},
	}
	page, next := ClipPage(photos, 2)
	if len(page) != 2 || page[0].Key != "c" || page[1].Key != "b" {
		t.Fatalf("page = %+v", page)
	}
	if next != EncodeCursor(t0, "b") {
		t.Fatalf("next = %q", next)
	}
	last, done := ClipPage(photos[2:], 2)
	if len(last) != 1 || last[0].Key != "a" || done != "" {
		t.Fatalf("last = %+v next = %q", last, done)
	}
}

func TestAfterCursorKeepsSameTimestampSiblings(t *testing.T) {
	t0 := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC)
	tOlder := t0.Add(-time.Hour)
	// Page 1 ended at (t0, "b"). Next page must include (t0, "a") and older times.
	if !AfterCursor(t0, "a", t0, "b") {
		t.Fatal("same-time smaller key should be after cursor")
	}
	if AfterCursor(t0, "c", t0, "b") {
		t.Fatal("same-time larger key already returned")
	}
	if AfterCursor(t0, "b", t0, "b") {
		t.Fatal("cursor item itself is not after")
	}
	if !AfterCursor(tOlder, "zzz", t0, "b") {
		t.Fatal("older taken_at should be after cursor")
	}
}
