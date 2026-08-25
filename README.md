# Memries

Lightweight photo manager. Replaces Piwigo. Modern UI focused on date-scroll browsing with switchable granularity (year / month / week / day).

**Stack:** Go backend · ArangoDB · React + Vite · OIDC (Dex) · Caddy reverse proxy · Docker Compose.

## Status

Phase 1 (MVP) running:

- [x] Repo + Docker Compose (Arango, Dex, Caddy, backend, frontend)
- [x] Pluggable storage interface (local FS impl; S3 in Phase 3)
- [x] Arango schema bootstrap (photos, users, albums + edges)
- [x] Photo indexer CLI (EXIF, sha256 dedup, 3-tier thumbs)
- [x] OIDC auth (Dex provider, cookie session)
- [x] Timeline + photos API with per-owner ACL
- [x] React timeline UI: virtual scroll, granularity toggle, lightbox

Not in Phase 1: video, S3 backend, WebSocket live updates, sharing graph, Piwigo importer.

## Quick start

Prereqs: Docker Desktop (Compose v2), `openssl`.

```bash
# Write .env with strong random secrets
cat > .env <<EOF
ARANGO_PASSWORD=$(openssl rand -hex 16)
OIDC_CLIENT_SECRET=memries-dev-secret
SESSION_KEY=$(openssl rand -base64 32)
EOF

# Drop photos into ./data/photos/<owner-email>/...
mkdir -p data/photos/admin@example.com

docker compose build
docker compose up -d

# Initial index
docker compose exec backend indexer -owner admin@example.com -prefix admin@example.com
```

Open http://localhost — login with `admin@example.com` / `password` (dev only — change `deploy/dex/config.yaml`).

> **Note:** ArangoDB sets the root password on **first init only**. Change `ARANGO_PASSWORD` after that and the DB will reject auth. To reset:
> `docker compose down && docker volume rm memries_arango_data memries_arango_apps && docker compose up -d`

## Layout

```
backend/             Go server + indexer CLI
  cmd/server         HTTP API
  cmd/indexer        bulk import CLI
  internal/
    config           env loader
    storage          Storage interface + local impl
    db               Arango client, models, queries
    exif             EXIF extraction
    thumb            thumbnail generation (256/512/1024)
    index            walker/indexer pipeline
    auth             OIDC + cookie session middleware
    api              chi routes (timeline, photos, thumb, original)
frontend/            React + Vite + Tailwind
  src/
    components       Timeline, GranularityToggle, Lightbox
    lib              api client, date helpers
deploy/
  caddy/Caddyfile    routes /api, /oauth
  dex/config.yaml    OIDC provider for dev
data/
  photos/            originals (mounted into backend)
  cache/             thumbnails (mounted into backend)
```

## Service topology

| Service   | Listens on (host)       | Notes                                              |
|-----------|-------------------------|----------------------------------------------------|
| caddy     | `:80`                   | Reverse proxy: `/api/*` + `/oauth/*` → backend; `/` → frontend |
| backend   | `127.0.0.1:8080`        | Go API. `extra_hosts: localhost:host-gateway` so it can reach dex at `localhost:5556` |
| frontend  | `127.0.0.1:5173`        | Nginx serving built React. Behind caddy at `/`     |
| arangodb  | `127.0.0.1:8529`        | UI/REST                                            |
| dex       | `127.0.0.1:5556`        | OIDC issuer `http://localhost:5556` (browser + backend both hit this URL) |

### URL routes via Caddy `:80`

- `/`             → frontend (built React + Tailwind)
- `/api/*`        → backend (auth required)
- `/oauth/login`  → backend → 302 to dex
- `/oauth/callback` → backend (cookie session set)
- `/oauth/logout` → backend

### Why dex isn't behind caddy

`docker compose` can't fully resolve the cycle (backend needs OIDC discovery at boot, caddy reverse-proxies backend → caddy depends on backend → caddy not up when backend starts). Simpler: expose dex on `:5556`, set issuer = `http://localhost:5556`, add `extra_hosts: "localhost:host-gateway"` to backend so it reaches dex via the host port mapping.

## Data model (Arango)

- `photos` — keyed by sha256, fields: `kind`, `taken_at`, `owner_id`, `storage{}`, `dims{}`, `exif{}`, `thumbs{}`
- `users` — keyed by sha1(email)
- `albums`
- Edge collections: `owns`, `shared_with`, `in_album`, `album_shared` (used in later phases)

Indexes: persistent `taken_at`, `(owner_id, taken_at)`, unique `hash`, unique `email`.

## Photo layout convention

Indexer walks the storage prefix. Recommended layout:

```
data/photos/<owner-email>/<yyyy>/<mm>/<file>.jpg
```

Indexer accepts any prefix — pass `-prefix admin@example.com` to limit to one user.

## Dev mode (without Docker)

```bash
# Start dependencies via compose
docker compose up -d arangodb dex caddy frontend

# Backend
cd backend
export $(grep -v '^#' ../.env | xargs)
export MEMRIES_ARANGO_URL=http://localhost:8529
export MEMRIES_OIDC_ISSUER=http://localhost:5556
export MEMRIES_LOCAL_ROOT=../data/photos
export MEMRIES_CACHE_ROOT=../data/cache
go mod tidy
go run ./cmd/server

# Frontend (in another shell)
cd frontend
npm install
npm run dev
```

## Troubleshooting

- **`backend ... level=ERROR msg=auth err="..."`** — OIDC discovery failed. Verify dex container running (`docker compose ps`) and `MEMRIES_OIDC_ISSUER` matches dex's `issuer:` in `deploy/dex/config.yaml`. After editing dex config: `docker compose up -d --force-recreate dex`.
- **`db password is wrong` / `not authorized to execute this request`** — `.env` was missing/changed after Arango first init. Reset: `docker compose down && docker volume rm memries_arango_data memries_arango_apps && docker compose up -d`.
- **`container memries-arangodb-1 is unhealthy`** — Healthcheck targets `http://127.0.0.1:8529/_admin/server/availability` (auth-free). If broken, exec into the container and run that wget yourself to see what's happening.
- **`unknown flag --build`** — Two-step instead: `docker compose build && docker compose up -d`.

## Next phases

See `~/.claude/projects/-Users-mvergouwe-Projects-Memries/memory/project_photo_manager.md` for the full phased plan. Phase 2 = video; Phase 3 = S3 + WebSocket live updates; Phase 4 = sharing graph + Piwigo importer.

- [ ] Wire the frontend indexing splash to the real Go indexer / photos API (today it is a simulated wait over the Vite disk scan + mock API).
- [ ] Persist albums (and favorites) beyond the in-memory mock store.
