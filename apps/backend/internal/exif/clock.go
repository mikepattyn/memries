package exif

import (
	"regexp"
	"strconv"
	"time"
)

var exifClock = regexp.MustCompile(`^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})`)

var tzOffset = regexp.MustCompile(`^([+-])(\d{2}):?(\d{2})$`)

func NormalizeExifClock(value string) (string, bool) {
	m := exifClock.FindStringSubmatch(value)
	if m == nil {
		return "", false
	}
	return m[1] + "-" + m[2] + "-" + m[3] + "T" + m[4] + ":" + m[5] + ":" + m[6], true
}

func ParseTZOffset(value string) (int, bool) {
	m := tzOffset.FindStringSubmatch(value)
	if m == nil {
		return 0, false
	}
	hours, errH := strconv.Atoi(m[2])
	mins, errM := strconv.Atoi(m[3])
	if errH != nil || errM != nil {
		return 0, false
	}
	sec := hours*3600 + mins*60
	if m[1] == "-" {
		return -sec, true
	}
	return sec, true
}

func UTCFromLocal(local string, offsetSec int) time.Time {
	t, err := time.ParseInLocation("2006-01-02T15:04:05", local, time.UTC)
	if err != nil {
		return time.Time{}
	}
	return t.Add(-time.Duration(offsetSec) * time.Second).UTC()
}
