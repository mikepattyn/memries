package exif

import "testing"

func TestNormalizeExifClockReadsDateTimeOriginalWallClock(t *testing.T) {
	got, ok := NormalizeExifClock("2024:08:25 18:30:01")
	if !ok {
		t.Fatal("expected clock")
	}
	if got != "2024-08-25T18:30:01" {
		t.Fatalf("got %q, want 2024-08-25T18:30:01", got)
	}
}

func TestNormalizeExifClockRejectsGarbage(t *testing.T) {
	if _, ok := NormalizeExifClock("not a date"); ok {
		t.Fatal("expected reject")
	}
}

func TestParseTZOffset(t *testing.T) {
	off, ok := ParseTZOffset("+02:00")
	if !ok || off != 2*3600 {
		t.Fatalf("got %d %v, want 7200", off, ok)
	}
	off, ok = ParseTZOffset("-05:30")
	if !ok || off != -5*3600-30*60 {
		t.Fatalf("got %d %v, want -19800", off, ok)
	}
}

func TestUTCFromLocalAppliesOffset(t *testing.T) {
	got := UTCFromLocal("2024-08-25T18:30:01", 2*3600)
	if got.UTC().Format("2006-01-02T15:04:05Z") != "2024-08-25T16:30:01Z" {
		t.Fatalf("got %s", got.UTC().Format("2006-01-02T15:04:05Z"))
	}
}
