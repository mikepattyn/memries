package config

import (
	"fmt"
	"os"
)

type Config struct {
	Addr             string
	ArangoURL        string
	ArangoDB         string
	ArangoUser       string
	ArangoPassword   string
	StorageBackend   string
	LocalRoot        string
	CacheRoot        string
	S3Endpoint       string
	S3Bucket         string
	S3AccessKey      string
	S3SecretKey      string
	S3Region         string
	OIDCIssuer       string
	OIDCDiscoveryURL string
	OIDCClientID     string
	OIDCClientSecret string
	OIDCRedirectURL  string
	SessionKey       string
	PublicURL        string
}

func FromEnv() (*Config, error) {
	c := &Config{
		Addr:             env("MEMRIES_ADDR", ":8080"),
		ArangoURL:        env("MEMRIES_ARANGO_URL", "http://localhost:8529"),
		ArangoDB:         env("MEMRIES_ARANGO_DB", "memries"),
		ArangoUser:       env("MEMRIES_ARANGO_USER", "root"),
		ArangoPassword:   os.Getenv("MEMRIES_ARANGO_PASSWORD"),
		StorageBackend:   env("MEMRIES_STORAGE_BACKEND", "local"),
		LocalRoot:        env("MEMRIES_LOCAL_ROOT", "./data/photos"),
		CacheRoot:        env("MEMRIES_CACHE_ROOT", "./data/cache"),
		S3Endpoint:       os.Getenv("MEMRIES_S3_ENDPOINT"),
		S3Bucket:         os.Getenv("MEMRIES_S3_BUCKET"),
		S3AccessKey:      os.Getenv("MEMRIES_S3_ACCESS_KEY"),
		S3SecretKey:      os.Getenv("MEMRIES_S3_SECRET_KEY"),
		S3Region:         env("MEMRIES_S3_REGION", "us-east-1"),
		OIDCIssuer:       os.Getenv("MEMRIES_OIDC_ISSUER"),
		OIDCDiscoveryURL: os.Getenv("MEMRIES_OIDC_DISCOVERY_URL"),
		OIDCClientID:     os.Getenv("MEMRIES_OIDC_CLIENT_ID"),
		OIDCClientSecret: os.Getenv("MEMRIES_OIDC_CLIENT_SECRET"),
		OIDCRedirectURL:  os.Getenv("MEMRIES_OIDC_REDIRECT_URL"),
		SessionKey:       os.Getenv("MEMRIES_SESSION_KEY"),
		PublicURL:        env("MEMRIES_PUBLIC_URL", "http://localhost"),
	}
	if c.ArangoPassword == "" {
		return nil, fmt.Errorf("MEMRIES_ARANGO_PASSWORD required")
	}
	if c.SessionKey == "" {
		return nil, fmt.Errorf("MEMRIES_SESSION_KEY required")
	}
	if c.OIDCIssuer == "" || c.OIDCClientID == "" || c.OIDCClientSecret == "" || c.OIDCRedirectURL == "" {
		return nil, fmt.Errorf("OIDC config incomplete")
	}
	return c, nil
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
