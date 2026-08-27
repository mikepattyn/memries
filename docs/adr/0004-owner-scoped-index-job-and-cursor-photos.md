# 0004. Owner-scoped HTTP index job and cursor-paginated Photos

- Status: Accepted
- Date: 2026-08-26
- Source type: Internal decision (implementation + domain language)

## Key thesis

The signed-in Owner starts and watches indexing from the browser. The job always walks `data/photos/<email>`; the client never sends a path. After that, the SPA catalogs Photos only through the authenticated Go API, using a composite cursor so equal capture times are not skipped. The indexer CLI stays an idempotent fallback.

## Context

The Memories splash used to wait on a Vite disk catalog and an in-memory mock. Production nginx never ran that plugin, so a Compose build could not show the Owner’s library. Two questions locked the replacement:

1. **Who starts indexing?** The browser, not a one-off wrapper script. The CLI remains for recovery and machines without a session.
2. **Which folder?** Only the signed-in email prefix. A client-supplied path would be a traversal hole.

A third gap sat on the read path: `GET /api/photos` needed a stable page when many Photos share the same TakenAt.

This ADR is the catalog and job boundary. Timeline Groups stay in the SPA ([0002](0002-spa-owned-timeline-groups.md)). Capture clock and Photo `_key` rules live in [0005](0005-capture-time-stable-identity.md). Clearing Arango to force another Index run is [0006](0006-truncate-arango-for-resync.md).

## Decision

### Browser-started Index run

`GET /api/index/status` and `POST /api/index` are session-authenticated. Prefix and Owner come from the session email (`PrefixFromEmail`); the body cannot name a folder. The HTTP server runs the same `index.Indexer` through an in-process coordinator with one job slot.

Persisted state is one `index_runs` document per Owner (`_key` = owner id). Phases: `not_started`, `queued`, `running`, `complete`, `complete_with_errors`, `failed`. Empty successful scans persist so the splash does not loop. A library that already has Photos (CLI or prior job) is treated as complete unless the folder grew or recent Originals are missing. Interrupted `queued` / `running` rows are marked failed on process start (`Reconcile`) and on the next status read.

The splash auto-starts on `not_started`, polls while `queued` or `running`, and loads Photos once `complete` or `complete_with_errors`. Retry is for `failed` only.

### CLI fallback

`backend/cmd/indexer` still accepts `-owner` and `-prefix`. It is the same indexer, not a second catalog. Hash-skip unless `-force`. Operators use it when the browser cannot run, or to import a prefix that is not the session email (HTTP will not do that).

### SPA catalogs through the API

Authenticated `fetch` with cookies; 401 sends the browser to `/oauth/login`. DTOs map `_key` → `id` and `/api/thumb` + `/api/original` URLs. TanStack `useInfiniteQuery` pages `/api/photos`; Timeline loads the next page near the end of the virtual list. Client-side `groupPhotos` still owns Granularity. The Vite `virtual:memries-photos` plugin and photo mocks are deleted. Albums are a separate persisted concern ([0005](0005-capture-time-stable-identity.md)), not a leftover mock catalog.

### Composite cursor

`GET /api/photos` sorts `(taken_at DESC, _key DESC)`. The opaque cursor is `RFC3339Nano|key`. The query fetches `limit + 1` (handler default 50 from the SPA, clamp default 200, max 500) and emits `next_cursor` only when another page exists. Equal TakenAt values stay stable because `_key` is the tiebreaker — whatever `_key` means after [0005](0005-capture-time-stable-identity.md).

## Key findings

1. **A wrapper “load into Arango once” script is the wrong seam.** The indexer already exists. The missing piece was a coordinator the splash can start and poll. A second catalog (SQLite, Vite JSON, or a one-shot script) would drift from `index.Indexer`.
2. **The client must not choose the folder.** `PrefixFromEmail` rejects empty, `.`, `..`, and any `/`, `\`, or `:`. HTTP scope is always the lowercased email.
3. **`taken_at` alone is not a keyset.** Photos that share a capture clock would skip or repeat across pages. The composite `(taken_at, _key)` cursor and `limit + 1` clip are the proof (`db/cursor_test.go`).
4. **CLI-populated libraries must not look like `not_started`.** Status infers `complete` from an existing Photo count so a first login after `indexer` does not rewrite the library. Disk-count and missing-Original probes can still force `not_started` for a rescan.

## Methodology

Decisions were locked in the implementation plan (browser job, user prefix), then written test-first at the public seams: `index/coordinator_test.go`, `index/scope_test.go`, `db/cursor_test.go`, `lib/indexStatus.test.ts`, `lib/api.test.ts`. Compose `/api/index/status` and `/api/photos` return 401 without a session. End-to-end login + splash was not fully driven in the agent browser (Dex form blocked); operators confirm that path by hand.

## Consequences

- First login after an empty catalog starts an Index run for `data/photos/<signed-in-email>` and then pages Photos.
- Production frontend images no longer depend on a Vite disk scan.
- One in-process slot: a second Owner waits at `queued` until the slot frees. This is not a multi-replica queue.
- Search and Favorites use the same `/api/photos` cursor with filters (`q`, `favorite`, `year`, `month`, `local_from`, `local_to`); they are not a second in-memory catalog. See [0008](0008-smart-date-search.md).
- `AGENTS.md` still shows the CLI as “initial index.” Prefer the splash; keep the CLI command as fallback.

## Limitations

- No WebSockets; the splash polls (~750 ms) while the job is active.
- Interrupted runs are failed, not auto-resumed. The Owner retries from the splash.
- HTTP cannot index another prefix. The CLI can; that library will look complete to the splash if Photos already exist for the session Owner.
- Favorites and Albums are owner-persisted ([0005](0005-capture-time-stable-identity.md)); this ADR does not redefine them.
- Sharing remains schema-only.

## Actionable takeaways

- Do not add a second Photo catalog beside Arango.
- Do not accept a path on `POST /api/index`.
- When changing page order, keep `(taken_at DESC, _key DESC)` and the composite cursor tests.
- After `make db-clear`, expect the splash to start a new Index run ([0006](0006-truncate-arango-for-resync.md)).

## Quality

| Dimension   | Rating | Note |
| ----------- | ------ | ---- |
| Credibility | High   | First-party decision, coded in this repo |
| Evidence    | High   | Seam tests for coordinator, prefix, cursor, and API mapping |
| Recency     | High   | Accepted 2026-08-26 |
| Objectivity | High   | Product/security trade-off, not a vendor comparison |

**Overall:** Strong — cite as the index-job and photo-page source of truth.

## References

- Domain language: [CONTEXT.md](../../CONTEXT.md)
- Job: [backend/internal/index/coordinator.go](../../backend/internal/index/coordinator.go), [scope.go](../../backend/internal/index/scope.go), [backend/internal/api/index.go](../../backend/internal/api/index.go)
- Pages: [backend/internal/db/cursor.go](../../backend/internal/db/cursor.go), [photos.go](../../backend/internal/db/photos.go)
- Splash: [frontend/src/hooks/useIndex.ts](../../frontend/src/hooks/useIndex.ts), [usePhotos.ts](../../frontend/src/hooks/usePhotos.ts), [lib/indexStatus.ts](../../frontend/src/lib/indexStatus.ts)
- Timeline Groups (SPA): [0002-spa-owned-timeline-groups.md](0002-spa-owned-timeline-groups.md)
- Capture / identity (do not contradict): [0005-capture-time-stable-identity.md](0005-capture-time-stable-identity.md)
- Catalog reset: [0006-truncate-arango-for-resync.md](0006-truncate-arango-for-resync.md)
