package exif

import (
	"io"
	"strings"
	"time"

	goexif "github.com/rwcarlsen/goexif/exif"

	"github.com/memries/memries/internal/db"
)

type Result struct {
	TakenAt      time.Time
	TakenAtLocal string
	TZOffset     int
	Orientation  int
	EXIF         db.EXIF
}

func Parse(r io.Reader) (Result, error) {
	x, err := goexif.Decode(r)
	if err != nil {
		return Result{}, err
	}
	res := Result{Orientation: 1}
	res.TakenAtLocal, res.TakenAt, res.TZOffset = readCaptureClock(x)
	if tag, err := x.Get(goexif.Orientation); err == nil {
		if v, err := tag.Int(0); err == nil {
			res.Orientation = v
		}
	}
	if tag, err := x.Get(goexif.Model); err == nil {
		s, _ := tag.StringVal()
		res.EXIF.Camera = strings.TrimSpace(s)
	}
	if tag, err := x.Get(goexif.LensModel); err == nil {
		s, _ := tag.StringVal()
		res.EXIF.Lens = strings.TrimSpace(s)
	}
	if tag, err := x.Get(goexif.ISOSpeedRatings); err == nil {
		if v, err := tag.Int(0); err == nil {
			res.EXIF.ISO = v
		}
	}
	if tag, err := x.Get(goexif.FNumber); err == nil {
		if n, d, err := tag.Rat2(0); err == nil && d != 0 {
			res.EXIF.FNum = float64(n) / float64(d)
		}
	}
	if tag, err := x.Get(goexif.ExposureTime); err == nil {
		res.EXIF.Shutter = tag.String()
	}
	if lat, lon, err := x.LatLong(); err == nil {
		res.EXIF.GPS = &db.GPS{Lat: lat, Lon: lon}
	}
	return res, nil
}

func readCaptureClock(x *goexif.Exif) (local string, taken time.Time, offset int) {
	for _, name := range []goexif.FieldName{goexif.DateTimeOriginal, goexif.DateTimeDigitized, goexif.DateTime} {
		tag, err := x.Get(name)
		if err != nil {
			continue
		}
		s, err := tag.StringVal()
		if err != nil {
			continue
		}
		clock, ok := NormalizeExifClock(s)
		if !ok {
			continue
		}
		local = clock
		break
	}
	if tag, err := x.Get("OffsetTimeOriginal"); err == nil {
		if s, err := tag.StringVal(); err == nil {
			if off, ok := ParseTZOffset(strings.TrimSpace(s)); ok {
				offset = off
			}
		}
	}
	if local != "" {
		taken = UTCFromLocal(local, offset)
	}
	return local, taken, offset
}
