# Memries pickup tickets

Agent-ready work orders from the 2026-08-26 findings pass. Decisions and TDD seams are **locked** (confirmed, not “unconfirmed”). Pick one file, start at the named first red test, do not re-grill.

Primary-source backing: [research-indexes-cache-types.md](research-indexes-cache-types.md).

| Pri | Ticket | Locked call | First red test |
| --- | ------ | ----------- | -------------- |
| P1 | [Owner-scoped dedup](p1-owner-scoped-dedup.md) | Two Photos per Owner; unique `(owner_id, hash)` | `TestIndexerCreatesPhotoWhenAnotherOwnerAlreadyHasHash` |
| P1 | [Search / Favorites pages + year facets](p1-search-favorites-pagination.md) | Reuse Timeline `LoadMoreMarker`; years from the API | SearchView sentinel when `hasNextPage`; then `TestListOwnerYearsReturnsDistinctTakenAtLocalYears` |
| P2 | [Stale thumb cache](p2-stale-thumb-cache.md) | Keep `immutable`; `?v={hash}` | `thumbUrl includes content hash as v query` |
| P2 | [E2E TypeScript compile](p2-e2e-typescript-compile.md) | Close over `const list: string[]` | `npx tsc -p e2e/tsconfig.json` exits 0 |
| P2 | [Photos before 1970](p2-pre-1970-photos.md) | Drop the 1970 floor; keep the 2100 ceiling | `TestParseRangeDefaultIncludesPre1970CaptureTimes` |
| P2 | [Album deleted counts](p2-album-deleted-counts.md) | `ListAlbums` joins active Photos; leave edges | `TestListAlbumsExcludesSoftDeletedPhotosFromCountAndCover` |

These tickets can run in parallel. They do not share a first-slice file except that Search/Favorites and stale thumbs both touch `frontend/src/lib/api.ts` (pagination client vs `mapPhoto` hash) — serialize those two slices if both are in flight.

Do not implement from this folder index. Open the ticket.
