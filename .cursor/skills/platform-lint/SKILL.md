---
name: platform-lint
description: >-
  Orchestrates linting for Memries remainder trees: apps/e2e/ and apps/scripts/. Diffs
  last-run commits against the current local branch and fans out one isolated
  worktree agent per dirty tree (max 40). Use when the user wants
  /platform-lint. Do not mix format into this launch. Do not invoke
  platform-quality.
---

# Platform lint

Reusable **orchestrator**. Trees are the explicit list in [`apps/scripts/app-fanout/app-fanout.config.json`](../../../apps/scripts/app-fanout/app-fanout.config.json) (`platform-lint.trees`): `apps/e2e` and `apps/scripts`.

Planning uses [`apps/scripts/app-fanout/app-fanout.mjs`](../../../apps/scripts/app-fanout/app-fanout.mjs) (`--skill platform-lint`).

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

- `e2e`: ESLint for TS if present, or copy app-fanout eslint assets; run existing `test:unit` after fixes
- `scripts`: Prettier/ESLint on `.mjs`; run `node --test` for that stem after fixes
- Do not format. Do not add shfmt
- Stay inside that tree's path
- Never push
- `last-runs.json` is parent-only
- Children `close --here`; parent always `close --skill`
- Launch **only** `launchNow` (at most 40). Task description = `platform-lint-<id>`
- Do **not** invoke `platform-quality`

## Parent checkout (do not move it)

- The parent checkout **never** `git checkout`s a child `worktreeBranch`.
- The parent **never** `git reset --hard`.
- Children work only in the isolated worktree.
- After every child, close that worktree. After the wave, close `.worktrees/<baseBranch>` if you created it.

## 1. Plan

```
node apps/scripts/app-fanout/app-fanout.mjs plan --skill platform-lint
```

Optional: `--force`, repeatable `--app <id>`, `--base <branch>`.

## 2. Fan out

- One Task per `launchNow` id, `best-of-n-runner`, `environment: local`, background when two or more.
- Child prompt: [agent-prompt.md](agent-prompt.md).

## 3. Merge, close, then record

```
node apps/scripts/app-fanout/app-fanout.mjs close --skill platform-lint e2e
node apps/scripts/app-fanout/app-fanout.mjs record --skill platform-lint --commit <base-sha> e2e
```

Do not record failed or skipped trees.

## Out of scope

- Format (`platform-format`)
- `apps/frontend/`, `apps/backend/`
- `platform-quality`
