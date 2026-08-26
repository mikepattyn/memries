package api

import (
	"errors"
	"net/http"

	"github.com/memries/memries/internal/auth"
	"github.com/memries/memries/internal/index"
)

func (a *API) indexStatus(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if a.Index == nil {
		http.Error(w, "index unavailable", http.StatusServiceUnavailable)
		return
	}
	s, err := a.Index.Status(r.Context(), u.Key, u.Email)
	if err != nil {
		if errors.Is(err, index.ErrInvalidEmail) {
			http.Error(w, "bad email", http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, s)
}

func (a *API) startIndex(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	if a.Index == nil {
		http.Error(w, "index unavailable", http.StatusServiceUnavailable)
		return
	}
	s, err := a.Index.Start(r.Context(), u.Key, u.Email)
	if err != nil {
		if errors.Is(err, index.ErrInvalidEmail) {
			http.Error(w, "bad email", http.StatusBadRequest)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusAccepted)
	writeJSON(w, s)
}
