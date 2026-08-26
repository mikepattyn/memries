# Isolated Playwright BDD

Real-stack browser tests against a **separate** Compose project (default `memries-e2e`). They do not share ports or volumes with `make up`. A second instance (for example a worktree fan-out) must set `MEMRIES_E2E_PROJECT` plus the `*_HOST_PORT` band starting at `19000` so it does not steal `18080`.

## First run

1. Docker Desktop (Compose v2) running.
2. App `.env` present (same secrets as local dev: `ARANGO_PASSWORD`, `OIDC_CLIENT_SECRET`, `SESSION_KEY`).
3. Chromium for Playwright, once per machine:

```bash
cd e2e
npm install
npx playwright install chromium
```

4. The first `docker compose` build of backend + frontend is slow (often several minutes). Playwright waits up to 3 minutes for http://localhost:18080. If that is tight on a cold machine, start the stack yourself, then re-run tests (non-CI reuses an already-listening server):

```bash
npm run stack:up
npm test
```

`make e2e` from the app root is the same as `npm test` in `e2e/`.

Login is Dex `admin@example.com` / `password`. Fixture JPEGs live in `e2e/.work/photos/admin@example.com/` and are regenerated before every `stack:up`.

## Cleanup

```bash
make e2e-down
# or: npm run stack:down --prefix e2e
```

That stops containers and keeps named volumes (`arango_e2e_data`, and so on). To wipe volumes:

```bash
npm run stack:wipe --prefix e2e
```

`.work/` photos/cache/generated Dex, `.features-gen/`, and `node_modules/` are gitignored. This does not touch `./data/photos` from the developer stack.

## One feature / one stack

```bash
MEMRIES_E2E_FEATURE=timeline.feature \
MEMRIES_E2E_PROJECT=e2e-memries-timeline \
CADDY_HOST_PORT=19000 BACKEND_HOST_PORT=19001 FRONTEND_HOST_PORT=19002 \
ARANGO_HOST_PORT=19003 DEX_HOST_PORT=19004 \
npm test
```

After the run, wipe that project so the next slice can reuse the port band:

```bash
MEMRIES_E2E_PROJECT=e2e-memries-timeline npm run stack:wipe
```
