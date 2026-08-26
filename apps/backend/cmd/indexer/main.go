package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/memries/memries/internal/config"
	"github.com/memries/memries/internal/db"
	"github.com/memries/memries/internal/index"
	"github.com/memries/memries/internal/storage"
	"github.com/memries/memries/internal/thumb"
)

func main() {
	owner := flag.String("owner", "", "owner email (required)")
	prefix := flag.String("prefix", "", "storage key prefix to limit walk")
	conc := flag.Int("concurrency", 4, "worker count")
	force := flag.Bool("force", false, "reindex + regenerate thumbs even if hash already present")
	flag.Parse()

	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
	if *owner == "" {
		log.Error("owner email required")
		os.Exit(2)
	}

	cfg, err := config.FromEnv()
	if err != nil {
		log.Error("config", "err", err)
		os.Exit(1)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	store, err := storage.New(cfg)
	if err != nil {
		log.Error("storage", "err", err)
		os.Exit(1)
	}
	dbc, err := db.Connect(ctx, cfg)
	if err != nil {
		log.Error("db", "err", err)
		os.Exit(1)
	}
	user, err := dbc.UpsertUserByEmail(ctx, *owner, *owner)
	if err != nil {
		log.Error("user", "err", err)
		os.Exit(1)
	}
	tg, err := thumb.NewGenerator(cfg.CacheRoot)
	if err != nil {
		log.Error("thumb gen", "err", err)
		os.Exit(1)
	}
	idx := &index.Indexer{Store: store, DB: dbc, Thumb: tg, Log: log}
	if _, err := idx.Run(ctx, index.Options{OwnerID: user.Key, Prefix: *prefix, Concurrency: *conc, Force: *force}); err != nil {
		log.Error("index", "err", err)
		os.Exit(1)
	}
}
