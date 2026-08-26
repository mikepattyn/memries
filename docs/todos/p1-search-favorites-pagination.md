# [P1] Search and Favorites pagination and year facets

Agent-pickup ticket. Decisions and seams below are **locked**. Do not reopen page size, a second Photo catalog, client-side substring search, or southern-hemisphere seasons. Explore only to implement; do not rewrite this ticket.

Glossary (use these words from [CONTEXT.md](../../CONTEXT.md)): **Photo**, **Timeline Group**, **Smart date**, **Granularity**, **Owner**, **TakenAt**.

## Problem

Search and Favorites silently stop after the first `/api/photos` page (`limit=50`). Only Memories (Timeline) calls `fetchNextPage()`. An Owner with more than 50 matching Photos never sees the rest on those tabs, and the photo viewer opened from those tabs stays on the first page.

Year chips on Search are derived from Photos already loaded on Memories (`facetPhotos={timelinePhotos}` → `photoFacets`). [ADR 0008](../adr/0008-smart-date-search.md) already names this as a limitation: chips miss years that exist in Arango but are not on the current Timeline pages.

`usePhotos` is already infinite (`getNextPageParam` reads `nextCursor`). This is not a missing catalog. Search and Favorites share the same cursor `/api/photos` path as Memories ([ADR 0004](../adr/0004-owner-scoped-index-job-and-cursor-photos.md)).

## Evidence

Verified on this checkout. Line numbers are current; cite them, do not re-litigate.

**Page size is 50, not “the whole library”.** [frontend/src/lib/api.ts](../../frontend/src/lib/api.ts) line 116:

```ts
const params = new URLSearchParams({ limit: "50" });
```

`fetchPhotosPage` (lines 112–135) already forwards `cursor`, `favorite`, `q`, `local_from`, `local_to`, `year`, `month`. `flattenPhotoPages` (lines 72–83) dedupes by Photo `id` across pages.

**`usePhotos` is already infinite.** [frontend/src/hooks/usePhotos.ts](../../frontend/src/hooks/usePhotos.ts) lines 12–21:

```ts
export function usePhotos(enabled: boolean, filter?: PhotoFilter) {
  const key = photosQueryKey(filter);
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) => fetchPhotosPage(pageParam, filter),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
    staleTime: 5 * 60_000,
  });
}
```

`flattenPhotos` (lines 24–26) is the only flatten path. Do not invent a second one.

**Only Timeline is wired to fetch the next page.** [frontend/src/App.tsx](../../frontend/src/App.tsx):

- Line 47: `timelineQuery = usePhotos(isReadyForPhotos)`
- Line 48: `favoritesQuery = usePhotos(..., { favorite: true })`
- Line 65: `searchQuery = usePhotos(..., searchFilter)`
- Lines 85–87: all three lists go through `flattenPhotos`
- Lines 159–175: Timeline receives `hasNextPage`, `isFetchingNextPage`, `fetchNextPage`, `fetchError`
- Lines 193–195: FavoritesView gets `photos` only
- Lines 196–206: SearchView gets `photos` plus `facetPhotos={timelinePhotos}` — no pagination props

**Search year chips come from Memories-loaded Photos.** [frontend/src/components/SearchView.tsx](../../frontend/src/components/SearchView.tsx) lines 22, 31, 41:

```ts
facetPhotos,
// ...
facetPhotos: Photo[];
// ...
const facets = useMemo(() => photoFacets(facetPhotos), [facetPhotos]);
```

`photoFacets` in [frontend/src/lib/groupPhotos.ts](../../frontend/src/lib/groupPhotos.ts) lines 36–44 walks `photo.takenAt.slice(0, 4)` on whatever array it is given. The only caller is SearchView. App passes Memories’ flattened Timeline list (line 199), so chips track Timeline pages, not the Owner’s library.

**Favorites is a PhotoGrid with no sentinel.** [frontend/src/components/FavoritesView.tsx](../../frontend/src/components/FavoritesView.tsx) lines 5–13 (props: `photos`, `onOpen`, `onActions`) and lines 35–40 (`PhotoGrid` only). The pane is `overflow-y-auto` (line 17). Search results live in their own `overflow-y-auto` pane ([SearchView.tsx](../../frontend/src/components/SearchView.tsx) line 167).

**Timeline already has the intersection sentinel.** [frontend/src/components/Timeline.tsx](../../frontend/src/components/Timeline.tsx):

- Lines 94–97: `requestNextPage` no-ops unless `hasNextPage` and not fetching / not `fetchError`
- Line 214: `<LoadMoreMarker onVisible={requestNextPage} enabled={...} />`
- Lines 215–230: “Loading more memories…” + fetch-error “Try again” (this is error recovery, not a “Load more” button)
- Lines 257–272: private `LoadMoreMarker` — `IntersectionObserver`, `rootMargin: "320px"`, `h-px` `aria-hidden` sentinel

**ADRs.** [docs/adr/0004-owner-scoped-index-job-and-cursor-photos.md](../adr/0004-owner-scoped-index-job-and-cursor-photos.md) line 60: Search and Favorites use the same `/api/photos` cursor with filters; they are not a second in-memory catalog. [docs/adr/0008-smart-date-search.md](../adr/0008-smart-date-search.md) line 30: “Year chips come from Photos already loaded on Memories, not a separate facet API.” Smart dates stay SPA-parsed (`parseSmartDate` → `year` / `month` / `local_from` / `local_to` on `/api/photos`).

**Viewer list does not grow today.** [frontend/src/App.tsx](../../frontend/src/App.tsx) lines 93–95 remaps `viewer.list` by `id` against `tabPhotos` but does not append newly flattened Photos. SearchResultGrid opens with the current `photos` array ([SearchView.tsx](../../frontend/src/components/SearchView.tsx) line 224); Favorites opens with the current favorites array (line 38). After `fetchNextPage`, those snapshots stay short.

**No Arango db test harness.** [backend/internal/db/photos_filter_test.go](../../backend/internal/db/photos_filter_test.go) asserts AQL strings. [backend/internal/db/cursor_test.go](../../backend/internal/db/cursor_test.go) encodes cursors. Handler tests use `fakeLibrary` in [backend/internal/api/albums_test.go](../../backend/internal/api/albums_test.go) (records `PhotosFiltered` filter; `TestPhotosPassesYearAndFavoriteFilters` at line 319). [backend/internal/api/library.go](../../backend/internal/api/library.go) lines 10–21 has no year-list method. [backend/internal/api/api.go](../../backend/internal/api/api.go) registers `GET /photos` then `GET /photos/{id}` (lines 31–32).

**Existing frontend tests do not drive IntersectionObserver.** [frontend/src/test/setup.ts](../../frontend/src/test/setup.ts) lines 15–25, 50–52: `StubIntersectionObserver.observe()` is a no-op. [frontend/src/components/Timeline.test.tsx](../../frontend/src/components/Timeline.test.tsx) never asserts the sentinel. [frontend/src/components/SearchView.test.tsx](../../frontend/src/components/SearchView.test.tsx) still passes `facetPhotos`. There is no FavoritesView test file.

**e2e today cannot catch the 50-Photo stop.** [e2e/scripts/prepare-fixtures.mjs](../../e2e/scripts/prepare-fixtures.mjs) has 11 fixtures. [e2e/features/search.feature](../../e2e/features/search.feature) year-chip scenarios (e.g. lines 96–107, 160–168) already depend on a “2025” chip existing. After slice 3 those chips must come from the year API, not Timeline pages.

## Decision (locked)

One ticket, two concerns, three vertical slices. Do not raise `limit`. Do not add a second Photo catalog. Do not replace SPA Smart date parsing.

### 1. Pagination

Pass `hasNextPage`, `isFetchingNextPage`, `fetchNextPage`, and `fetchError` from [frontend/src/App.tsx](../../frontend/src/App.tsx) into **SearchView** and **FavoritesView** the same way Timeline already receives them (lines 166–171).

Reuse Timeline’s intersection `LoadMoreMarker` pattern. Extract the small marker if that avoids copy-paste across Timeline / Search / Favorites; otherwise copy the same sentinel. Put it at the bottom of each view’s `overflow-y-auto` pane.

No “Load more” button unless the marker cannot work in that overflow container. Fetch-error “Try again” (Timeline lines 220–230) is allowed; that is recovery, not a pager.

`usePhotos` already has `getNextPageParam`. Keep using `flattenPhotos` / `flattenPhotoPages`. Viewer lists on Search and Favorites (and Memories) must grow with loaded pages on that same flatten path — `liveViewerList` must follow the current flattened `tabPhotos` for those tabs, not the click-time snapshot. Do not change Album-page viewer membership.

### 2. Year facets

Stop using Memories-loaded Photos as the year source. Remove `facetPhotos` and `photoFacets(...)` from SearchView.

Add an Owner-scoped year list from the API:

- `GET /api/photos/years` (register **before** `GET /photos/{id}` so `years` is not captured as an id)
- Session auth, same as other `/api/*` handlers
- AQL `COLLECT` on `SUBSTRING(p.taken_at_local, 0, 4)` (TakenAt wall clock, not UTC `taken_at`)
- Filters: signed-in Owner (`p.owner_id == @uid`), `p.deleted_at == null`; skip empty / missing `taken_at_local`
- Distinct years, newest first
- JSON `{ "years": ["2026", "2025"] }`

Frontend: `fetchOwnerYears` in [frontend/src/lib/api.ts](../../frontend/src/lib/api.ts); a `useQuery` hook (same shape as `useAlbums`, not infinite). App loads it when the library is ready (`isReadyForPhotos`) and passes `years: string[]` into SearchView. SearchView renders that list instead of `photoFacets(facetPhotos)`.

Smart dates stay SPA-parsed ([ADR 0008](../adr/0008-smart-date-search.md)). Update that ADR’s limitation text so it no longer says year chips come from Memories-loaded Photos.

`photoFacets` has no other callers — delete it when SearchView stops importing it. Do not keep a client-side year catalog “just in case.”

## Context map

### Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| [frontend/src/App.tsx](../../frontend/src/App.tsx) | Wires queries to views | Pass pagination props into SearchView and FavoritesView. Stop passing `facetPhotos={timelinePhotos}`. Fetch owner years and pass `years`. Grow `liveViewerList` from flattened `tabPhotos` on Memories / Search / Favorites. |
| [frontend/src/components/SearchView.tsx](../../frontend/src/components/SearchView.tsx) | Search surface | Public pagination props. Sentinel at bottom of overflow pane. Replace `facetPhotos` + `photoFacets` with `years: string[]`. |
| [frontend/src/components/FavoritesView.tsx](../../frontend/src/components/FavoritesView.tsx) | Favorites surface | Public pagination props. Sentinel at bottom of overflow pane. Do not put this inside PhotoGrid. |
| [frontend/src/components/Timeline.tsx](../../frontend/src/components/Timeline.tsx) | Existing marker | If extracted, import the shared marker. Leave Granularity / Timeline Groups / virtua paging as they are. |
| [frontend/src/components/LoadMoreMarker.tsx](../../frontend/src/components/LoadMoreMarker.tsx) (new, if extracted) | Shared sentinel | Same IO + `h-px` `aria-hidden` as Timeline lines 257–272. Optional `data-load-more` so presence tests do not mock IO. |
| [frontend/src/lib/api.ts](../../frontend/src/lib/api.ts) | HTTP client | Add `fetchOwnerYears`. Do **not** change `limit: "50"`. |
| [frontend/src/hooks/usePhotos.ts](../../frontend/src/hooks/usePhotos.ts) or a tiny sibling hook | Years query | `useQuery` for owner years. Do not invent a second infinite Photo catalog. |
| [frontend/src/lib/groupPhotos.ts](../../frontend/src/lib/groupPhotos.ts) | SPA Timeline Groups | Delete unused `photoFacets` after SearchView stops calling it. Leave `groupPhotos` / Granularity alone. |
| [backend/internal/db/photos.go](../../backend/internal/db/photos.go) | Photo AQL | Add `ListOwnerYears` (`COLLECT` on `taken_at_local` year, Owner, `deleted_at == null`). Extract AQL if that makes the named db test possible without Arango. |
| [backend/internal/api/library.go](../../backend/internal/api/library.go) | HTTP db seam | Add `ListOwnerYears(ctx, ownerID) ([]string, error)` to `Library`. |
| [backend/internal/api/api.go](../../backend/internal/api/api.go) | Routes + handler | `GET /photos/years` **before** `/photos/{id}`. Session Owner only. |
| [backend/internal/api/albums_test.go](../../backend/internal/api/albums_test.go) | `fakeLibrary` | Implement the new `Library` method; record the call (same style as `PhotosFiltered` / `filter`). |
| [docs/adr/0008-smart-date-search.md](../adr/0008-smart-date-search.md) | Smart date ADR | Replace the year-chip limitation (line 30) with the owner-scoped year API. Smart dates stay SPA-parsed. |
| [CONTEXT-MAP.md](../../CONTEXT-MAP.md) | Persistent map | Add `/photos/years` to the HTTP list (today line 74). |

### Dependencies (may need updates)

| File | Relationship |
|------|--------------|
| [frontend/src/hooks/useAlbums.ts](../../frontend/src/hooks/useAlbums.ts) | Pattern for a non-infinite `useQuery` list. |
| [frontend/src/components/PhotoGrid.tsx](../../frontend/src/components/PhotoGrid.tsx) | Favorites grid only. Do not add pagination internals here. |
| [frontend/src/components/PhotoViewer.tsx](../../frontend/src/components/PhotoViewer.tsx) | Consumes `photos={liveViewerList}`. Grows when App passes the flattened list. |
| [frontend/src/lib/parseSmartDate.ts](../../frontend/src/lib/parseSmartDate.ts) | Smart date parser. Read-only. |
| [backend/internal/api/filter.go](../../backend/internal/api/filter.go) | Existing `year` query params on `/api/photos`. Year **chips** are a new list endpoint, not a new filter key. |
| [backend/internal/db/photos.go](../../backend/internal/db/photos.go) `PhotosFiltered` / `photoFilterAQL` | Cursor pages still apply `year` filters. Unchanged contract. |
| [e2e/features/search.feature](../../e2e/features/search.feature) + [e2e/steps/library.steps.ts](../../e2e/steps/library.steps.ts) / [e2e/steps/ux.steps.ts](../../e2e/steps/ux.steps.ts) | Year-chip scenarios must keep working once chips come from the API. Do not add a 51-Photo e2e in this ticket. |
| [CONTEXT.md](../../CONTEXT.md) | Domain language. No glossary change required. |

### Test Files

| Test | Coverage |
|------|----------|
| [frontend/src/components/SearchView.test.tsx](../../frontend/src/components/SearchView.test.tsx) | Slice 1 sentinel presence; slice 3 years from props, not `facetPhotos`. Update existing `facetPhotos` renders. |
| [frontend/src/components/FavoritesView.test.tsx](../../frontend/src/components/FavoritesView.test.tsx) (new) | Slice 2: same sentinel pattern as SearchView. |
| [frontend/src/components/LoadMoreMarker.test.tsx](../../frontend/src/components/LoadMoreMarker.test.tsx) (new, only if extracted) | Allowed first-red alternative for slice 1: enabled → sentinel in the document. |
| [frontend/src/components/Timeline.test.tsx](../../frontend/src/components/Timeline.test.tsx) | Do not start mocking IO here. Keep matching current pattern. |
| [frontend/src/lib/api.test.ts](../../frontend/src/lib/api.test.ts) | Optional map of `{ years }` → `string[]`. Do not test TanStack Query. |
| `backend/internal/db/photos_years_test.go` (new) or next to [photos_filter_test.go](../../backend/internal/db/photos_filter_test.go) | **`TestListOwnerYearsReturnsDistinctTakenAtLocalYears`**. No Docker Arango. |
| [backend/internal/api/albums_test.go](../../backend/internal/api/albums_test.go) (or a sibling `*_test.go` in `api`) | Handler + `fakeLibrary` records `ListOwnerYears` and returns the JSON years. |

### Reference Patterns

| File | Pattern |
|------|---------|
| [frontend/src/components/Timeline.tsx](../../frontend/src/components/Timeline.tsx) | `LoadMoreMarker`, `requestNextPage`, loading + fetch-error UI. |
| [frontend/src/App.tsx](../../frontend/src/App.tsx) lines 166–171 | Pagination prop wiring. |
| [frontend/src/hooks/useAlbums.ts](../../frontend/src/hooks/useAlbums.ts) | `useQuery` for a small owner-scoped list. |
| [backend/internal/db/photos.go](../../backend/internal/db/photos.go) `CountOwnerPhotos` / `Timeline` | Owner + `deleted_at == null` + `COLLECT`. |
| [backend/internal/db/photos_filter_test.go](../../backend/internal/db/photos_filter_test.go) | AQL-string unit test without Arango. |
| [backend/internal/api/albums_test.go](../../backend/internal/api/albums_test.go) `fakeLibrary` + `TestPhotosPassesYearAndFavoriteFilters` | Handler records the db call. |
| [frontend/src/test/setup.ts](../../frontend/src/test/setup.ts) | Existing IO stub. Do not replace it with a custom mock. |

### Risk Assessment

- [x] Breaking changes to public API — additive `GET /api/photos/years` and new view props. SearchView drops `facetPhotos` (test-only + App).
- [ ] Database migrations needed — AQL only; no new collection or index required for this ticket.
- [x] Configuration changes required — none. [CONTEXT-MAP.md](../../CONTEXT-MAP.md) HTTP list must mention the new route.

## Confirmed seams

TDD at these seams only (red → green, one slice at a time; see this repo’s `tdd` skill when loaded). Do not test TanStack Query internals. Do not mock `IntersectionObserver` beyond [frontend/src/test/setup.ts](../../frontend/src/test/setup.ts) + what Timeline tests already do (they do **not** fire the stub).

- **Pagination seam:** SearchView and FavoritesView **public props** (not PhotoGrid internals). App.tsx wiring. Sentinel in the overflow pane. Viewer list follows `flattenPhotos` for that tab.
- **Facet seam:** HTTP `internal/api` + `internal/db` year collect; `frontend/src/lib/api.ts` client. SearchView shows years from the API list prop, not from `facetPhotos` / `photoFacets`.

## First red test

Work one slice at a time. One red test, then the minimum green, then the next slice.

**Slice 1 — Search sentinel.** First red: `SearchView` (or a tiny extracted `LoadMoreMarker` test). When `hasNextPage` is true, a load-more sentinel is in the document. Do **not** simulate intersection to assert `fetchNextPage` (Timeline tests do not). Presence is the seam. Update SearchView props in the existing heading test so it still compiles.

**Slice 2 — Favorites sentinel.** Same pattern on FavoritesView public props. New `FavoritesView.test.tsx`.

**Slice 3 — years API + SearchView.** First red test **name** (locked): `TestListOwnerYearsReturnsDistinctTakenAtLocalYears`.

There is no Arango harness. Put that name on an extractable db unit:

- Distinct years from `taken_at_local` (e.g. two Photos in 2026 and one in 2025 → `["2026","2025"]`)
- Drop other Owners and rows with `deleted_at != nil`
- Assert the AQL string `COLLECT`s `SUBSTRING(p.taken_at_local, 0, 4)` and filters `owner_id` + `deleted_at == null` (same style as `TestPhotoFilterAQLUsesTakenAtLocalForMonthAndRange`)

Pair with an api handler test: `fakeLibrary` records `ListOwnerYears` and the handler writes `{ "years": ... }`. Then a SearchView test: open the Years category, pass `years={["2025"]}` (and **not** a `facetPhotos` Photo from another year), and expect the “2025” chip from that list.

## Implementation notes

Vertical slices. Do not batch all three greens before the first red.

### Slice 1 — Search sentinel

1. Add pagination props to SearchView (`hasNextPage`, `isFetchingNextPage`, `fetchNextPage`, `fetchError`). Mirror Timeline’s optional/boolean shapes.
2. Extract `LoadMoreMarker` if Search + Favorites + Timeline would otherwise copy the same 15 lines. Add `data-load-more` on the extracted sentinel so presence tests stay stable. Keep `aria-hidden` and `h-px`.
3. Place the marker **after** the result grid, **inside** the `overflow-y-auto` pane ([SearchView.tsx](../../frontend/src/components/SearchView.tsx) line 167). Copy Timeline’s “Loading more memories…” and fetch-error “Try again”.
4. Wire App.tsx `searchQuery` the same way as `timelineQuery` (lines 166–171).
5. Grow the Search viewer list from `flattenPhotos(searchQuery.data)` / `tabPhotos` while the Search tab is open. Album page stays on its own list.
6. Try the default-root observer first (Timeline). Only if it cannot fire inside this overflow pane, set `root` to that pane. A visible “Load more” button is last resort.
7. [responsive-frontend](../../.cursor/skills/responsive-frontend/SKILL.md) applies to any visual change under `frontend/` (loading / error copy, any new chrome). The `h-px` sentinel alone is not a layout change.

### Slice 2 — Favorites sentinel

1. Same public props and sentinel as Search. Do not teach PhotoGrid about paging.
2. Wire `favoritesQuery` in App.tsx.
3. Grow the Favorites viewer list from `flattenPhotos(favoritesQuery.data)`.
4. Favorites still filters `photo.favorite` for the empty state; the query already sends `favorite=true`.

### Slice 3 — years API + SearchView

1. `Client.ListOwnerYears` + `Library` method + `GET /photos/years` before `/photos/{id}`.
2. `fetchOwnerYears` + `useQuery`. Enable when `isReadyForPhotos` so Search chips do not wait on Timeline pages.
3. SearchView takes `years: string[]`. Delete `facetPhotos` and `photoFacets`.
4. Rewrite ADR 0008 Limitations (today line 30) to: year chips come from owner-scoped `GET /api/photos/years` (`COLLECT` on `taken_at_local` year). Smart dates remain SPA-parsed; `/api/photos` still receives `month` / `local_from` / `local_to` / `year`.
5. Add `/photos/years` to [CONTEXT-MAP.md](../../CONTEXT-MAP.md) HTTP (`/api/*`).
6. Keep e2e year-chip steps working; do not add a large-library pagination feature in this ticket.

## Acceptance

- [ ] Search with `hasNextPage` shows the load-more sentinel in the document (slice 1 red/green).
- [ ] Favorites with `hasNextPage` shows the same sentinel (slice 2).
- [ ] App.tsx passes `hasNextPage`, `isFetchingNextPage`, `fetchNextPage`, `fetchError` into SearchView and FavoritesView. Timeline wiring stays.
- [ ] No “Load more” button unless the sentinel cannot work in that overflow pane. `limit` stays `"50"`.
- [ ] `usePhotos` / `getNextPageParam` / `flattenPhotos` remain the only Photo paging path.
- [ ] Viewer lists on Search and Favorites grow as pages flatten (same path as Memories). Album viewer list is unchanged.
- [ ] `TestListOwnerYearsReturnsDistinctTakenAtLocalYears` exists at the db (or extractable db + api) seam and covers distinct `taken_at_local` years, Owner scope, and `deleted_at == null`.
- [ ] `GET /api/photos/years` is registered before `/photos/{id}`, session-authenticated, returns `{ years: string[] }` newest first.
- [ ] SearchView year chips come from that API list prop. `facetPhotos` and `photoFacets` are gone.
- [ ] Smart date parsing stays in the SPA ([ADR 0008](../adr/0008-smart-date-search.md)). ADR 0008 limitation text and CONTEXT-MAP HTTP list are updated.
- [ ] No TanStack Query internals tests. No IntersectionObserver mock beyond the existing Timeline / setup pattern.
- [ ] `responsive-frontend` applied if any visual chrome changed.

## Out of scope

- Changing page size (`limit: "50"`), clamp defaults, or max page size.
- Client-side substring search on the typed query (ADR 0008).
- Southern-hemisphere seasons (ADR 0008).
- A second Photo catalog (in-memory, SQLite, or a non-`/api/photos` list).
- Album-page paging, `/api/timeline`, Granularity, or Timeline Group bucketing.
- New e2e feature that seeds >50 Photos to prove the sentinel.
- Indexer, storage, or schema migrations.
- Implementing or committing this ticket in the chat that only authored the work-order.
