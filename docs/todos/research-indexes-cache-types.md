# Research: owner-scoped indexes, immutable thumbs, TS18048, Go time bounds

Primary-source brief for the six `docs/todos` work orders. Living ArangoDB pages have no publication date (retrieved 2026-08-26). RFC 8246 is the current `immutable` standard; RFC 9111 did not absorb it.

No blogs or Stack Overflow were used as evidence.

## Direct answers

**ArangoDB unique persistent indexes.** A unique persistent index may be compound (`fields: ["owner_id", "hash"]`). Uniqueness is on the set of indexed attribute values. `ensureIndex` / `EnsurePersistentIndex` does not replace an existing index with a different definition. Drop `idx_hash` by name, then create the new unique compound index. Creating a unique index fails with HTTP 400 if existing documents already collide. Non-sparse unique treats missing attributes as `null` and allows `null` only once; sparse unique excludes documents with any missing/`null` indexed field from uniqueness checks.

**`Cache-Control: immutable`.** It is a promise that the origin will not update that URL’s representation while the response is still fresh. Combined with `max-age=31536000`, browsers SHOULD NOT revalidate (including ordinary reload) for about a year. Changing the file on the server does not bust a still-fresh immutable cache. Spec-backed bust: change the URL (path or query — both are part of the target URI / cache key). Dropping `immutable` or adding ETag/Last-Modified does not invalidate copies already stored as fresh+immutable.

**TS18048 + `let` in a callback.** Under `strictNullChecks`, TS18048 is “possibly undefined.” Control-flow narrowing follows assignments and type guards in the current function. Closures over `let` are not assumed to keep that narrowing, because the binding can be reassigned. Official pattern: bind a `const` after the value is definite. TypeScript 5.4 also keeps `let` narrowing in closures only after the last assignment and only if no nested function assigns to that variable.

**Go `time.Time` zero vs 1970.** Zero `Time` is 1 January, year 1 UTC, deliberately not the Unix epoch. `IsZero` detects it. `Unix()` is seconds since 1 January 1970 UTC and is defined for times far before 1970 (large negative). `UnixNano()` on the zero Time is undefined. Using zero Time as an inclusive lower bound is not “from 1970”; using Unix `0` as the bound drops pre-1970 instants.

## How this locks the tickets

| Ticket | What the sources require |
| ------ | ------------------------ |
| [p1-owner-scoped-dedup.md](p1-owner-scoped-dedup.md) | Drop `idx_hash`, then `EnsurePersistentIndex` on `owner_id` + `hash`, `Unique: true`, `Sparse: false` if both fields are always set. Do not call ensure and expect the old hash-only index to change meaning. |
| [p2-stale-thumb-cache.md](p2-stale-thumb-cache.md) | Version the URL (`?v=hash`). Keep `immutable` only because the URL changes when bytes change. ETag on the old URL will not be seen while the old response is fresh. |
| [p2-e2e-typescript-compile.md](p2-e2e-typescript-compile.md) | Close over a definite `const string[]`. Do not use `!` or weaken `strict`. |
| [p2-pre-1970-photos.md](p2-pre-1970-photos.md) | Do not treat `time.Time{}` as Unix epoch. For “no lower bound,” skip the predicate when `t.IsZero()`. `time.Unix(0, 0)` would still hide pre-1970 Photos. Never use `zero.UnixNano()` as a query bound. |

## Consensus findings

1. Compound unique indexes are specified. Uniqueness is on the tuple of fields (same idea as unique `_from`+`_to`).
2. Ensure is not migrate. Changing `idx_hash` from `[hash]` to `[owner_id, hash]` requires drop then create.
3. Null/sparsity is the main unique-index caveat. Non-sparse unique: missing ≡ `null`, and `null` is unique.
4. Create-time collisions fail closed (HTTP 400).
5. `immutable` + long `max-age` means this URL’s bytes will not change while fresh. In-place file change does not update clients.
6. Cache identity is the target URI. Path or query change is a new resource for caching.
7. Validators are not bust tokens for a fresh immutable response.
8. TS18048 is official under `strictNullChecks`. Closures over assignable `let` are the documented weak spot.
9. Go zero Time is year 1, not 1970. Unix conversion of times before 1970 is defined for `Unix()` (negative), not for `UnixNano()` on the zero value.

## Contested points

- `immutable` is SHOULD NOT, not MUST NOT. Force-reload / `no-cache` ignores it.
- Whether `ensure` + same `name` + different `fields` errors or no-ops is not spelled out. Do not rely on ensure-as-rename.
- TS 5.4 makes many `let`+callback cases pass; handbook least-privilege still prefers `const`.
- Zero `Time` vs `Unix(0,0)` vs omitting the filter are three different predicates. Go docs do not pick one for databases.

## Gaps

- No Arango “rename/replace index in one call” API in these pages.
- No official statement that `DELETE /_api/index/photos/idx_hash` is accepted (id vs name). Use go-driver `Index(ctx, name)` then `Remove`.
- Go docs do not specify AQL comparison with `time.Time` zero or Unix negatives.

## Notable quotes

> “Ensures that an index according to the index-description exists. A new index will be created if none exists with the given description.” — ArangoDB Working with Indexes

> “400 Bad Request — You try to create a unique persistent index but there are already documents in the collection that violate the uniqueness requirement.” — ArangoDB Persistent index HTTP API

> “Clients SHOULD NOT issue a conditional request during the response's freshness lifetime (e.g., upon a reload) unless explicitly overridden by the user (e.g., a force reload).” — RFC 8246

> “The ‘cache key’ is the information a cache uses to choose a response and is composed from, at a minimum, the request method and target URI used to retrieve the stored response.” — RFC 9111

> “Applying the principle of least privilege, all declarations other than those you plan to modify should use `const`.” — TypeScript Handbook, Variable Declaration

> “The zero value of type Time is January 1, year 1, 00:00:00.000000000 UTC.” — Go `time` package

## Driver sketch (drop then ensure)

```
idx, err := col.Index(ctx, "idx_hash")
if err == nil {
    err = idx.Remove(ctx)
}
_, _, err = col.EnsurePersistentIndex(ctx, []string{"owner_id", "hash"},
    &driver.EnsurePersistentIndexOptions{Unique: true, Name: "idx_hash"})
```

## Sources

| Source | URL | Type | Recency |
| ------ | --- | ---- | ------- |
| ArangoDB Index basics | https://docs.arango.ai/arangodb/stable/indexes-and-search/indexing/basics/ | documentation | living, undated |
| ArangoDB Working with Indexes | https://docs.arango.ai/arangodb/stable/indexes-and-search/indexing/working-with-indexes/ | documentation | living, undated |
| ArangoDB persistent indexes | https://docs.arango.ai/arangodb/3.12/indexes-and-search/indexing/working-with-indexes/persistent-indexes/ | documentation | living, undated |
| ArangoDB persistent index HTTP API | https://docs.arango.ai/arangodb/stable/develop/http-api/indexes/persistent/ | documentation | living, undated |
| go-driver collection indexes | https://github.com/arangodb/go-driver/blob/master/collection_indexes.go | first-party API | v1 (deprecated line; still what Memries imports — verify) |
| RFC 8246 HTTP Immutable Responses | https://www.rfc-editor.org/rfc/rfc8246.html | spec | 2017 (still current for `immutable`) |
| RFC 9111 HTTP Caching | https://www.rfc-editor.org/rfc/rfc9111.html | spec | 2022 |
| RFC 9110 HTTP Semantics | https://www.rfc-editor.org/rfc/rfc9110.html | spec | 2022 |
| TypeScript Handbook — Narrowing | https://www.typescriptlang.org/docs/handbook/2/narrowing.html | documentation | updated 2026-08-24 |
| TypeScript Handbook — Variable Declaration | https://www.typescriptlang.org/docs/handbook/variable-declarations.html | documentation | living |
| TypeScript 5.4 release notes | https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-4.html | documentation | updated 2026-08-24 |
| Go `time` package | https://pkg.go.dev/time | documentation | published 2026-07-07 |

## Quality

| Source | Credibility | Evidence | Recency | Objectivity |
| ------ | ----------- | -------- | ------- | ----------- |
| ArangoDB index docs | High | High | Med (undated) | Med (vendor) |
| go-driver | High | High | Med (v1 deprecated) | Med |
| RFC 8246 / 9111 / 9110 | High | High | Med–Low | High |
| TypeScript handbook + 5.4 | High | High | High | High |
| Go `time` | High | High | High | High |
