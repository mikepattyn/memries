package index

import (
	"testing"
	"time"

	"github.com/memries/memries/internal/exif"
	"github.com/memries/memries/internal/storage"
)

func TestResolveCaptureTimePrefersExifOverFileTimes(t *testing.T) {
	exifTaken := time.Date(2024, 8, 25, 16, 30, 1, 0, time.UTC)
	got := ResolveCaptureTime(exif.Result{
		TakenAt:      exifTaken,
		TakenAtLocal: "2024-08-25T18:30:01",
		TZOffset:     2 * 3600,
	}, storage.ObjectInfo{
		CreatedAt: time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC),
		ModTime:   time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC),
	})
	if got.Source != SourceEXIF {
		t.Fatalf("source %q, want %q", got.Source, SourceEXIF)
	}
	if got.TakenAtLocal != "2024-08-25T18:30:01" {
		t.Fatalf("local %q", got.TakenAtLocal)
	}
	if got.TZOffset != 2*3600 {
		t.Fatalf("offset %d", got.TZOffset)
	}
	if got.TakenAt.UTC().Format(time.RFC3339) != "2024-08-25T16:30:01Z" {
		t.Fatalf("utc %s", got.TakenAt.UTC())
	}
}

func TestResolveCaptureTimeUsesBirthWhenExifMissing(t *testing.T) {
	birth := time.Date(2023, 3, 15, 9, 0, 0, 0, time.UTC)
	got := ResolveCaptureTime(exif.Result{}, storage.ObjectInfo{
		CreatedAt: birth,
		ModTime:   time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
	})
	if got.Source != SourceBirth {
		t.Fatalf("source %q, want %q", got.Source, SourceBirth)
	}
	if got.TakenAtLocal != "2023-03-15T09:00:00" {
		t.Fatalf("local %q", got.TakenAtLocal)
	}
	if !got.TakenAt.Equal(birth) {
		t.Fatalf("utc %s", got.TakenAt)
	}
}

func TestResolveCaptureTimeUsesModTimeWhenBirthAndExifMissing(t *testing.T) {
	mtime := time.Date(2022, 6, 1, 12, 0, 0, 0, time.UTC)
	got := ResolveCaptureTime(exif.Result{}, storage.ObjectInfo{ModTime: mtime})
	if got.Source != SourceMtime {
		t.Fatalf("source %q, want %q", got.Source, SourceMtime)
	}
	if got.TakenAtLocal != "2022-06-01T12:00:00" {
		t.Fatalf("local %q", got.TakenAtLocal)
	}
}
