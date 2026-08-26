package db

import (
	"errors"
	"strings"
	"time"
)

var ErrBadCursor = errors.New("bad cursor")

// EncodeCursor builds an opaque keyset cursor for (taken_at DESC, _key DESC).
func EncodeCursor(takenAt time.Time, key string) string {
	return takenAt.UTC().Format(time.RFC3339Nano) + "|" + key
}

func DecodeCursor(s string) (time.Time, string, error) {
	taken, key, ok := strings.Cut(s, "|")
	if !ok || taken == "" || key == "" {
		return time.Time{}, "", ErrBadCursor
	}
	t, err := time.Parse(time.RFC3339Nano, taken)
	if err != nil {
		return time.Time{}, "", ErrBadCursor
	}
	return t.UTC(), key, nil
}

func ClampPhotoLimit(limit int) int {
	if limit <= 0 || limit > 500 {
		return 200
	}
	return limit
}

// ClipPage keeps at most limit items from a limit+1 fetch and emits a cursor
// only when another page exists.
func ClipPage(photos []Photo, limit int) ([]Photo, string) {
	limit = ClampPhotoLimit(limit)
	if len(photos) > limit {
		last := photos[limit-1]
		return photos[:limit], EncodeCursor(last.TakenAt, last.Key)
	}
	return photos, ""
}

// AfterCursor reports whether (takenAt, key) is strictly after the cursor in
// DESC (taken_at, _key) order — i.e. belongs on a later page.
func AfterCursor(takenAt time.Time, key string, cursorTaken time.Time, cursorKey string) bool {
	if takenAt.Equal(cursorTaken) {
		return key < cursorKey
	}
	return takenAt.Before(cursorTaken)
}
