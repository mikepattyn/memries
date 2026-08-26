package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/memries/memries/internal/auth"
	"github.com/memries/memries/internal/db"
)

type fakeLibrary struct {
	photos     map[string]*db.Photo
	albums     map[string]*db.AlbumView
	albumOwner map[string]string
	filter     db.PhotoFilter
	listed     bool
	resetFor   string
}

func (f *fakeLibrary) GetPhoto(_ context.Context, key string) (*db.Photo, error) {
	p, ok := f.photos[key]
	if !ok {
		return nil, db.ErrNotFound
	}
	cp := *p
	return &cp, nil
}

func (f *fakeLibrary) PhotosFiltered(_ context.Context, _ string, _, _ time.Time, _ int, _ string, filter db.PhotoFilter) ([]db.Photo, string, error) {
	f.filter = filter
	out := make([]db.Photo, 0, len(f.photos))
	for _, p := range f.photos {
		out = append(out, *p)
	}
	return out, "", nil
}

func (f *fakeLibrary) Timeline(context.Context, string, string, time.Time, time.Time) ([]db.Bucket, error) {
	return nil, nil
}

func (f *fakeLibrary) SetFavorite(_ context.Context, ownerID, photoID string, favorite bool) (*db.Photo, error) {
	p, ok := f.photos[photoID]
	if !ok {
		return nil, db.ErrNotFound
	}
	if p.OwnerID != ownerID {
		return nil, db.ErrForbidden
	}
	p.Favorite = favorite
	cp := *p
	return &cp, nil
}

func (f *fakeLibrary) ListAlbums(context.Context, string) ([]db.AlbumView, error) {
	f.listed = true
	out := make([]db.AlbumView, 0, len(f.albums))
	for _, a := range f.albums {
		out = append(out, *a)
	}
	return out, nil
}

func (f *fakeLibrary) CreateAlbum(_ context.Context, ownerID, name string) (*db.AlbumView, error) {
	view := &db.AlbumView{ID: "album-1", Name: name, CreatedAt: time.Date(2026, 8, 25, 0, 0, 0, 0, time.UTC), PhotoIDs: []string{}}
	if f.albums == nil {
		f.albums = map[string]*db.AlbumView{}
	}
	if f.albumOwner == nil {
		f.albumOwner = map[string]string{}
	}
	f.albums[view.ID] = view
	f.albumOwner[view.ID] = ownerID
	return view, nil
}

func (f *fakeLibrary) GetAlbumView(_ context.Context, ownerID, albumID string) (*db.AlbumDetail, error) {
	album, ok := f.albums[albumID]
	if !ok {
		return nil, db.ErrNotFound
	}
	if f.albumOwner[albumID] != ownerID {
		return nil, db.ErrForbidden
	}
	photos := []db.Photo{}
	for _, id := range album.PhotoIDs {
		if p, ok := f.photos[id]; ok {
			photos = append(photos, *p)
		}
	}
	return &db.AlbumDetail{AlbumView: *album, Photos: photos}, nil
}

func (f *fakeLibrary) AddPhotoToAlbum(_ context.Context, ownerID, albumID, photoID string) (*db.AlbumView, error) {
	album, ok := f.albums[albumID]
	if !ok {
		return nil, db.ErrNotFound
	}
	p, ok := f.photos[photoID]
	if !ok {
		return nil, db.ErrNotFound
	}
	if p.OwnerID != ownerID {
		return nil, db.ErrForbidden
	}
	for _, id := range album.PhotoIDs {
		if id == photoID {
			return album, nil
		}
	}
	album.PhotoIDs = append(album.PhotoIDs, photoID)
	album.PhotoCount = len(album.PhotoIDs)
	album.CoverPhotoID = album.PhotoIDs[0]
	return album, nil
}

func (f *fakeLibrary) RemovePhotoFromAlbum(_ context.Context, ownerID, albumID, photoID string) (*db.AlbumView, error) {
	album, ok := f.albums[albumID]
	if !ok {
		return nil, db.ErrNotFound
	}
	if f.albumOwner[albumID] != ownerID {
		return nil, db.ErrForbidden
	}
	kept := make([]string, 0, len(album.PhotoIDs))
	for _, id := range album.PhotoIDs {
		if id != photoID {
			kept = append(kept, id)
		}
	}
	album.PhotoIDs = kept
	album.PhotoCount = len(kept)
	if len(kept) > 0 {
		album.CoverPhotoID = kept[0]
	} else {
		album.CoverPhotoID = ""
	}
	return album, nil
}

func (f *fakeLibrary) ClearOwnerAlbumsAndFavorites(_ context.Context, ownerID string) error {
	f.resetFor = ownerID
	return nil
}

func withUser(r *http.Request, key string) *http.Request {
	return r.WithContext(auth.WithUser(r.Context(), &auth.SessionUser{Key: key, Email: "admin@example.com"}))
}

func TestCreateAlbumAndAddPhoto(t *testing.T) {
	lib := &fakeLibrary{
		photos: map[string]*db.Photo{"p1": {Key: "p1", OwnerID: "owner"}},
		albums: map[string]*db.AlbumView{},
	}
	a := &API{DB: lib}
	r := chi.NewRouter()
	a.Routes(r)

	create := httptest.NewRequest(http.MethodPost, "/albums", bytes.NewBufferString(`{"name":"Trip"}`))
	create = withUser(create, "owner")
	cw := httptest.NewRecorder()
	r.ServeHTTP(cw, create)
	if cw.Code != http.StatusCreated {
		t.Fatalf("create %d %s", cw.Code, cw.Body.String())
	}
	var created db.AlbumView
	if err := json.Unmarshal(cw.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	if created.Name != "Trip" || created.PhotoCount != 0 {
		t.Fatalf("created %+v", created)
	}

	add := httptest.NewRequest(http.MethodPost, "/albums/album-1/photos", bytes.NewBufferString(`{"photo_id":"p1"}`))
	add = withUser(add, "owner")
	aw := httptest.NewRecorder()
	r.ServeHTTP(aw, add)
	if aw.Code != http.StatusOK {
		t.Fatalf("add %d %s", aw.Code, aw.Body.String())
	}
	var view db.AlbumView
	if err := json.Unmarshal(aw.Body.Bytes(), &view); err != nil {
		t.Fatal(err)
	}
	if view.PhotoCount != 1 || view.PhotoIDs[0] != "p1" {
		t.Fatalf("view %+v", view)
	}

	again := httptest.NewRequest(http.MethodPost, "/albums/album-1/photos", bytes.NewBufferString(`{"photo_id":"p1"}`))
	again = withUser(again, "owner")
	rw := httptest.NewRecorder()
	r.ServeHTTP(rw, again)
	if err := json.Unmarshal(rw.Body.Bytes(), &view); err != nil {
		t.Fatal(err)
	}
	if view.PhotoCount != 1 {
		t.Fatalf("idempotent count %d", view.PhotoCount)
	}
}

func TestGetAlbumReturnsPhotos(t *testing.T) {
	lib := &fakeLibrary{
		photos:     map[string]*db.Photo{"p1": {Key: "p1", OwnerID: "owner"}},
		albums:     map[string]*db.AlbumView{"album-1": {ID: "album-1", Name: "Trip", PhotoCount: 1, CoverPhotoID: "p1", PhotoIDs: []string{"p1"}}},
		albumOwner: map[string]string{"album-1": "owner"},
	}
	a := &API{DB: lib}
	r := chi.NewRouter()
	a.Routes(r)

	req := httptest.NewRequest(http.MethodGet, "/albums/album-1", nil)
	req = withUser(req, "owner")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d %s", w.Code, w.Body.String())
	}
	var detail db.AlbumDetail
	if err := json.Unmarshal(w.Body.Bytes(), &detail); err != nil {
		t.Fatal(err)
	}
	if detail.Name != "Trip" || len(detail.Photos) != 1 || detail.Photos[0].Key != "p1" {
		t.Fatalf("detail %+v", detail)
	}
}

func TestGetAlbumRequiresOwner(t *testing.T) {
	lib := &fakeLibrary{
		albums:     map[string]*db.AlbumView{"album-1": {ID: "album-1", Name: "Trip", PhotoIDs: []string{}}},
		albumOwner: map[string]string{"album-1": "owner"},
	}
	a := &API{DB: lib}
	r := chi.NewRouter()
	a.Routes(r)

	req := httptest.NewRequest(http.MethodGet, "/albums/album-1", nil)
	req = withUser(req, "other")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("got %d", w.Code)
	}
}

func TestRemoveAlbumPhotoUnmembers(t *testing.T) {
	lib := &fakeLibrary{
		photos:     map[string]*db.Photo{"p1": {Key: "p1", OwnerID: "owner"}},
		albums:     map[string]*db.AlbumView{"album-1": {ID: "album-1", Name: "Trip", PhotoCount: 1, CoverPhotoID: "p1", PhotoIDs: []string{"p1"}}},
		albumOwner: map[string]string{"album-1": "owner"},
	}
	a := &API{DB: lib}
	r := chi.NewRouter()
	a.Routes(r)

	req := httptest.NewRequest(http.MethodDelete, "/albums/album-1/photos/p1", nil)
	req = withUser(req, "owner")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d %s", w.Code, w.Body.String())
	}
	var view db.AlbumView
	if err := json.Unmarshal(w.Body.Bytes(), &view); err != nil {
		t.Fatal(err)
	}
	if view.PhotoCount != 0 || len(view.PhotoIDs) != 0 {
		t.Fatalf("view %+v", view)
	}

	again := httptest.NewRequest(http.MethodDelete, "/albums/album-1/photos/p1", nil)
	again = withUser(again, "owner")
	rw := httptest.NewRecorder()
	r.ServeHTTP(rw, again)
	if rw.Code != http.StatusOK {
		t.Fatalf("idempotent %d", rw.Code)
	}
}

func TestSetFavoriteRequiresOwner(t *testing.T) {
	lib := &fakeLibrary{photos: map[string]*db.Photo{"p1": {Key: "p1", OwnerID: "owner"}}}
	a := &API{DB: lib}
	r := chi.NewRouter()
	a.Routes(r)

	req := httptest.NewRequest(http.MethodPut, "/photos/p1/favorite", bytes.NewBufferString(`{"favorite":true}`))
	req = withUser(req, "other")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusForbidden {
		t.Fatalf("got %d", w.Code)
	}
}

func TestSetFavoritePersistsFlag(t *testing.T) {
	lib := &fakeLibrary{photos: map[string]*db.Photo{"p1": {Key: "p1", OwnerID: "owner"}}}
	a := &API{DB: lib}
	r := chi.NewRouter()
	a.Routes(r)

	req := httptest.NewRequest(http.MethodPut, "/photos/p1/favorite", bytes.NewBufferString(`{"favorite":true}`))
	req = withUser(req, "owner")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d %s", w.Code, w.Body.String())
	}
	if !lib.photos["p1"].Favorite {
		t.Fatal("expected favorite")
	}
}

func TestPhotosPassesYearAndFavoriteFilters(t *testing.T) {
	lib := &fakeLibrary{photos: map[string]*db.Photo{}}
	a := &API{DB: lib}
	r := chi.NewRouter()
	a.Routes(r)
	req := httptest.NewRequest(http.MethodGet, "/photos?year=2024&favorite=true", nil)
	req = withUser(req, "owner")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d", w.Code)
	}
	if len(lib.filter.Years) != 1 || lib.filter.Years[0] != "2024" {
		t.Fatalf("years %+v", lib.filter.Years)
	}
	if lib.filter.Favorite == nil || !*lib.filter.Favorite {
		t.Fatal("expected favorite filter")
	}
}

func TestPhotosPassesMonthAndLocalTakenAtBounds(t *testing.T) {
	lib := &fakeLibrary{photos: map[string]*db.Photo{}}
	a := &API{DB: lib}
	r := chi.NewRouter()
	a.Routes(r)
	req := httptest.NewRequest(http.MethodGet, "/photos?month=06&local_from=2026-08-25&local_to=2026-08-26", nil)
	req = withUser(req, "owner")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d", w.Code)
	}
	if len(lib.filter.Months) != 1 || lib.filter.Months[0] != "06" {
		t.Fatalf("months %+v", lib.filter.Months)
	}
	if lib.filter.LocalFrom != "2026-08-25" || lib.filter.LocalTo != "2026-08-26" {
		t.Fatalf("local bounds %q %q", lib.filter.LocalFrom, lib.filter.LocalTo)
	}
}
