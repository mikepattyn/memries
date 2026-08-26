---
name: frontend-lint
description: >-
  Orchestrates linting for the Memries React/Vite/Tailwind frontend. Diffs
  last-run commits against the current local branch and fans out one isolated
  worktree agent when apps/frontend/ is dirty (max 40). Each child only lints
  (auto-fix, then leftovers until clean or 40 diagnostics). Use when the user
  wants /frontend-lint. Do not mix format into this launch. Do not invoke
  platform-quality.
---

# Frontend lint

Reusable **orchestrator**. Each child runs **lint only**.

Planning uses [`apps/scripts/app-fanout/app-fanout.mjs`](../../../apps/scripts/app-fanout/app-fanout.mjs) (`--skill frontend-lint`).

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

- Auto-fix, then leftovers until clean or **40** diagnostics
- ESLint + Prettier config for React/Vite/Tailwind; add configs only if the tree has none
- Do not format. Do not replace existing linter config
- Stay inside `apps/frontend/`
- Never push
- `last-runs.json` is parent-only
- Children `close --here`; parent always `close --skill`
- Launch **only** `launchNow` (at most 40). Task description = `frontend-lint-<id>`
- Do **not** invoke `platform-quality`

## Parent checkout (do not move it)

- The parent checkout **never** `git checkout`s a child `worktreeBranch`.
- The parent **never** `git reset --hard`.
- Children work only in the isolated worktree.
- After every child, close that worktree. After the wave, close `.worktrees/<baseBranch>` if you created it.

## 1. Plan

```
node apps/scripts/app-fanout/app-fanout.mjs plan --skill frontend-lint
```

Optional: `--force`, `--app frontend`, `--base <branch>`.

## 2. Fan out

- One Task per `launchNow` id, `best-of-n-runner`, `environment: local`, background when two or more.
- Child prompt: [agent-prompt.md](agent-prompt.md).

## 3. Merge, close, then record

```
node apps/scripts/app-fanout/app-fanout.mjs close --skill frontend-lint frontend
node apps/scripts/app-fanout/app-fanout.mjs record --skill frontend-lint --commit <base-sha> frontend
```

Do not record failed or skipped trees.

## Out of scope

- Format (`frontend-format`) and page accessibility
- `apps/backend/`, `apps/e2e/`, `apps/scripts/`
- `platform-quality`
