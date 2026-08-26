# Memries — Agent Guide

## This workspace

This repository is Memries only. Work inside this folder. Do not open, edit, or depend on parent directories, sibling apps, or paths outside this repo (including external phased-plan notes). Human onboarding lives in [README.md](README.md); this file is for agents.

## Before changing code

1. Read this file and [CONTEXT-MAP.md](CONTEXT-MAP.md).
2. Run the `context-map` workflow for the task and wait for review.
3. Then implement.

Do not invent a parallel workflow when a listed skill already owns it.

## Product / Phase 1

Lightweight photo manager: date-scroll timeline with year / month / week / day granularity.

In scope:

- Timeline browse (virtual scroll, lightbox)
- OIDC cookie session (Dex in local Compose)
- Indexer CLI (EXIF, sha256 dedup, 256 / 512 / 1024 thumbs)
- Local filesystem storage
- Per-owner ACL (`session user key` vs `photo.owner_id`)

Out of scope unless the user asks: video, S3 storage, WebSockets, sharing graph, Piwigo import.

## Stack

- Go 1.23 module `github.com/memries/memries` — chi, Arango driver, OIDC, gorilla sessions, imaging
- React 18 + Vite + Tailwind + TanStack Query + virtua
- ArangoDB, Dex, Caddy, Docker Compose

## Non-negotiables

- Do not leave this repository.
- Do not deploy infrastructure or mutate remote environments. Do not run Compose against a remote host.
- Do not commit `.env` or `data/`. Do not put secrets in docs.
- Commit only when the user asks.
- Ignore README pointers that leave this folder.

## How to run

Follow the README quick start (Compose + `.env`). Initial index:

```bash
docker compose exec backend indexer -owner admin@example.com -prefix admin@example.com
```

Dev login is documented in [deploy/dex/config.yaml](deploy/dex/config.yaml). Troubleshooting and host ports are in the README.

## Seams

Public seams for new behavior and tests:

- HTTP: [backend/internal/api](backend/internal/api/api.go) and [backend/internal/auth](backend/internal/auth/auth.go)
- Storage: [backend/internal/storage](backend/internal/storage/storage.go)
- Schema and queries: [backend/internal/db](backend/internal/db/arango.go)

There is no test suite yet. New tests belong next to those seams (`*_test.go` / frontend tests), not inside UI widgets.

## Skills

- `context-map` — before any feature or bug work
- `tdd` — when adding tests
- `responsive-frontend` — any visual change under `frontend/`
- `page-accessibility` — WCAG work on one Memories / Albums / Search / viewer surface
- `frontend-page-accessibility` / `frontend-lint` / `frontend-format` — React + Vite + Tailwind tree under `frontend/`
- `backend-lint` / `backend-format` — Go (`gofmt` / `go vet`) under `backend/`
- `platform-lint` / `platform-format` — `e2e/` and `scripts/`
- `e2e-docker` — one Docker Playwright feature per worktree (max 20 stacks; setup + run + merge `e2e/` only). `--force` reruns every feature and refreshes last-runs. Shelf: [`.cursor/skills/e2e-docker/`](.cursor/skills/e2e-docker/)
- `platform-quality` — user-invoked only: page-accessibility → e2e-docker → lint → format. No scripts-to-node wave

## Scripts

New or edited scripts live in `scripts/<name>/` as a unit-tested Node `.mjs` plus Unix and PowerShell wrappers. See [`.cursor/rules/dual-shell-scripts.mdc`](.cursor/rules/dual-shell-scripts.mdc).
