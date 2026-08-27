package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/memries/memries/internal/auth"
	"github.com/memries/memries/internal/db"
)

func libraryStatus(err error) int {
	if errors.Is(err, db.ErrNotFound) {
		return http.StatusNotFound
	}
	if errors.Is(err, db.ErrForbidden) {
		return http.StatusForbidden
	}
	return http.StatusBadRequest
}

func (a *API) albums(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	views, err := a.DB.ListAlbums(r.Context(), u.Key)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]interface{}{"albums": views})
}

func (a *API) createAlbum(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if strings.TrimSpace(body.Name) == "" {
		http.Error(w, "album name is required", http.StatusBadRequest)
		return
	}
	view, err := a.DB.CreateAlbum(r.Context(), u.Key, body.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusCreated)
	writeJSON(w, view)
}

func (a *API) album(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	detail, err := a.DB.GetAlbumView(r.Context(), u.Key, chi.URLParam(r, "id"))
	if err != nil {
		http.Error(w, err.Error(), libraryStatus(err))
		return
	}
	writeJSON(w, detail)
}

func (a *API) addAlbumPhoto(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		PhotoID string `json:"photo_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || strings.TrimSpace(body.PhotoID) == "" {
		http.Error(w, "photo_id required", http.StatusBadRequest)
		return
	}
	view, err := a.DB.AddPhotoToAlbum(r.Context(), u.Key, chi.URLParam(r, "id"), body.PhotoID)
	if err != nil {
		http.Error(w, err.Error(), libraryStatus(err))
		return
	}
	writeJSON(w, view)
}

func (a *API) removeAlbumPhoto(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	view, err := a.DB.RemovePhotoFromAlbum(r.Context(), u.Key, chi.URLParam(r, "id"), chi.URLParam(r, "photoId"))
	if err != nil {
		http.Error(w, err.Error(), libraryStatus(err))
		return
	}
	writeJSON(w, view)
}

func (a *API) setFavorite(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	var body struct {
		Favorite bool `json:"favorite"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	p, err := a.DB.SetFavorite(r.Context(), u.Key, chi.URLParam(r, "id"), body.Favorite)
	if err != nil {
		http.Error(w, err.Error(), libraryStatus(err))
		return
	}
	writeJSON(w, p)
}

func (a *API) e2eReset(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if err := a.DB.ClearOwnerAlbumsAndFavorites(r.Context(), u.Key); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]string{"status": "ok"})
}
