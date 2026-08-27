# [P2] Version stale thumbnails after reindex

Agent-pickup ticket. Decisions are **locked**. Seams are **confirmed**. Follow `tdd` (red → green at those seams). Do not reopen cache policy, thumb disk layout, or compact-size rules.

## Problem

After a path-first folder Sync, the Photo **`_key` stays** and the content **`hash` changes**. Disk Thumbs are overwritten in place under the same identity path. The SPA still requests `/api/thumb/{id}?size=…` with no version. The thumb handler answers with `Cache-Control: private, max-age=31536000, immutable`. Under RFC 8246 / RFC 9111, a cached Thumb stays fresh for a year and clients should not revalidate it. The browser keeps showing the old JPEG even though bytes on disk and `hash` in Arango are new.

## Evidence

Glossary ([CONTEXT.md](../../CONTEXT.md)): a **Photo** is an indexed still; `_key` is stable identity; `hash` is the content fingerprint and may change when the file is rewritten. A **Thumb** is a 256 / 512 / 1024 JPEG on disk (Arango stores only the path). An **Original** is the source file on Storage, streamed by `/api/original/{id}`.

ADR [0005](../adr/0005-capture-time-stable-identity.md): `_key` is stable on Sync so favorites and Album membership survive; `hash` may change. `ResolveIdentity` is path-first (`backend/internal/index/identity.go`): owner path match → `IdentityUpdate` + existing key. Proof: `TestResolveIdentityKeepsKeyWhenPathMatchesAndHashChanges`; indexer resync keeps one key, keeps favorite, expects a new hash (`backend/internal/index/indexer_test.go`).

ADR [0007](../adr/0007-viewport-forced-compact-thumbs.md): compact grids use `size=256` at viewport ≥1280px, else `512`. Day / featured stay 1024. Do not change those size rules.

Thumb handler ([backend/internal/api/api.go](../../backend/internal/api/api.go) `thumb`):

```
Cache-Control: private, max-age=31536000, immutable
```

Original handler (`original`) is `private, max-age=86400` with no `immutable` (out of scope; one sentence below).

`writeJSON` encodes `db.Photo` as-is. The model already has `Hash string \`json:"hash"\`` ([backend/internal/db/models.go](../../backend/internal/db/models.go)). `GET /api/photos` and `GET /api/photos/{id}` therefore already emit `hash`. No backend DTO strips it. The gap is the SPA: `ApiPhoto` and `Photo` omit `hash`; `mapPhoto` does not copy it.

SPA URL builders ([frontend/src/lib/photoSrc.ts](../../frontend/src/lib/photoSrc.ts)):

```
thumbUrl(id, size) → `/api/thumb/${encodeURIComponent(id)}?size=${size}`
```

No `v` query. `timelineSrc` / `compactThumbUrl` / `viewerFallbackSrc` all go through that helper. `mapPhoto` also hard-codes `thumbnailUrl: /api/thumb/{id}?size=512` without `v`.

Disk Thumbs are keyed by stable Photo `_key`, not content hash. Indexer calls `Thumb.Generate(keepKey, …)` ([backend/internal/index/indexer.go](../../backend/internal/index/indexer.go)). `Generate` writes `filepath.Join(photoKey[:2], photoKey, sizeName(size))` → `{key[:2]}/{key}/s.jpg` (256), `m.jpg` (512), `l.jpg` (1024) ([backend/internal/thumb/thumb.go](../../backend/internal/thumb/thumb.go)). After path-first Sync the ID stays, bytes and `hash` change, the file is overwritten, and a URL without `v` stays stale for a year.

RFC 8246 (immutable responses) and RFC 9111 (HTTP caching): when `immutable` is on a successful response, clients and intermediaries should not revalidate that representation during its freshness lifetime (`max-age`). A year-long private immutable cache cannot be busted by “please refetch the same URL.” Changing the URL when content changes is the spec-aligned bust. `v` is a cache key for the browser; the server may ignore it.

No `*_test.go` asserts thumb `Cache-Control`. Do not invent an HTTP cache integration test. Do not test Cache-Control in a browser.

## Decision (locked)

Keep the long-lived **private** cache **and** `immutable` on Thumbs. Bust by changing the URL when content changes.

- Add the Photo content `hash` to Thumb URLs as a version query (`v=`), e.g. `/api/thumb/{id}?size=256&v={hash}`, from [frontend/src/lib/photoSrc.ts](../../frontend/src/lib/photoSrc.ts).
- Expose `hash` on the Photo JSON DTO if missing (`mapPhoto` in [frontend/src/lib/api.ts](../../frontend/src/lib/api.ts); backend photo JSON already has `hash` — confirmed above).
- Server may ignore `v`. Do **not** remove or weaken `Cache-Control: private, max-age=31536000, immutable` on the `thumb` handler.
- Do not change thumb disk layout. Do not change ADR 0007 size rules.
- Originals stay `max-age=86400` without `immutable`; leave that handler alone.

## Context map

### Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| [frontend/src/lib/photoSrc.ts](../../frontend/src/lib/photoSrc.ts) | Public Thumb URL helpers | `thumbUrl` (and wrappers) take content `hash` and append `&v={hash}` |
| [frontend/src/lib/api.ts](../../frontend/src/lib/api.ts) | `ApiPhoto` → `Photo` | `ApiPhoto.hash`; `mapPhoto` copies `hash` onto `Photo`; `thumbnailUrl` should use the same `v` if still emitted |
| [frontend/src/models/photo.ts](../../frontend/src/models/photo.ts) | UI Photo | Add `hash` (content fingerprint; not `_key`) |

### Dependencies (may need updates)

| File | Relationship |
|------|--------------|
| [frontend/src/components/PhotoCard.tsx](../../frontend/src/components/PhotoCard.tsx) | `timelineSrc(photo, …)` — `src` query changes once helpers take `hash` |
| [frontend/src/components/SearchView.tsx](../../frontend/src/components/SearchView.tsx) | `compactThumbUrl(photo.id, …)` today — must pass `hash` |
| [frontend/src/components/PhotoViewer.tsx](../../frontend/src/components/PhotoViewer.tsx) | `viewerFallbackSrc(photo)` on Original error |
| [frontend/src/components/AlbumsView.tsx](../../frontend/src/components/AlbumsView.tsx) | Cover uses `thumbUrl(coverId, coverSize)` with **id only**. Album list JSON has `cover_photo_id`, not cover `hash`. Either thread a hash when a Photo is in hand, or leave covers without `v` (covers can stay stale). Do not invent a cover-hash API unless a confirmed seam is extended. |
| [frontend/src/test/fixtures.ts](../../frontend/src/test/fixtures.ts) | `testPhoto()` must supply `hash` once the field is required |
| [frontend/src/lib/groupPhotos.test.ts](../../frontend/src/lib/groupPhotos.test.ts) | Local `Photo` fixtures will need `hash` if the type requires it |

### Test Files

| Test | Coverage |
|------|----------|
| [frontend/src/lib/photoSrc.test.ts](../../frontend/src/lib/photoSrc.test.ts) | First red test; extend existing `thumbUrl` / `timelineSrc` / `viewerFallbackSrc` cases with literal URLs that include `v` |
| [frontend/src/lib/api.test.ts](../../frontend/src/lib/api.test.ts) | Second slice: `mapPhoto` exposes `hash`; update the existing `toEqual` for `abc123` |

### Reference Patterns

| File | Pattern |
|------|---------|
| [frontend/src/lib/photoSrc.ts](../../frontend/src/lib/photoSrc.ts) | Existing `?size=` query; add `v` the same way |
| [frontend/src/lib/api.test.ts](../../frontend/src/lib/api.test.ts) | Literal mapped Photo object (not recomputed) |
| [docs/adr/0007-viewport-forced-compact-thumbs.md](../adr/0007-viewport-forced-compact-thumbs.md) | Size 256 vs 512 — leave rules as-is |

### Risk Assessment

- [x] Breaking changes to public API — `thumbUrl` / `compactThumbUrl` / `timelineSrc` / `viewerFallbackSrc` signatures and `Photo` shape
- [ ] Database migrations needed
- [ ] Configuration changes required

## Confirmed seams

TDD only at these seams. Tests at public helpers, not UI widgets, not the thumb HTTP handler (unless a test already exists — none does).

1. `frontend/src/lib/photoSrc.ts` — `thumbUrl` / `timelineSrc` / `viewerFallbackSrc` (and `compactThumbUrl` as a thin wrapper).
2. `frontend/src/lib/api.ts` — `mapPhoto` must carry `hash` onto `Photo`.

## First red test

File: `frontend/src/lib/photoSrc.test.ts`. Extend the existing `photoSrc` describe. Do not replace the 0007 size cases.

Name: **`thumbUrl includes content hash as v query`**

Expected value is a **known literal URL**, not `thumbUrl(...)` recomputed and compared to itself.

Example (use this shape; ids may match the existing `abc123` fixture):

```ts
it("thumbUrl includes content hash as v query", () => {
  expect(thumbUrl("abc123", 256, "deadbeef")).toBe(
    "/api/thumb/abc123?size=256&v=deadbeef",
  );
});
```

Then extend the existing `timelineSrc` / `viewerFallbackSrc` assertions so their expected strings are literals that include `&v=…` once those helpers take `hash` from `Pick<Photo, "id" | "hash" | …>`.

Second slice (after the first is green): in `api.test.ts`, `mapPhoto` exposes `hash`. Extend `ApiPhoto` with `hash`, pass a literal hash in the existing `abc123` case, and expect `photo.hash` (and a `thumbnailUrl` that includes `v` if that field still mirrors `thumbUrl`). Literal object / field, not a recomputed URL from `thumbUrl`.

## Implementation notes

- Skills: `tdd` for both slices. `responsive-frontend` if any `src` attribute wiring changes (PhotoCard, SearchView, viewer fallback, album cover). Query-only: **no visual change expected** — still run the skill if you touch those `src`s.
- `v` is a cache key. Do not read `r.URL.Query().Get("v")` in `thumb` unless you already have another reason. Do not add ETag / Last-Modified as the bust strategy.
- Keep query order `size` then `v` so tests can use one literal (`?size=256&v=deadbeef`).
- Encode `id` with `encodeURIComponent` as today. `hash` is hex from sha256; no extra encoding required in tests.
- Thread `hash` through helpers. Call sites that only have an id (album cover) cannot bust until a Photo `hash` is in hand — do not expand album JSON unless a later ticket says so.
- After `mapPhoto` carries `hash`, a completed Index run already invalidates the photos query (`shouldInvalidatePhotos` in `frontend/src/lib/indexStatus.ts`). New JSON + new `v` is what makes the immutable cache miss. Do not add a service worker or CDN rule.
- Do not test Cache-Control via a browser. Optional api-level assertion only if an existing thumb handler test exists (it does not). Do not invent HTTP cache integration tests.
- Do not change compact size selection (`compactThumbSize` / ADR 0007).

## Acceptance

- `thumbUrl` (and `timelineSrc` / `viewerFallbackSrc`) produce `/api/thumb/{id}?size={size}&v={hash}` with a literal expected URL in `photoSrc.test.ts`.
- `mapPhoto` copies API `hash` onto `Photo.hash`.
- Thumb `Cache-Control` is still `private, max-age=31536000, immutable`.
- Compact grids still request 256 at viewport ≥1280px, else 512; day / featured still 1024.
- After path-first Sync (same `_key`, new `hash`, overwritten `{key[:2]}/{key}/s.jpg`), the next photo list yields a new Thumb URL and the browser fetches new bytes.

## Out of scope

- CDN cache keys or purge
- Service worker caching
- ETag-only / revalidation-only strategy (conflicts with locked `immutable`)
- Changing thumb disk layout to content-hash paths (`ab/<hash>/…` instead of `_key`)
- Weakening or removing Thumb `immutable` / year `max-age`
- Changing Original cache (`max-age=86400`, no `immutable`) except to leave it alone
- Changing ADR 0007 size rules or introducing `srcset`
- Browser or invented HTTP-level Cache-Control tests
