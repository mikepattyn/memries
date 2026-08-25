package index

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"mime"
	"path"
	"path/filepath"
	"strings"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/memries/memries/internal/db"
	"github.com/memries/memries/internal/exif"
	"github.com/memries/memries/internal/storage"
	"github.com/memries/memries/internal/thumb"
)

type Indexer struct {
	Store storage.Storage
	DB    *db.Client
	Thumb *thumb.Generator
	Log   *slog.Logger
}

type Options struct {
	OwnerID     string
	Prefix      string // restrict walk; "" = whole storage
	Concurrency int
	Force       bool // reindex even if hash already present
}

func (i *Indexer) Run(ctx context.Context, opts Options) error {
	if opts.Concurrency <= 0 {
		opts.Concurrency = 4
	}
	if opts.OwnerID == "" {
		return fmt.Errorf("OwnerID required")
	}
	keys := make(chan string, opts.Concurrency*2)
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() error {
		defer close(keys)
		return i.Store.Walk(gctx, opts.Prefix, func(o storage.ObjectInfo) error {
			if !isMedia(o.Key) {
				return nil
			}
			select {
			case keys <- o.Key:
			case <-gctx.Done():
				return gctx.Err()
			}
			return nil
		})
	})
	for w := 0; w < opts.Concurrency; w++ {
		g.Go(func() error {
			for key := range keys {
				if err := i.indexOne(gctx, key, opts.OwnerID, opts.Force); err != nil {
					i.Log.Error("index", "key", key, "err", err)
				}
			}
			return nil
		})
	}
	return g.Wait()
}

func (i *Indexer) indexOne(ctx context.Context, key, ownerID string, force bool) error {
	rc, err := i.Store.Get(ctx, key)
	if err != nil {
		return err
	}
	defer rc.Close()

	hasher := sha256.New()
	var exifBuf [1 << 16]byte
	exifRead := 0
	exifPeek := exifBuf[:0]
	buf := make([]byte, 32*1024)
	var size int64
	for {
		n, rerr := rc.Read(buf)
		if n > 0 {
			hasher.Write(buf[:n])
			size += int64(n)
			if exifRead < len(exifBuf) {
				take := len(exifBuf) - exifRead
				if take > n {
					take = n
				}
				exifPeek = append(exifPeek, buf[:take]...)
				exifRead += take
			}
		}
		if rerr == io.EOF {
			break
		}
		if rerr != nil {
			return rerr
		}
	}
	hash := hex.EncodeToString(hasher.Sum(nil))

	if !force {
		if existing, err := i.DB.GetPhoto(ctx, hash); err == nil {
			if i.Thumb.HasAll(existing.Thumbs.S256, existing.Thumbs.S512, existing.Thumbs.S1024) {
				i.Log.Info("skip existing", "key", key, "hash", hash[:12])
				return nil
			}
		}
	}

	mimeType := mime.TypeByExtension(strings.ToLower(filepath.Ext(key)))
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	var exifRes exif.Result
	if r, err := exif.Parse(bytesReader(exifPeek)); err == nil {
		exifRes = r
	}
	takenAt := exifRes.TakenAt
	if takenAt.IsZero() {
		info, err := i.Store.Stat(ctx, key)
		if err == nil {
			takenAt = info.ModTime.UTC()
		} else {
			takenAt = time.Now().UTC()
		}
	}

	rc2, err := i.Store.Get(ctx, key)
	if err != nil {
		return err
	}
	defer rc2.Close()
	thumbRes, err := i.Thumb.Generate(hash, rc2, exifRes.Orientation)
	if err != nil {
		return fmt.Errorf("thumb: %w", err)
	}

	p := &db.Photo{
		Key:          hash,
		Kind:         "photo",
		OwnerID:      ownerID,
		TakenAt:      takenAt,
		TakenAtLocal: takenAt.Format("2006-01-02T15:04:05"),
		TZOffset:     exifRes.TZOffset,
		Storage:      db.StoragePtr{Backend: i.Store.Backend(), Path: key},
		Hash:         hash,
		SizeBytes:    size,
		MIME:         mimeType,
		Dims:         db.Dims{W: thumbRes.Width, H: thumbRes.Height},
		Orientation:  exifRes.Orientation,
		EXIF:         exifRes.EXIF,
		Thumbs: db.Thumbs{
			S256:  thumbRes.Paths[256],
			S512:  thumbRes.Paths[512],
			S1024: thumbRes.Paths[1024],
		},
		ImportedAt: time.Now().UTC(),
	}
	if err := i.DB.UpsertPhoto(ctx, p); err != nil {
		return fmt.Errorf("upsert: %w", err)
	}
	i.Log.Info("indexed", "key", key, "hash", hash[:12], "taken_at", takenAt.Format(time.RFC3339))
	return nil
}

func isMedia(key string) bool {
	switch strings.ToLower(path.Ext(key)) {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif":
		return true
	}
	return false
}

type bytesReadCloser struct{ b []byte; i int }

func bytesReader(b []byte) io.Reader { return &bytesReadCloser{b: b} }

func (r *bytesReadCloser) Read(p []byte) (int, error) {
	if r.i >= len(r.b) {
		return 0, io.EOF
	}
	n := copy(p, r.b[r.i:])
	r.i += n
	return n, nil
}
