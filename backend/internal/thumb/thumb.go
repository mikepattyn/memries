package thumb

import (
	"bytes"
	"errors"
	"image"
	"image/jpeg"
	"io"
	"os"
	"path/filepath"

	"github.com/disintegration/imaging"

	_ "image/gif"
	_ "image/png"
	_ "golang.org/x/image/webp"
)

var Sizes = []int{256, 512, 1024}

type Generator struct {
	cacheRoot string
}

func NewGenerator(cacheRoot string) (*Generator, error) {
	if err := os.MkdirAll(cacheRoot, 0o755); err != nil {
		return nil, err
	}
	return &Generator{cacheRoot: cacheRoot}, nil
}

type Result struct {
	Width  int
	Height int
	Paths  map[int]string
}

func (g *Generator) Generate(photoKey string, src io.Reader, orientation int) (Result, error) {
	data, err := io.ReadAll(src)
	if err != nil {
		return Result{}, err
	}
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return Result{}, err
	}
	img = applyOrientation(img, orientation)
	b := img.Bounds()
	res := Result{Width: b.Dx(), Height: b.Dy(), Paths: map[int]string{}}
	for _, size := range Sizes {
		thumb := imaging.Fit(img, size, size, imaging.Lanczos)
		thumb = imaging.Sharpen(thumb, 0.5)
		rel := filepath.Join(photoKey[:2], photoKey, sizeName(size))
		abs := filepath.Join(g.cacheRoot, rel)
		if err := os.MkdirAll(filepath.Dir(abs), 0o755); err != nil {
			return Result{}, err
		}
		f, err := os.Create(abs)
		if err != nil {
			return Result{}, err
		}
		if err := jpeg.Encode(f, thumb, &jpeg.Options{Quality: 88}); err != nil {
			f.Close()
			return Result{}, err
		}
		if err := f.Close(); err != nil {
			return Result{}, err
		}
		res.Paths[size] = rel
	}
	return res, nil
}

func (g *Generator) Open(rel string) (*os.File, error) {
	if rel == "" {
		return nil, errors.New("empty thumb path")
	}
	return os.Open(filepath.Join(g.cacheRoot, rel))
}

func (g *Generator) HasAll(rels ...string) bool {
	for _, rel := range rels {
		if rel == "" {
			return false
		}
		if _, err := os.Stat(filepath.Join(g.cacheRoot, rel)); err != nil {
			return false
		}
	}
	return true
}

func sizeName(s int) string {
	switch s {
	case 256:
		return "s.jpg"
	case 512:
		return "m.jpg"
	case 1024:
		return "l.jpg"
	}
	return "x.jpg"
}

func applyOrientation(img image.Image, o int) image.Image {
	switch o {
	case 2:
		return imaging.FlipH(img)
	case 3:
		return imaging.Rotate180(img)
	case 4:
		return imaging.FlipV(img)
	case 5:
		return imaging.Transpose(img)
	case 6:
		return imaging.Rotate270(img)
	case 7:
		return imaging.Transverse(img)
	case 8:
		return imaging.Rotate90(img)
	}
	return img
}
