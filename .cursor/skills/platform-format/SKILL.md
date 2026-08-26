---
name: platform-format
description: >-
  Orchestrates formatting for Memries remainder trees: e2e/ and scripts/.
  Diffs last-run commits against the current local branch and fans out one
  isolated worktree agent per dirty tree (max 40). Use when the user wants
  /platform-format. Do not mix lint into this launch. Do not invoke
  platform-quality.
---

# Platform format

Reusable **orchestrator**. Trees are the explicit list in [`scripts/app-fanout/app-fanout.config.json`](../../../scripts/app-fanout/app-fanout.config.json) (`platform-format.trees`): `e2e` and `scripts`.

Planning uses [`scripts/app-fanout/app-fanout.mjs`](../../../scripts/app-fanout/app-fanout.mjs) (`--skill platform-format`).

Shared assets: [app-fanout](../app-fanout/README.md).

## Progress

```
Progress:
- [ ] 1. Plan (discover + git diff against the current branch)
- [ ] 2. Fan out one worktree agent per launchNow tree
- [ ] 3. Merge each successful branch into the plan baseBranch
- [ ] 4. Close each opened worktree (`close --skill …`; `--base-worktree` after the wave)
- [ ] 5. Record last-run commits using that branch's new SHA (commits last-runs.json)
- [ ] 6. Summarize
```

## Defaults (do not grill per tree)

- `e2e`: Prettier for TS/JS; add config only if missing
- `scripts`: Prettier on `.mjs`; do not add shfmt
- Do not lint
- Stay inside that tree's path
- Never push
- `last-runs.json` is parent-only
- Children `close --here`; parent always `close --skill`
- Launch **only** `launchNow` (at most 40). Task description = `platform-format-<id>`
- Do **not** invoke `platform-quality`

## Parent checkout (do not move it)

- The parent checkout **never** `git checkout`s a child `worktreeBranch`.
- The parent **never** `git reset --hard`.
- Children work only in the isolated worktree.
- After every child, close that worktree. After the wave, close `.worktrees/<baseBranch>` if you created it.

## 1. Plan

```
node scripts/app-fanout/app-fanout.mjs plan --skill platform-format
```

Optional: `--force`, repeatable `--app <id>`, `--base <branch>`.

## 2. Fan out

- One Task per `launchNow` id, `best-of-n-runner`, `environment: local`, background when two or more.
- Child prompt: [agent-prompt.md](agent-prompt.md).

## 3. Merge, close, then record

```
node scripts/app-fanout/app-fanout.mjs close --skill platform-format e2e
node scripts/app-fanout/app-fanout.mjs record --skill platform-format --commit <base-sha> e2e
```

Do not record failed or skipped trees.

## Out of scope

- Lint (`platform-lint`)
- `frontend/`, `backend/`
- `platform-quality`
