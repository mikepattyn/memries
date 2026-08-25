package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/gob"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/gorilla/sessions"
	"golang.org/x/oauth2"

	"github.com/memries/memries/internal/config"
	"github.com/memries/memries/internal/db"
)

const sessionName = "memries"

type ctxKey int

const userKey ctxKey = 1

type SessionUser struct {
	Key   string
	Email string
	Name  string
}

func init() {
	gob.Register(&SessionUser{})
}

type Auth struct {
	cfg      *config.Config
	store    *sessions.CookieStore
	verifier *oidc.IDTokenVerifier
	oauth    *oauth2.Config
	db       *db.Client
}

func New(ctx context.Context, cfg *config.Config, dbc *db.Client) (*Auth, error) {
	key, err := base64.StdEncoding.DecodeString(cfg.SessionKey)
	if err != nil || len(key) < 32 {
		return nil, errors.New("MEMRIES_SESSION_KEY must be base64-encoded, at least 32 bytes")
	}
	store := sessions.NewCookieStore(key)
	store.Options = &sessions.Options{
		Path:     "/",
		MaxAge:   60 * 60 * 24 * 30,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	}
	discoveryCtx := ctx
	if cfg.OIDCDiscoveryURL != "" && cfg.OIDCDiscoveryURL != cfg.OIDCIssuer {
		discoveryCtx = oidc.InsecureIssuerURLContext(ctx, cfg.OIDCIssuer)
		// Use discovery URL as the provider lookup but trust stated issuer.
		provider, err := oidc.NewProvider(discoveryCtx, cfg.OIDCDiscoveryURL)
		if err != nil {
			return nil, err
		}
		oa := &oauth2.Config{
			ClientID:     cfg.OIDCClientID,
			ClientSecret: cfg.OIDCClientSecret,
			Endpoint:     provider.Endpoint(),
			RedirectURL:  cfg.OIDCRedirectURL,
			Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
		}
		v := provider.Verifier(&oidc.Config{ClientID: cfg.OIDCClientID})
		return &Auth{cfg: cfg, store: store, verifier: v, oauth: oa, db: dbc}, nil
	}
	provider, err := oidc.NewProvider(ctx, cfg.OIDCIssuer)
	if err != nil {
		return nil, err
	}
	oa := &oauth2.Config{
		ClientID:     cfg.OIDCClientID,
		ClientSecret: cfg.OIDCClientSecret,
		Endpoint:     provider.Endpoint(),
		RedirectURL:  cfg.OIDCRedirectURL,
		Scopes:       []string{oidc.ScopeOpenID, "profile", "email"},
	}
	v := provider.Verifier(&oidc.Config{ClientID: cfg.OIDCClientID})
	return &Auth{cfg: cfg, store: store, verifier: v, oauth: oa, db: dbc}, nil
}

func (a *Auth) LoginHandler(w http.ResponseWriter, r *http.Request) {
	state, err := randomString(24)
	if err != nil {
		http.Error(w, "rand", http.StatusInternalServerError)
		return
	}
	sess, _ := a.store.Get(r, sessionName)
	sess.Values["oauth_state"] = state
	if err := sess.Save(r, w); err != nil {
		http.Error(w, "session save", http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, a.oauth.AuthCodeURL(state), http.StatusFound)
}

func (a *Auth) CallbackHandler(w http.ResponseWriter, r *http.Request) {
	sess, _ := a.store.Get(r, sessionName)
	wantState, _ := sess.Values["oauth_state"].(string)
	delete(sess.Values, "oauth_state")
	if wantState == "" || r.URL.Query().Get("state") != wantState {
		http.Error(w, "bad state", http.StatusBadRequest)
		return
	}
	code := r.URL.Query().Get("code")
	tok, err := a.oauth.Exchange(r.Context(), code)
	if err != nil {
		http.Error(w, "exchange: "+err.Error(), http.StatusUnauthorized)
		return
	}
	rawID, ok := tok.Extra("id_token").(string)
	if !ok {
		http.Error(w, "no id_token", http.StatusUnauthorized)
		return
	}
	idToken, err := a.verifier.Verify(r.Context(), rawID)
	if err != nil {
		http.Error(w, "verify: "+err.Error(), http.StatusUnauthorized)
		return
	}
	var claims struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	}
	if err := idToken.Claims(&claims); err != nil {
		http.Error(w, "claims", http.StatusUnauthorized)
		return
	}
	if claims.Email == "" {
		http.Error(w, "email claim missing", http.StatusUnauthorized)
		return
	}
	u, err := a.db.UpsertUserByEmail(r.Context(), claims.Email, claims.Name)
	if err != nil {
		http.Error(w, "user upsert: "+err.Error(), http.StatusInternalServerError)
		return
	}
	sess.Values["user"] = &SessionUser{Key: u.Key, Email: u.Email, Name: u.Name}
	if err := sess.Save(r, w); err != nil {
		http.Error(w, "session save", http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/", http.StatusFound)
}

func (a *Auth) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	sess, _ := a.store.Get(r, sessionName)
	sess.Options.MaxAge = -1
	_ = sess.Save(r, w)
	http.Redirect(w, r, "/", http.StatusFound)
}

func (a *Auth) MeHandler(w http.ResponseWriter, r *http.Request) {
	u, ok := UserFromContext(r.Context())
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(u)
}

func (a *Auth) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sess, _ := a.store.Get(r, sessionName)
		u, _ := sess.Values["user"].(*SessionUser)
		if u == nil || u.Key == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), userKey, u)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserFromContext(ctx context.Context) (*SessionUser, bool) {
	u, ok := ctx.Value(userKey).(*SessionUser)
	return u, ok && u != nil
}

func randomString(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
