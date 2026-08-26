package exif

import (
	"bytes"
	"encoding/binary"
	"testing"
)

func TestParseReadsHandRolledDateTimeOriginal(t *testing.T) {
	jpeg := jpegWithDateTimeOriginal("2026:08:31 10:00:00")
	got, err := Parse(bytes.NewReader(jpeg))
	if err != nil {
		t.Fatal(err)
	}
	if got.TakenAtLocal != "2026-08-31T10:00:00" {
		t.Fatalf("local %q", got.TakenAtLocal)
	}
}

func jpegWithDateTimeOriginal(datetime string) []byte {
	payload := append([]byte(datetime), 0)
	tiffHeader := 8
	ifd0 := tiffHeader
	ifd0Next := ifd0 + 2 + 12
	exifIFD := ifd0Next + 4
	exifNext := exifIFD + 2 + 12
	stringOff := exifNext + 4
	tiff := make([]byte, stringOff+len(payload))
	copy(tiff[0:], "II")
	binary.LittleEndian.PutUint16(tiff[2:], 42)
	binary.LittleEndian.PutUint32(tiff[4:], uint32(ifd0))
	binary.LittleEndian.PutUint16(tiff[ifd0:], 1)
	binary.LittleEndian.PutUint16(tiff[ifd0+2:], 0x8769)
	binary.LittleEndian.PutUint16(tiff[ifd0+4:], 4)
	binary.LittleEndian.PutUint32(tiff[ifd0+6:], 1)
	binary.LittleEndian.PutUint32(tiff[ifd0+10:], uint32(exifIFD))
	binary.LittleEndian.PutUint16(tiff[exifIFD:], 1)
	binary.LittleEndian.PutUint16(tiff[exifIFD+2:], 0x9003)
	binary.LittleEndian.PutUint16(tiff[exifIFD+4:], 2)
	binary.LittleEndian.PutUint32(tiff[exifIFD+6:], uint32(len(payload)))
	binary.LittleEndian.PutUint32(tiff[exifIFD+10:], uint32(stringOff))
	copy(tiff[stringOff:], payload)

	exifBody := append(append([]byte{}, "Exif\x00\x00"...), tiff...)
	app1 := make([]byte, 4+len(exifBody))
	app1[0], app1[1] = 0xff, 0xe1
	binary.BigEndian.PutUint16(app1[2:], uint16(2+len(exifBody)))
	copy(app1[4:], exifBody)

	// 1x1 gray JPEG SOI + APP1 + remainder of a tiny baseline JPEG.
	rest := []byte{
		0xff, 0xdb, 0x00, 0x43, 0x00,
		0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14,
		0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
		0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c,
		0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32,
		0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
		0xff, 0xc4, 0x00, 0x14, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x09,
		0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0x7f, 0xff, 0xd9,
	}
	out := append([]byte{0xff, 0xd8}, app1...)
	return append(out, rest...)
}
