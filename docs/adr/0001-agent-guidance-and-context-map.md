# 0001. Agent guidance and context map

- Status: Accepted
- Date: 2026-08-26
- Source type: Internal decision (workspace documentation)

## Key thesis

Agents work only inside this repository. [AGENTS.md](../../AGENTS.md) is the operating contract; [CONTEXT-MAP.md](../../CONTEXT-MAP.md) is the persistent navigation map; [README.md](../../README.md) stays human onboarding. Slash `/context-map` remains a user-level skill — this repo stores the map, not a copy of the skill.

## Context

Memries is a Phase 1 photo manager (Go API + indexer, Arango, React timeline, Dex, Caddy, Compose). Agents arriving from a larger workshop needed a local contract so they would not open parent directories, sibling apps, or external phased-plan notes.

Human onboarding already lived in the README. Duplicating that layout at length would rot. A second README for agents would mix “how to run” with “where to look.” Copying the global `context-map` skill into `.cursor/skills` would invent a parallel workflow.

The accepted split is three files with one job each.

## Decision

### [AGENTS.md](../../AGENTS.md)

Operating guide, not a second README:

1. This workspace is Memries only. Ignore README pointers that leave the folder.
2. Before changing code: read AGENTS.md and CONTEXT-MAP.md, run the `context-map` workflow, wait for review, then implement. Do not invent a parallel workflow when a listed skill already owns it.
3. Phase 1 in scope: timeline browse, OIDC cookie session, indexer (EXIF, sha256, 256 / 512 / 1024 thumbs), local Storage, per-owner ACL. Out of scope unless asked: video, S3, WebSockets, sharing graph, Piwigo import.
4. Non-negotiables: no remote Compose, no infra deploys, no commit of `.env` or `data/`, no secrets in docs, commit only when asked.
5. Public seams: HTTP in `internal/api` and `internal/auth`, Storage in `internal/storage`, schema in `internal/db`. New tests sit next to those seams, not inside UI widgets.
6. Skills: `context-map` before features; `tdd` when adding tests; `responsive-frontend` for visual work under `frontend/`.

### [CONTEXT-MAP.md](../../CONTEXT-MAP.md)

Persistent map: contexts table, Compose mermaid, glossary, Caddy HTTP, backend module map, frontend notes, photo layout, Arango collections, known constraints. Later ADRs are listed in its Decisions table. Domain language that grew after this split lives in [CONTEXT.md](../../CONTEXT.md); the map points there.

### [README.md](../../README.md)

Unchanged as the human quick start. Agents use it for Compose and indexer commands; they do not treat it as the architecture source of truth.

### No local skill copy

`/context-map` stays the user-level skill. This repository stores the **persistent** map. Agents must produce a task context map and wait for review before implementation.

## Key findings

1. **README already pointed outside this folder.** AGENTS.md must tell agents to ignore those pointers rather than follow them.
2. **A glossary in CONTEXT-MAP.md is enough to start.** A separate CONTEXT.md was out of the original change; it arrived later as domain language (Photo, Album, Timeline Group) and is now linked from the map.
3. **Share and album edge collections were schema-only when this was written.** Later product work added owner-scoped Albums; share edges remain schema-only. See [0005](0005-capture-time-stable-identity.md).

## Methodology

The map was distilled from files in this repository only: README, Compose, Caddy, Dex, `internal/api`, `internal/auth`, `internal/db`, `internal/storage`, and the frontend entry path (`App.tsx` → Timeline → `lib/api.ts`). Parent directories were not used as sources.

## Consequences

- Agents start at AGENTS.md + CONTEXT-MAP.md, not at the umbrella or sibling apps.
- Task-level context maps are ephemeral; CONTEXT-MAP.md is the durable index and is updated when seams or ADRs change.
- Compact-thumb numbering moved: that decision is [0007](0007-viewport-forced-compact-thumbs.md), not this file.

## Limitations

- AGENTS.md Phase 1 bullets are the original contract and can lag later ADRs (SPA-owned Timeline Groups, HTTP Index run, capture identity). Prefer CONTEXT-MAP.md Decisions for current product rules.
- The user-level `context-map` skill is not versioned in this repo.
- Known Compose constraints (Dex on `:5556`, Arango first-init password) are recorded, not fixed.

## Actionable takeaways

- Stay in this repository. Do not open parent or sibling trees.
- Run `context-map` and wait for review before implementing a feature or bug.
- Put new architecture decisions in `docs/adr/` and link them from CONTEXT-MAP.md.
- Do not copy skills into this repo unless the user asks.

## Quality

| Dimension    | Rating | Note |
| ------------ | ------ | ---- |
| Credibility  | High   | First-party workspace contract, files exist in this repo |
| Evidence     | Medium | Decision recorded from in-repo research; no runtime proof |
| Recency      | High   | Accepted 2026-08-26 |
| Objectivity  | High   | Operating rules, not a vendor comparison |

**Overall:** Adequate — cite as the agent-docs source of truth; verify current seams against CONTEXT-MAP.md.

## References

- Operating guide: [AGENTS.md](../../AGENTS.md)
- Persistent map: [CONTEXT-MAP.md](../../CONTEXT-MAP.md)
- Human onboarding: [README.md](../../README.md)
- Domain language (later): [CONTEXT.md](../../CONTEXT.md)
- Compact thumbs (renumbered): [0007-viewport-forced-compact-thumbs.md](0007-viewport-forced-compact-thumbs.md)
