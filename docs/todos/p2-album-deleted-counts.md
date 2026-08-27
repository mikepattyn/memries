# [P2] Album counts and covers include deleted photos

Agent-pickup ticket. Decisions and seams are **locked**. Do not reopen cover-order redesign, edge pruning, or a Docker Arango harness.

## Problem

Album cards disagree with the Album page after folder Sync soft-deletes a Photo.

`ListAlbums` counts every `in_album` edge. `albumPhotos` (used by `GetAlbumView`) joins membership to Photos with `deleted_at == null`. After prune sets `deleted_at` and leaves the edge in place, the card still shows the gone Photo in `photo_count`, `cover_photo_id`, and `photo_ids`. Opening the Album page hides it.

Soft-delete is Sync/prune, not unmember. Unmember removes the `in_album` edge and leaves the Photo in the library. Soft-delete hides the Photo from active library surfaces; the edge may remain so a later revive (`deleted_at` cleared) puts the Photo back in the Album without re-adding.

## Evidence

- `ListAlbums` in [backend/internal/db/albums.go](../../backend/internal/db/albums.go) builds pics from edges only:

  ```
  LET pics = (FOR e IN in_album FILTER e._to == a._id RETURN PARSE_IDENTIFIER(e._from).key)
  ```

  Then `photo_count: LENGTH(pics)`, `cover_photo_id: pics[0]`, `photo_ids: pics`. No Photo join. No `deleted_at` filter.

- `albumPhotos` in the same file already filters deleted:

  ```
  FILTER p._id == e._from AND p.deleted_at == null
  ```

  Then `SORT p.taken_at DESC, p._key DESC`. `GetAlbumView` uses that list for count, cover, and ids.

- `albumViewForOwner` scans `ListAlbums`. `AddPhotoToAlbum` and `RemovePhotoFromAlbum` return that card view. Fixing `ListAlbums` also fixes add/remove HTTP responses.

- Indexer prune soft-deletes missing Originals: [backend/internal/index/prune.go](../../backend/internal/index/prune.go) → `SoftDeletePhoto`. Revive clears `deleted_at` on re-index (`UpdateIndexedPhoto` / relocated-path touch). Neither path deletes `in_album` edges.

- [CONTEXT.md](../../CONTEXT.md): an Album contains Photos via `in_album`; removing a Photo from an Album does not delete the Photo. Soft-delete is Sync/prune, not unmember.

### Glossary (use these words)

| Term | Meaning |
|------|---------|
| **Photo** | Indexed still image; `_key` is stable identity. Soft-delete sets `deleted_at`; it is still the same Photo. |
| **Album** | Named, owner-scoped set of Photos joined by `in_album` edges. |
| **Album page** | In-tab view of one Album’s Photos, opened from an Album card. Already filtered by `albumPhotos`. |
| **deleted** | Sync/prune set `deleted_at` because the Original is missing. Photo is hidden from active lists. Membership edge may remain. |
| **unmember** | Remove the `in_album` edge (Album page long-press / `RemovePhotoFromAlbum`). Photo stays in the library. Not this ticket. |

## Decision (locked)

Album cards must agree with the Album page on **which Photos are active**. They do **not** have to share cover sort in this ticket.

1. Change `ListAlbums` AQL so membership is joined to active Photos (`deleted_at == null`), same membership rule as `albumPhotos`.
2. `photo_count`, `cover_photo_id`, and `photo_ids` on the card must ignore soft-deleted Photos.
3. Do **not** delete `in_album` edges on prune/soft-delete. Edges may remain; counts and covers skip deleted Photos. If the Photo is revived (`deleted_at` cleared), it reappears in the Album without re-adding.
4. Cover = first remaining **active** id in the **same order the query already uses for pics** (today: edge iteration order, not `taken_at`). Keep `ListAlbums` edge order; only filter deleted.
5. Do not silently switch card cover order to `taken_at`. Album page / `GetAlbumView` already sorts by `taken_at DESC, _key DESC`. That remaining inconsistency is **out of scope** (one-line follow-up if anyone files it). Do not expand into cover-order redesign.

`GetAlbumView` is already correct. No HTTP contract change: same `AlbumView` fields, active Photos only.

## Context map

### Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| [backend/internal/db/albums.go](../../backend/internal/db/albums.go) | `ListAlbums` AQL; `albumPhotos` is the join rule to copy | Join `in_album` to `photos` with `p.deleted_at == null`. Keep edge order for pics. Count / cover / ids from that list only. |
| [backend/internal/db/albums_test.go](../../backend/internal/db/albums_test.go) (new) or existing `backend/internal/db/*_test.go` | First red test at the db seam | See **First red test**. No Docker Arango. |

### Dependencies (may need updates)

| File | Relationship |
|------|--------------|
| [backend/internal/api/albums.go](../../backend/internal/api/albums.go) | `GET /api/albums` calls `ListAlbums`. Add/remove return `albumViewForOwner` → `ListAlbums`. No handler change if AQL is fixed. |
| [backend/internal/api/library.go](../../backend/internal/api/library.go) | `Library.ListAlbums` seam. Signature stays. |
| [backend/internal/db/photos.go](../../backend/internal/db/photos.go) | `SoftDeletePhoto` / `UpdateIndexedPhoto` (`deleted_at: nil`). Read-only context for revive. |
| [backend/internal/index/prune.go](../../backend/internal/index/prune.go) | Soft-deletes missing Originals; must **not** start removing edges. |
| [frontend/src/components/AlbumsView.tsx](../../frontend/src/components/AlbumsView.tsx) | Album card renders API `photoCount` / `coverPhotoId`. No SPA change if the card payload is correct. |
| [frontend/src/components/AlbumPage.tsx](../../frontend/src/components/AlbumPage.tsx) | Album page already uses `GetAlbumView`. Reference only. |

### Test Files

| Test | Coverage |
|------|----------|
| **First red:** `TestListAlbumsExcludesSoftDeletedPhotosFromCountAndCover` in `backend/internal/db` | Join rule: two edges, one Photo deleted → count 1, cover = live key, `photo_ids` = live key only |
| [backend/internal/api/albums_test.go](../../backend/internal/api/albums_test.go) | Fake `Library`. Will **not** catch AQL. Do not treat HTTP tests as the red test. |
| [backend/internal/db/photos_filter_test.go](../../backend/internal/db/photos_filter_test.go) | Pattern: extracted AQL (`photoFilterAQL`) asserted without Arango |
| [backend/internal/db/cursor_test.go](../../backend/internal/db/cursor_test.go) | Pattern: pure helpers (`ClipPage`) tested in memory |
| [e2e/steps/library.steps.ts](../../e2e/steps/library.steps.ts) `the album {string} should have {int} photos` | Optional later. Not required for the first slice. |

### Reference Patterns

| File | Pattern |
|------|---------|
| `albumPhotos` in [albums.go](../../backend/internal/db/albums.go) | Join: `FILTER p._id == e._from AND p.deleted_at == null` |
| `photoFilterAQL` + [photos_filter_test.go](../../backend/internal/db/photos_filter_test.go) | Extract query text and assert the filter is present |
| `ClipPage` + [cursor_test.go](../../backend/internal/db/cursor_test.go) | Pure function for list derivation when logic lives in Go |

### Risk Assessment

- [ ] Breaking changes to public API — same JSON fields; values drop deleted Photos
- [ ] Database migrations needed — no
- [ ] Configuration changes required — no
- [x] Card vs Album page cover **order** stays different (edge order vs `taken_at`) — accepted; do not “fix”
- [x] HTTP fake library will stay green even if AQL is wrong — first test must be at the db seam

## Confirmed seams

- Public seam: `db.ListAlbums` / HTTP `GET /api/albums` (library API).
- `GetAlbumView` already uses `albumPhotos` (deleted filtered). Leave it.
- `albumViewForOwner` uses `ListAlbums` — one AQL fix covers list + add/remove card responses.
- [backend/internal/api/albums_test.go](../../backend/internal/api/albums_test.go) uses a fake library and will **not** catch AQL.
- First red test must sit at the **db seam** or an extracted query helper that encodes the join rule.
- There is **no** Arango test harness in `backend/internal/db`. Do **not** add a Docker Arango test in this ticket.

## First red test

Name (locked): `TestListAlbumsExcludesSoftDeletedPhotosFromCountAndCover`

Setup: one Album with two `in_album` edges; one Photo soft-deleted (`deleted_at` set); the other active.

Expect:

- `photo_count` == 1
- `cover_photo_id` == the live Photo `_key` (first remaining active id in **edge** order)
- `photo_ids` contains only the live key

How to run it without Arango (locked style):

- Prefer the existing db-test style: extract AQL (like `photoFilterAQL`) **or** a small `albumPicKeys(edges, photos)` used by production **and** the test — only if that matches how this package already tests query rules.
- Do not invent a live Arango client test.
- Do not put the first red test in `backend/internal/api`.

## Implementation notes

1. Follow `tdd`: red test above, then change only the `ListAlbums` `LET pics` subquery so it walks `in_album` and keeps a Photo when `p._id == e._from AND p.deleted_at == null`. Return keys in **edge iteration order** (no `SORT p.taken_at`).
2. Do not change `albumPhotos` sort. Do not make `ListAlbums` sort by `taken_at` to “match” the Album page.
3. Do not touch prune, `SoftDeletePhoto`, or `RemovePhotoFromAlbum` to drop edges.
4. `AddPhotoToAlbum` already rejects a deleted Photo (`ErrNotFound`). No change required.
5. Frontend Album cards already display `photoCount` / `coverPhotoId` from `GET /api/albums`. No UI work unless a follow-up proves the payload is right and the card still lies.
6. E2E: optional mention only. [e2e/steps/library.steps.ts](../../e2e/steps/library.steps.ts) already has `the album {string} should have {int} photos`. Not required for the first slice. Do not add a prune/Sync feature in this ticket.

## Acceptance

- After a Photo in an Album is soft-deleted, `GET /api/albums` (and add/remove card views) report `photo_count`, `cover_photo_id`, and `photo_ids` as if that Photo were not a member.
- `GET /api/albums/{id}` (Album page) already excluded it; card and page **membership** agree.
- Reviving the Photo (`deleted_at` cleared, edge still there) puts it back on the card without creating a new `in_album` edge.
- Cover on the card is the first **active** key in existing `ListAlbums` edge order.
- `TestListAlbumsExcludesSoftDeletedPhotosFromCountAndCover` is green at the db seam.
- No new Docker / Compose Arango test. No edge deletes on prune.

## Out of scope

- Deleting or pruning `in_album` edges when a Photo is soft-deleted
- Share graph (`owns`, `shared_with`, `album_shared` — schema only)
- Cover-sort redesign (do not switch `ListAlbums` to `taken_at` to match `albumPhotos`)
- Unmember vs delete product copy, Album page long-press, or indexer prune behavior
- HTTP-only tests as the proof of the AQL join
- E2E for Sync/prune (optional later; existing album-count steps are enough to mention)
- Frontend optimistic `photoCount` in [frontend/src/hooks/useAlbums.ts](../../frontend/src/hooks/useAlbums.ts)
