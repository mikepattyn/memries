# [P2] Photos before 1970 are indexed but never returned

Agent-pickup ticket. Decisions and seams are **locked**. Implement test-first (`tdd`). Do not invent a parallel workflow.

Glossary: **Photo**, **TakenAt** — [CONTEXT.md](../../CONTEXT.md). Capture clock and query window: [ADR 0005](../adr/0005-capture-time-stable-identity.md).

## Problem

A Photo whose **TakenAt** is before 1970-01-01 UTC is indexed and stored, then dropped on every default catalog read.

`parseRange` (empty `from` / `to`) hard-codes the window **1970-01-01 … 2100-01-01 UTC**. Memories calls `GET /api/photos` without `from`/`to` ([frontend/src/lib/api.ts](../../frontend/src/lib/api.ts) `fetchPhotosPage`). AQL then applies `taken_at >= @from AND taken_at < @to`. Family film scans with EXIF `DateTimeOriginal` in the 1950s–1960s never appear on the timeline.

The same 1970 floor is hardcoded in `RecentOriginalsMissing`. A library that is **only** pre-1970 looks empty: the originals probe samples nothing, so a populated Owner folder can be treated as missing / `not_started` ([ADR 0004](../adr/0004-owner-scoped-index-job-and-cursor-photos.md) disk/original probes).

Unix epoch is not a product floor. **TakenAt** can be EXIF `DateTimeOriginal` from old family film scans.

## Evidence

- [backend/internal/api/api.go](../../backend/internal/api/api.go) `parseRange`: empty `from` → `time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)`; empty `to` → `time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC)`. Note: `from` is already initialized to `time.Time{}` (year 1) and then overwritten in the empty-`from` branch.
- [backend/internal/db/photos.go](../../backend/internal/db/photos.go) `Timeline` and `PhotosFiltered`: `FILTER p.taken_at >= @from AND p.taken_at < @to`. Bind is the raw `time.Time` values (`"from": from`, `"to": to`). No `DATE_ISO8601`, no Unix-millis conversion, no `IsZero` branch. Stored `taken_at` is the same type written through the same driver (`"taken_at": p.TakenAt`).
- [backend/internal/index/library.go](../../backend/internal/index/library.go) `RecentOriginalsMissing` (~lines 28–29): same 1970–2100 window, then `Photos(..., recentOriginalSample, "")`.
- [ADR 0005](../adr/0005-capture-time-stable-identity.md) **Query window** still documents the 1970 floor. **Limitations** already says the default range has a far-future ceiling (2100), not unbounded — keep that; remove the 1970 floor from Query window.
- Existing default-window test: [backend/internal/api/filter_test.go](../../backend/internal/api/filter_test.go) `TestParseRangeDefaultAllowsNearFutureCaptureTimes` (2100 ceiling / near-future **TakenAt**). No pre-1970 assertion today.
- Existing library tests: [backend/internal/index/library_test.go](../../backend/internal/index/library_test.go). `fakePhotoLister.Photos` currently ignores `from`/`to`.

## Decision (locked)

Photos with **TakenAt** before 1970-01-01 UTC **must** appear in default `/api/photos` and `/api/timeline`, and the library originals probe **must** see them.

**Lower bound when `from` is omitted:** do **not** default to 1970. Use `time.Time{}` (year 1) as the lower bound and **keep** `FILTER p.taken_at >= @from AND p.taken_at < @to`.

Why this bind, not “omit the predicate”:

- `@from` / `@to` are already bound as `time.Time`, the same way `taken_at` is stored. Year-1 and 1968 both travel that path; AQL does not wrap them.
- `parseRange` already seeds `from := time.Time{}`. The bug is the empty-`from` overwrite to 1970. Green is deleting that assignment (plus the matching library literals).
- Conditional AQL (`omit taken_at >= @from` when `from.IsZero()`) is the **fallback only** if the driver encodes a zero `time.Time` as `null` (then `>= null` is null and FILTER would hide every Photo). Do not start there. Do not add a live Arango test to decide.

**Upper bound:** keep **2100-01-01 UTC**. Cameras / EXIF in the near future must not be dropped ([ADR 0005](../adr/0005-capture-time-stable-identity.md)). Do **not** make `to` unbounded.

**Library probe:** change the hardcoded window in `RecentOriginalsMissing` in this same ticket so a library that is only pre-1970 is not treated as empty. Same window as `parseRange` defaults (`time.Time{}` … 2100-01-01 UTC).

**ADR 0005:** update **Query window** and **Limitations**: remove the 1970 floor; keep the 2100 ceiling.

**Domain:** **TakenAt** can be EXIF `DateTimeOriginal` from old family film scans. Unix epoch is not a product floor.

## Context map

### Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| [backend/internal/api/api.go](../../backend/internal/api/api.go) | `parseRange` used by `/api/photos` and `/api/timeline` | Empty `from` stays `time.Time{}`. Do not assign 1970. Keep empty `to` → 2100-01-01 UTC. |
| [backend/internal/index/library.go](../../backend/internal/index/library.go) | Originals probe window | Same default window as `parseRange`. A pre-1970-only library must be sampled. |
| [docs/adr/0005-capture-time-stable-identity.md](../adr/0005-capture-time-stable-identity.md) | Query window / Limitations | Remove the 1970 floor. Keep the 2100 ceiling (not unbounded). |

### Dependencies (may need updates)

| File | Relationship |
|------|--------------|
| [backend/internal/db/photos.go](../../backend/internal/db/photos.go) | Always `FILTER p.taken_at >= @from AND p.taken_at < @to`; binds `time.Time`. No AQL edit unless the zero-time→null fallback is proven. |
| [backend/internal/api/api.go](../../backend/internal/api/api.go) `timeline` / `photos` | Already call `parseRange`. Default JSON `from` on `/api/timeline` becomes year 1; SPA does not call that route ([ADR 0002](../adr/0002-spa-owned-timeline-groups.md)). |
| [backend/internal/index/coordinator.go](../../backend/internal/index/coordinator.go) | `shouldRescan` uses `RecentOriginalsMissing`. No signature change. |
| [frontend/src/lib/api.ts](../../frontend/src/lib/api.ts) | `fetchPhotosPage` omits `from`/`to` — Memories depends on the new default. Do not change the SPA in this ticket. |

### Test Files

| Test | Coverage |
|------|----------|
| [backend/internal/api/filter_test.go](../../backend/internal/api/filter_test.go) | Add `TestParseRangeDefaultIncludesPre1970CaptureTimes`. Keep `TestParseRangeDefaultAllowsNearFutureCaptureTimes`. |
| [backend/internal/index/library_test.go](../../backend/internal/index/library_test.go) | Extend: record `from`/`to` on the fake lister (or assert an extracted exported window helper). Do not add a live Arango test. |

### Reference Patterns

| File | Pattern |
|------|---------|
| [backend/internal/api/filter_test.go](../../backend/internal/api/filter_test.go) `TestParseRangeDefaultAllowsNearFutureCaptureTimes` | Call `parseRange("", "")`; assert a **literal** instant sits inside `[from, to)`. Do not recompute the bound the way the implementation does. |
| [backend/internal/index/library_test.go](../../backend/internal/index/library_test.go) | Package-local fakes for `PhotoLister` / `PathStater`. Existing cases stay: empty list is not missing; any existing original keeps the library. |

### Risk Assessment

- [ ] Breaking changes to public API — default `/api/timeline` `from` in JSON becomes year 1 instead of 1970. `/api/photos` catalog contents change (pre-1970 Photos appear). Explicit `from`/`to` query unchanged.
- [ ] Database migrations needed
- [ ] Configuration changes required

## Confirmed seams

1. **`parseRange`** in [backend/internal/api/api.go](../../backend/internal/api/api.go) — already tested in [backend/internal/api/filter_test.go](../../backend/internal/api/filter_test.go) `TestParseRangeDefaultAllowsNearFutureCaptureTimes`.
2. **Library probe window** in [backend/internal/index/library.go](../../backend/internal/index/library.go) — extend [backend/internal/index/library_test.go](../../backend/internal/index/library_test.go); or a small test on an exported window helper if one is extracted.

Do **not** change capture-time resolution (exif / birth / mtime). Do **not** add a live Arango test.

## First red test

Name: `TestParseRangeDefaultIncludesPre1970CaptureTimes` in [backend/internal/api/filter_test.go](../../backend/internal/api/filter_test.go).

```go
from, to, err := parseRange("", "")
// err must be nil
pre1970 := time.Date(1968, 6, 1, 0, 0, 0, 0, time.UTC)
// pre1970 must not be before from (i.e. is included)
// pre1970 must be before to (2100 ceiling still applies)
```

Assert the known literal against the returned `from` / `to`. **Do not** recompute the bound the way the implementation does (no `time.Date(1970, …)` / no `time.Time{}` constructed in the test as the expected floor).

Red today: `1968-06-01` is before `from` (1970-01-01 UTC).

## Implementation notes

1. **TDD.** First red test above. Then green `parseRange` (leave empty `from` as `time.Time{}`). Keep empty `to` = 2100-01-01 UTC. Leave `TestParseRangeDefaultAllowsNearFutureCaptureTimes` passing.
2. **Second slice — library.** `fakePhotoLister` ignores `from`/`to` today. Record them (or extract a small exported window helper and test that). Assert the same 1968-06-01 UTC literal is not before the probe `from`, and that `to` still excludes nothing the 2100 ceiling is meant to include. Then change `RecentOriginalsMissing` to the same window as `parseRange` defaults.
3. **AQL.** Do not change `photos.go` unless zero `time.Time` bind is proven to become `null`. Prefer keeping `FILTER p.taken_at >= @from AND p.taken_at < @to`.
4. **ADR 0005.** Query window: default range is unbounded below (year 1 / omitted floor), ceiling 2100-01-01 UTC. Limitations: keep “far-future ceiling (2100), not unbounded”; do not reintroduce a 1970 floor.
5. **Do not** change `ResolveCaptureTime`, EXIF parsing, timezone, or the 2100 ceiling.

## Acceptance

- `parseRange("", "")` includes `time.Date(1968, 6, 1, 0, 0, 0, 0, time.UTC)` and still includes a near-future **TakenAt** before 2100-01-01 UTC.
- Default `/api/photos` and `/api/timeline` (no `from` query) return Photos with **TakenAt** before 1970-01-01 UTC.
- `RecentOriginalsMissing` samples a library whose Photos are all pre-1970 (not treated as empty).
- Explicit `from` / `to` query strings still parse as today (`parseFlexTime`).
- ADR 0005 Query window / Limitations: no 1970 floor; 2100 ceiling remains.
- `gofmt` / existing `filter_test.go` and `library_test.go` cases still pass. No live Arango test.

## Out of scope

- Changing the 2100-01-01 UTC ceiling or making `to` unbounded
- EXIF parser, `ResolveCaptureTime`, birth/mtime fallbacks
- Timezone / `taken_at_local` / smart-date `local_from` / `local_to`
- SPA `/api/photos` client, `/api/timeline` UI (unused, ADR 0002)
- Live Arango integration tests
- New E2E feature unless a later ticket asks
