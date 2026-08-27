package index

import (
	"time"

	"github.com/memries/memries/internal/db"
	"github.com/memries/memries/internal/exif"
	"github.com/memries/memries/internal/storage"
)

const (
	SourceEXIF  = "exif"
	SourceBirth = "birth"
	SourceMtime = "mtime"
)

type Capture struct {
	TakenAt      time.Time
	TakenAtLocal string
	TZOffset     int
	Source       string
}

func ResolveCaptureTime(ex exif.Result, info storage.ObjectInfo) Capture {
	if ex.TakenAtLocal != "" || !ex.TakenAt.IsZero() {
		local := ex.TakenAtLocal
		if local == "" {
			local = ex.TakenAt.UTC().Format("2006-01-02T15:04:05")
		}
		taken := ex.TakenAt
		if taken.IsZero() {
			taken = exif.UTCFromLocal(local, ex.TZOffset)
		}
		return Capture{
			TakenAt:      taken.UTC(),
			TakenAtLocal: local,
			TZOffset:     ex.TZOffset,
			Source:       SourceEXIF,
		}
	}
	if !info.CreatedAt.IsZero() {
		return captureFromFileTime(info.CreatedAt, SourceBirth)
	}
	if !info.ModTime.IsZero() {
		return captureFromFileTime(info.ModTime, SourceMtime)
	}
	return captureFromFileTime(time.Now().UTC(), SourceMtime)
}

func captureFromFileTime(t time.Time, source string) Capture {
	utc := t.UTC()
	return Capture{
		TakenAt:      utc,
		TakenAtLocal: utc.Format("2006-01-02T15:04:05"),
		TZOffset:     0,
		Source:       source,
	}
}

func CaptureChanged(existing db.Photo, next Capture) bool {
	if existing.TakenAtLocal != next.TakenAtLocal {
		return true
	}
	if existing.TZOffset != next.TZOffset {
		return true
	}
	if existing.TakenAtSource != "" && existing.TakenAtSource != next.Source {
		return true
	}
	return !existing.TakenAt.Equal(next.TakenAt)
}

func applyCapture(p *db.Photo, cap Capture) {
	p.TakenAt = cap.TakenAt
	p.TakenAtLocal = cap.TakenAtLocal
	p.TZOffset = cap.TZOffset
	p.TakenAtSource = cap.Source
}
