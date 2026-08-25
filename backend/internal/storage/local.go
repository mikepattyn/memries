package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Local struct {
	root string
}

func NewLocal(root string) (*Local, error) {
	if err := os.MkdirAll(root, 0o755); err != nil {
		return nil, err
	}
	abs, err := filepath.Abs(root)
	if err != nil {
		return nil, err
	}
	return &Local{root: abs}, nil
}

func (l *Local) Backend() string { return "local" }

func (l *Local) resolve(key string) (string, error) {
	clean := filepath.Clean("/" + key)
	full := filepath.Join(l.root, clean)
	if !strings.HasPrefix(full, l.root) {
		return "", fmt.Errorf("path escape: %s", key)
	}
	return full, nil
}

func (l *Local) Put(ctx context.Context, key string, r io.Reader) error {
	p, err := l.resolve(key)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	tmp := p + ".tmp"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(f, r); err != nil {
		f.Close()
		os.Remove(tmp)
		return err
	}
	if err := f.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, p)
}

func (l *Local) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	p, err := l.resolve(key)
	if err != nil {
		return nil, err
	}
	return os.Open(p)
}

func (l *Local) Stat(ctx context.Context, key string) (ObjectInfo, error) {
	p, err := l.resolve(key)
	if err != nil {
		return ObjectInfo{}, err
	}
	st, err := os.Stat(p)
	if err != nil {
		return ObjectInfo{}, err
	}
	return ObjectInfo{Key: key, Size: st.Size(), ModTime: st.ModTime()}, nil
}

func (l *Local) URL(ctx context.Context, key string, ttl time.Duration) (string, error) {
	return "file://" + url.PathEscape(key), nil
}

func (l *Local) Delete(ctx context.Context, key string) error {
	p, err := l.resolve(key)
	if err != nil {
		return err
	}
	err = os.Remove(p)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}

func (l *Local) Walk(ctx context.Context, prefix string, fn func(ObjectInfo) error) error {
	base, err := l.resolve(prefix)
	if err != nil {
		return err
	}
	return filepath.WalkDir(base, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			if errors.Is(err, fs.ErrNotExist) {
				return nil
			}
			return err
		}
		if d.IsDir() {
			return nil
		}
		if ctx.Err() != nil {
			return ctx.Err()
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(l.root, p)
		if err != nil {
			return err
		}
		key := filepath.ToSlash(rel)
		return fn(ObjectInfo{Key: key, Size: info.Size(), ModTime: info.ModTime()})
	})
}

// AbsPath returns absolute filesystem path for a key.
// Used by API layer to serve originals via Caddy X-Accel/sendfile.
func (l *Local) AbsPath(key string) (string, error) {
	return l.resolve(key)
}
