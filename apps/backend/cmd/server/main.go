package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/memries/memries/internal/api"
	"github.com/memries/memries/internal/auth"
	"github.com/memries/memries/internal/config"
	"github.com/memries/memries/internal/db"
	"github.com/memries/memries/internal/index"
	"github.com/memries/memries/internal/storage"
	"github.com/memries/memries/internal/thumb"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))
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
	tg, err := thumb.NewGenerator(cfg.CacheRoot)
	if err != nil {
		log.Error("thumb", "err", err)
		os.Exit(1)
	}
	a, err := auth.New(ctx, cfg, dbc)
	if err != nil {
		log.Error("auth", "err", err)
		os.Exit(1)
	}
	idx := &index.Indexer{Store: store, DB: dbc, Thumb: tg, Log: log}
	lib := index.Library{Photos: dbc, Store: store}
	coord := index.NewCoordinator(ctx, idx, dbc, dbc, idx, lib, log)
	if err := coord.Reconcile(ctx); err != nil {
		log.Error("index reconcile", "err", err)
		os.Exit(1)
	}
	apiH := &api.API{DB: dbc, Store: store, Thumb: tg, Index: coord, E2E: os.Getenv("MEMRIES_E2E") == "1"}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.PublicURL, "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	r.Get("/oauth/login", a.LoginHandler)
	r.Get("/oauth/callback", a.CallbackHandler)
	r.Get("/oauth/logout", a.LogoutHandler)

	r.Route("/api", func(r chi.Router) {
		r.Use(a.Middleware)
		r.Get("/me", a.MeHandler)
		apiH.Routes(r)
	})

	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		_ = srv.Shutdown(shutdownCtx)
	}()
	log.Info("starting", "addr", cfg.Addr)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("serve", "err", err)
		os.Exit(1)
	}
}
