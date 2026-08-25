package exif

import (
	"io"
	"strings"
	"time"

	goexif "github.com/rwcarlsen/goexif/exif"

	"github.com/memries/memries/internal/db"
)

type Result struct {
	TakenAt     time.Time
	TZOffset    int
	Orientation int
	EXIF        db.EXIF
}

func Parse(r io.Reader) (Result, error) {
	x, err := goexif.Decode(r)
	if err != nil {
		return Result{}, err
	}
	res := Result{Orientation: 1}
	if t, err := x.DateTime(); err == nil {
		res.TakenAt = t.UTC()
		_, off := t.Zone()
		res.TZOffset = off
	}
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
