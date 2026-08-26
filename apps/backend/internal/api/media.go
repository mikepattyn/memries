package api

import (
	"net/http"

	"github.com/memries/memries/internal/db"
	"github.com/memries/memries/internal/storage"
)

func largestThumb(t db.Thumbs) string {
	switch {
	case t.S1024 != "":
		return t.S1024
	case t.S512 != "":
		return t.S512
	default:
		return t.S256
	}
}

func statusForStoreOpen(err error) int {
	if storage.IsNotFound(err) {
		return http.StatusNotFound
	}
	return http.StatusInternalServerError
}

func mediaOpenStatus(err error) int {
	return statusForStoreOpen(err)
}

func originalErrorBody(status int) string {
	if status == http.StatusNotFound {
		return "not found"
	}
	return "open original"
}
