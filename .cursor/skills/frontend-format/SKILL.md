---
name: frontend-format
description: >-
  Orchestrates formatting for the Memries React/Vite/Tailwind frontend. Diffs
  last-run commits against the current local branch and fans out one isolated
  worktree agent when frontend/ is dirty (max 40). Each child only formats.
  Use when the user wants /frontend-format. Do not mix lint into this launch.
  Do not invoke platform-quality.
---

# Frontend format

Reusable **orchestrator**. Each child runs **format only**.

Planning uses [`scripts/app-fanout/app-fanout.mjs`](../../../scripts/app-fanout/app-fanout.mjs) (`--skill frontend-format`).

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

- Format until format-clean
- Prettier for React/Vite/Tailwind; add config only if the tree has none
- Do not lint. Do not replace existing formatter config
- Stay inside `frontend/`
- Never push
- `last-runs.json` is parent-only
- Children `close --here`; parent always `close --skill`
- Launch **only** `launchNow` (at most 40). Task description = `frontend-format-<id>`
- Do **not** invoke `platform-quality`

## Parent checkout (do not move it)

- The parent checkout **never** `git checkout`s a child `worktreeBranch`.
- The parent **never** `git reset --hard`.
- Children work only in the isolated worktree.
- After every child, close that worktree. After the wave, close `.worktrees/<baseBranch>` if you created it.

## 1. Plan

```
node scripts/app-fanout/app-fanout.mjs plan --skill frontend-format
```

Optional: `--force`, `--app frontend`, `--base <branch>`.

## 2. Fan out

- One Task per `launchNow` id, `best-of-n-runner`, `environment: local`, background when two or more.
- Child prompt: [agent-prompt.md](agent-prompt.md).

## 3. Merge, close, then record

```
node scripts/app-fanout/app-fanout.mjs close --skill frontend-format frontend
node scripts/app-fanout/app-fanout.mjs record --skill frontend-format --commit <base-sha> frontend
```

Do not record failed or skipped trees.

## Out of scope

- Lint and page accessibility
- `backend/`, `e2e/`, `scripts/`
- `platform-quality`
