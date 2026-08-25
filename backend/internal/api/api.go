package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/memries/memries/internal/auth"
	"github.com/memries/memries/internal/db"
	"github.com/memries/memries/internal/storage"
	"github.com/memries/memries/internal/thumb"
)

type API struct {
	DB    *db.Client
	Store storage.Storage
	Thumb *thumb.Generator
}

func (a *API) Routes(r chi.Router) {
	r.Get("/timeline", a.timeline)
	r.Get("/photos", a.photos)
	r.Get("/photos/{id}", a.photo)
	r.Get("/thumb/{id}", a.thumb)
	r.Get("/original/{id}", a.original)
}

func (a *API) timeline(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	q := r.URL.Query()
	g := q.Get("granularity")
	switch g {
	case "year", "month", "week", "day":
	default:
		g = "month"
	}
	from, to, err := parseRange(q.Get("from"), q.Get("to"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	buckets, err := a.DB.Timeline(r.Context(), u.Key, g, from, to)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]interface{}{
		"granularity": g,
		"from":        from,
		"to":          to,
		"buckets":     buckets,
	})
}

func (a *API) photos(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	q := r.URL.Query()
	from, to, err := parseRange(q.Get("from"), q.Get("to"))
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	limit, _ := strconv.Atoi(q.Get("limit"))
	cursor := q.Get("cursor")
	photos, next, err := a.DB.Photos(r.Context(), u.Key, from, to, limit, cursor)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]interface{}{
		"photos":      photos,
		"next_cursor": next,
	})
}

func (a *API) photo(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := chi.URLParam(r, "id")
	p, err := a.DB.GetPhoto(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if p.OwnerID != u.Key {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	writeJSON(w, p)
}

func (a *API) thumb(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := chi.URLParam(r, "id")
	size := r.URL.Query().Get("size")
	if size == "" {
		size = "256"
	}
	p, err := a.DB.GetPhoto(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if p.OwnerID != u.Key {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var rel string
	switch size {
	case "256":
		rel = p.Thumbs.S256
	case "512":
		rel = p.Thumbs.S512
	case "1024":
		rel = p.Thumbs.S1024
	default:
		http.Error(w, "bad size", http.StatusBadRequest)
		return
	}
	if rel == "" {
		http.Error(w, "no thumb", http.StatusNotFound)
		return
	}
	f, err := a.Thumb.Open(rel)
	if err != nil {
		http.Error(w, "open thumb", http.StatusInternalServerError)
		return
	}
	defer f.Close()
	w.Header().Set("Content-Type", "image/jpeg")
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	_, _ = io.Copy(w, f)
}

func (a *API) original(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	id := chi.URLParam(r, "id")
	p, err := a.DB.GetPhoto(r.Context(), id)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if p.OwnerID != u.Key {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	rc, err := a.Store.Get(r.Context(), p.Storage.Path)
	if err != nil {
		http.Error(w, "open original", http.StatusInternalServerError)
		return
	}
	defer rc.Close()
	if p.MIME != "" {
		w.Header().Set("Content-Type", p.MIME)
	}
	w.Header().Set("Cache-Control", "private, max-age=86400")
	_, _ = io.Copy(w, rc)
}

func parseRange(fromStr, toStr string) (time.Time, time.Time, error) {
	from := time.Time{}
	to := time.Now().UTC().Add(24 * time.Hour)
	if fromStr != "" {
		t, err := parseFlexTime(fromStr)
		if err != nil {
			return time.Time{}, time.Time{}, errors.New("bad from")
		}
		from = t
	} else {
		from = time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)
	}
	if toStr != "" {
		t, err := parseFlexTime(toStr)
		if err != nil {
			return time.Time{}, time.Time{}, errors.New("bad to")
		}
		to = t
	}
	return from, to, nil
}

func parseFlexTime(s string) (time.Time, error) {
	layouts := []string{time.RFC3339Nano, time.RFC3339, "2006-01-02", "2006-01", "2006"}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, errors.New("bad time")
}

func writeJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
