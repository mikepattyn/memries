# [P1] Owner-scoped photo deduplication

Agent-pickup ticket. Decisions are **locked**. Seams are **confirmed**. Do not reopen cross-owner identity, content-addressed shared blobs, or a live Arango harness. Follow `tdd` (red → green) at the seams below.

## Problem

An **Owner** owns many **Photos**. An **Index run** is already owner-scoped (walks that Owner’s prefix). Dedup is not.

`indexOne` hashes bytes, then calls global `GetPhotoByHash`. `ResolveIdentity` is path-first, then hash. When Owner B indexes bytes Owner A already stored, `byPath` is nil and `byHash` is **A’s** Photo. Action is `IdentityRelocate`. The indexer then patches A’s row with B’s storage path.

`UpdateIndexedPhoto` writes `storage` and `hash` and does **not** write `owner_id`. A stays the Owner; the path becomes B’s. A’s Photo is corrupted. Unique persistent index `idx_hash` on `hash` alone also forbids two live Photos with the same content fingerprint, so B cannot get a second row even if lookup were fixed.

Glossary: a **Photo** is an indexed still; `_key` is stable identity; `hash` is the sha256 fingerprint and may change when the file is rewritten. They are not the same field.

## Evidence

Glossary ([CONTEXT.md](../../CONTEXT.md)): an **Owner** is the signed-in user whose key must match `photo.owner_id`. An **Owner** owns many **Photos**. An **Index run** is a persisted, owner-scoped scan under the Owner’s email prefix. `_key` is identity; `hash` is the content fingerprint.

ADR [0004](../adr/0004-owner-scoped-index-job-and-cursor-photos.md): the HTTP **Index run** always walks `data/photos/<email>`; Owner and prefix come from the session. The job is already owner-scoped. This ticket is the hash lookup / uniqueness hole inside that job.

ADR [0005](../adr/0005-capture-time-stable-identity.md) relocate table (path-first Sync):

| Lookup | Action | `_key` |
| ------ | ------ | ------ |
| Owner + Storage path matches | Update | Existing key |
| Path unknown, hash matches | Relocate | Existing key; path refreshed |
| Neither | Create | Content hash |

That table stays. Relocate is **intra-owner only** after lookup is scoped. Do not change `ResolveIdentity` itself.

Indexer wiring ([backend/internal/index/indexer.go](../../backend/internal/index/indexer.go)):

- `PhotoRepository.GetPhotoByHash(ctx, hash)` — no Owner (lines 26–28).
- After hash: `byHash, err := lookupPhoto(i.DB.GetPhotoByHash(ctx, hash))` (lines 183–186), then `keepKey, action := ResolveIdentity(key, hash, byPath, byHash)` (line 187).
- `existing` is `byPath`, else `byHash` (lines 194–197).
- Skip / refresh path: `IdentityRelocate` → `touchRelocatedPath`, then if path or capture changed → `UpdateIndexedPhoto` (lines 199–214).
- Full reindex: `UpdateIndexedPhoto` when `existing != nil`, else `UpsertPhoto` (lines 253–258).

Identity ([backend/internal/index/identity.go](../../backend/internal/index/identity.go) lines 11–18): path match → `IdentityUpdate`; else hash match → `IdentityRelocate` and `byHash.Key`; else create with `_key` = content `hash`. The function takes already-fetched `byHash` and does **not** encode Owner.

Hash lookup ([backend/internal/db/photos.go](../../backend/internal/db/photos.go) lines 264–272):

```
FOR p IN photos
  FILTER p.hash == @hash
  SORT p.deleted_at == null DESC
  LIMIT 1
```

No `owner_id` filter. Contrast `GetPhotoByOwnerPath` (lines 274–282): `FILTER p.owner_id == @uid` then path, same `SORT p.deleted_at == null DESC`.

Corruption patch ([backend/internal/db/photos.go](../../backend/internal/db/photos.go) lines 301–322): `UpdateIndexedPhoto` sets `storage`, `hash`, thumbs, capture fields, `deleted_at: nil`. It does **not** set `owner_id`. Owner A’s row keeps A; path becomes B’s.

`UpsertPhoto` (lines 15–28) is also unsafe on `_key` conflict: `CreateDocument` then `IsConflict` → `UpdateDocument` of the **full** Photo. That would overwrite another Owner’s document if B’s create reused A’s `_key`.

Schema ([backend/internal/db/arango.go](../../backend/internal/db/arango.go) lines 83–85): unique persistent `idx_hash` on `["hash"]`. `EnsurePersistentIndex` does not drop the old name. [CONTEXT-MAP.md](../../CONTEXT-MAP.md) still lists `unique hash`.

Fake repo ([backend/internal/index/indexer_test.go](../../backend/internal/index/indexer_test.go) lines 40–48): `memPhotos.GetPhotoByHash` matches `p.Hash` only. `GetPhotoByOwnerPath` already requires `p.OwnerID == ownerID` (lines 51–59).

No `ensureSchema` unit. `backend/internal/db` tests are `photos_filter_test.go` (AQL string helper) and `cursor_test.go` (pure cursor). There is **no** live Arango integration harness.

## Decision (locked)

Cross-owner identical bytes must be two **Photos**. Dedup, hash lookup, and uniqueness are owner-scoped.

- Change `GetPhotoByHash(ctx, hash)` to owner-scoped: `GetPhotoByHash(ctx, ownerID, hash)` (or `GetPhotoByOwnerHash`). Prefer keeping the `GetPhotoByHash` name and adding `ownerID`. AQL must `FILTER p.owner_id == @uid AND p.hash == @hash`.
- Relocate-by-hash stays, but only intra-owner (lookup already scopes this). Path-first identity in `ResolveIdentity` is unchanged ([docs/adr/0005-capture-time-stable-identity.md](../adr/0005-capture-time-stable-identity.md)).
- Schema: drop unique persistent index `idx_hash` on `hash`; add unique persistent index `idx_owner_hash` on `(owner_id, hash)` in [backend/internal/db/arango.go](../../backend/internal/db/arango.go). `EnsurePersistentIndex` does not remove the old index — explicitly drop `idx_hash` then ensure the compound unique.
- `UpdateIndexedPhoto` must not be used to point Owner A’s row at Owner B’s path. Owner-scoped lookup prevents that. Do not add `owner_id` to that patch as a substitute for scoped lookup.
- Soft-deleted rows: keep preferring `deleted_at == null` (existing `SORT`). Same Owner + same `hash` + one soft-deleted is still unique-index constrained; do not invent a sparse-index scheme in this ticket.
- Update ADR 0005: content `hash` uniqueness is owner-scoped; relocate is intra-owner only. Do not contradict [CONTEXT.md](../../CONTEXT.md) (Owner owns Photos).

## Context map

### Files to Modify

| File | Purpose | Changes Needed |
|------|---------|----------------|
| [backend/internal/index/indexer.go](../../backend/internal/index/indexer.go) | `PhotoRepository` + `indexOne` | Owner-scoped hash lookup signature; pass `ownerID` into `GetPhotoByHash`. Do not change `ResolveIdentity` call shape. |
| [backend/internal/db/photos.go](../../backend/internal/db/photos.go) | `GetPhotoByHash` AQL | `FILTER p.owner_id == @uid AND p.hash == @hash`; keep `SORT p.deleted_at == null DESC`. Copy the bind style of `GetPhotoByOwnerPath`. |
| [backend/internal/db/arango.go](../../backend/internal/db/arango.go) | `ensureSchema` | Drop `idx_hash`, then `EnsurePersistentIndex` unique `idx_owner_hash` on `owner_id`, `hash`. |
| [docs/adr/0005-capture-time-stable-identity.md](../adr/0005-capture-time-stable-identity.md) | Identity ADR | Hash uniqueness is per Owner; relocate-by-hash is intra-owner. Do not rewrite path-first rules. |
| [CONTEXT-MAP.md](../../CONTEXT-MAP.md) | Persistent map | Indexes line: unique `(owner_id, hash)`, not unique `hash`. |

### Dependencies (may need updates)

| File | Relationship |
|------|--------------|
| [backend/internal/index/identity.go](../../backend/internal/index/identity.go) | Path-first `ResolveIdentity` — **do not change**. It consumes already-fetched `byHash`. |
| [backend/internal/index/indexer_test.go](../../backend/internal/index/indexer_test.go) | `memPhotos` must implement the new signature and filter `owner_id` like `GetPhotoByOwnerPath`. First red test lives here. |
| [backend/internal/index/identity_test.go](../../backend/internal/index/identity_test.go) | Existing `ResolveIdentity` tests stay; they do not encode Owner. |
| [backend/internal/index/prune.go](../../backend/internal/index/prune.go) | `touchRelocatedPath` / prune already take an intra-owner `existing` or `ListOwnerPhotoStorage`. No prune redesign. |
| [backend/internal/db/photos.go](../../backend/internal/db/photos.go) `UpsertPhoto` | Conflict path updates by `_key`. Must not steal another Owner’s document when IdentityCreate uses `hash` as `_key`. |
| [CONTEXT.md](../../CONTEXT.md) | Already: Owner owns Photos; `_key` vs `hash`. Do not contradict. No glossary rewrite required. |

### Test Files

| Test | Coverage |
|------|----------|
| [backend/internal/index/indexer_test.go](../../backend/internal/index/indexer_test.go) | First red test + `memPhotos` owner filter. Existing `TestResyncKeepsIdentityAndFavoriteWhenContentChanges` stays. |
| [backend/internal/index/identity_test.go](../../backend/internal/index/identity_test.go) | Unchanged path-first / relocate / create cases. |
| [backend/internal/db/photos_filter_test.go](../../backend/internal/db/photos_filter_test.go) | AQL-string pattern only. **Do not** invent a live Arango test. No `ensureSchema` unit exists — verify schema by reading `ensureSchema`. |

### Reference Patterns

| File | Pattern |
|------|---------|
| [backend/internal/db/photos.go](../../backend/internal/db/photos.go) `GetPhotoByOwnerPath` | Owner bind `@uid` + `SORT p.deleted_at == null DESC` + `LIMIT 1` |
| [backend/internal/index/indexer_test.go](../../backend/internal/index/indexer_test.go) | `memPhotos` + `writeJPEG` + `newTestIndexer` + `Indexer.Run` |
| [backend/internal/index/identity_test.go](../../backend/internal/index/identity_test.go) | `ResolveIdentity` with injected `byPath` / `byHash` |
| [backend/internal/db/arango.go](../../backend/internal/db/arango.go) `idx_owner_taken_at` | Compound persistent index `[]string{"owner_id", …}` + `Name` |

### Risk Assessment

- [x] Breaking changes to public API — `PhotoRepository.GetPhotoByHash` and `db.Client.GetPhotoByHash` gain `ownerID` (in-repo seam; only indexer + `memPhotos` call it).
- [x] Database migrations needed — drop `idx_hash`, ensure unique `idx_owner_hash`. Existing DBs that already have `idx_hash` will keep it unless dropped. Two Owners with the same `hash` cannot insert until the global unique is gone.
- [ ] Configuration changes required

**Soft-delete vs unique `(owner_id, hash)`:** the current unique on `hash` already applies to soft-deleted rows. Lookup does **not** `FILTER deleted_at == null`; it `SORT`s live first. Same Owner + same `hash` + only a soft-deleted row still returns that row, then `UpdateIndexedPhoto` revives it (`deleted_at: nil`). That does **not** insert a second document, so the unique does **not** block revive. Do not add a sparse index. Risk only if a later change exclusive-filters deleted rows and then `IdentityCreate`s — out of scope.

**`_key` is collection-unique; `hash` is not identity.** `IdentityCreate` still returns `hash` as `_key` ([identity.go](../../backend/internal/index/identity.go) line 18). After owner-scoped lookup, B’s create uses that `keepKey`. If A’s first insert already used `_key == hash`, `memPhotos.UpsertPhoto` overwrites A’s map slot and Arango `UpsertPhoto` conflict-updates A’s document. The first red test requires **two** Photos and A unchanged. Do not change `ResolveIdentity`’s path-first table. Do not `UpdateDocument` another Owner’s row. If B needs a distinct `_key` so both rows exist, that is required by collection-unique `_key` + this test — not a relocate-table change and not a shared-blob scheme.

## Confirmed seams

TDD only at these seams. Do not test private helpers. Do not assert on Arango internals from the index test.

1. `backend/internal/index` — `PhotoRepository` + `Indexer.indexOne` (public indexer behavior via `Run`).
2. `backend/internal/db` — `GetPhotoByHash` / schema `ensureSchema`.

## First red test

File: [backend/internal/index/indexer_test.go](../../backend/internal/index/indexer_test.go). Use `memPhotos`, `writeJPEG`, `newTestIndexer`. Do not stand up Arango.

Name: **`TestIndexerCreatesPhotoWhenAnotherOwnerAlreadyHasHash`**

Behavior: Owner B indexes bytes that Owner A already stored; B gets a **new Photo** with B as Owner and B’s storage path; A’s Photo is unchanged (same `_key`, Owner, path).

Suggested shape (same helpers as `TestResyncKeepsIdentityAndFavoriteWhenContentChanges`):

1. Write the same JPEG pixels to `a@example.com/shot.jpg`, `Run` with `OwnerID` A and that prefix. Capture A’s `_key`, `owner_id`, `storage.path`, `hash`.
2. Write the **same** pixels to `b@example.com/shot.jpg`, `Run` with `OwnerID` B and that prefix.
3. Assert two Photos in `memPhotos.byKey`.
4. A’s row: same `_key`, same `owner_id`, same path as step 1.
5. B’s row: `owner_id` is B, path is B’s key, `hash` equals A’s `hash`, `_key` is not A’s `_key`.

Do not assert driver index names or AQL from this test. Existing `ResolveIdentity` unit tests stay.

## Implementation notes

Skills: `tdd` only. Vertical slices: one test → one implementation. No speculative extras (no sharing graph, no blob store, no sparse unique, no live Arango).

### Slice 1 — repo + identity wiring

1. Add `TestIndexerCreatesPhotoWhenAnotherOwnerAlreadyHasHash` (red: B relocates A, or A’s path/owner changes).
2. Change `PhotoRepository.GetPhotoByHash` to take `ownerID`. Update `memPhotos` to require `p.OwnerID == ownerID` (same loop style as `GetPhotoByOwnerPath`).
3. In `indexOne`, call `GetPhotoByHash(ctx, ownerID, hash)` so `byHash` is intra-owner before `ResolveIdentity`.
4. In `db.GetPhotoByHash`, add `FILTER p.owner_id == @uid AND p.hash == @hash` (or two `FILTER`s like `GetPhotoByOwnerPath`). Keep `SORT p.deleted_at == null DESC` and `LIMIT 1`.
5. Green: two Photos; A unchanged. If IdentityCreate’s `hash` `_key` collides with A, insert B as a new row — do not conflict-update A. Do not change `ResolveIdentity` or its tests.

### Slice 2 — schema index

1. In `ensureSchema`, drop `idx_hash` by name, then `EnsurePersistentIndex` unique `Name: "idx_owner_hash"` on `[]string{"owner_id", "hash"}`.
2. There is no `ensureSchema` unit and no Arango test harness. Verify by reading the function in review. Do **not** invent a live Arango test. Do not extract AQL solely to mimic `photos_filter_test.go`.
3. Patch ADR 0005: uniqueness of content `hash` is owner-scoped; “path unknown, hash matches” is intra-owner. Keep path-first `_key` rules. Update [CONTEXT-MAP.md](../../CONTEXT-MAP.md) indexes line to match.

`UpdateIndexedPhoto` stays a metadata/storage patch without `owner_id`. Scoped lookup is what stops A←B path corruption.

## Acceptance

- `TestIndexerCreatesPhotoWhenAnotherOwnerAlreadyHasHash` passes: two Photos, same `hash`, different Owners and paths; A’s `_key` / Owner / path unchanged.
- Intra-owner relocate still works (`TestResolveIdentityRelocatesWhenHashMatchesNewPath` and path-first update tests still pass).
- `GetPhotoByHash` AQL filters `owner_id` and `hash`; still prefers `deleted_at == null`.
- `idx_hash` is dropped; unique `idx_owner_hash` on `(owner_id, hash)` is ensured.
- ADR 0005 and CONTEXT-MAP indexes line say hash uniqueness is owner-scoped. CONTEXT.md still: Owner owns Photos; `_key` vs `hash`.

## Out of scope

- Sharing graph (`owns`, `shared_with`, `album_shared` stay schema-only)
- Content-addressed shared blobs / one storage object for many Owners
- Merging two live paths that later become the same bytes (already an ADR 0005 limitation; still intra-owner)
- Sparse unique indexes or revive schemes beyond the existing `SORT` + `UpdateIndexedPhoto` clear of `deleted_at`
- Live Arango / Docker schema tests
- Changing `ResolveIdentity` path-first table or its unit tests
- Video, S3, WebSockets
