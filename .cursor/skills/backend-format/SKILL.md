---
name: backend-format
description: >-
  Orchestrates formatting for the Memries Go backend. Diffs last-run commits
  against the current local branch and fans out one isolated worktree agent
  when backend/ is dirty (max 40). Each child only formats with gofmt.
  Use when the user wants /backend-format. Do not mix lint into this launch.
  Do not invoke platform-quality.
---

# Backend format

Reusable **orchestrator**. Each child runs **format only**.

Planning uses [`scripts/app-fanout/app-fanout.mjs`](../../../scripts/app-fanout/app-fanout.mjs) (`--skill backend-format`).

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

- `gofmt -w` / `go fmt ./...` until format-clean
- Do not lint. Do not add golangci-lint. Do not use dotnet
- Stay inside `backend/`
- Never push
- `last-runs.json` is parent-only
- Children `close --here`; parent always `close --skill`
- Launch **only** `launchNow` (at most 40). Task description = `backend-format-<id>`
- Do **not** invoke `platform-quality`

## Parent checkout (do not move it)

- The parent checkout **never** `git checkout`s a child `worktreeBranch`.
- The parent **never** `git reset --hard`.
- Children work only in the isolated worktree.
- After every child, close that worktree. After the wave, close `.worktrees/<baseBranch>` if you created it.

## 1. Plan

```
node scripts/app-fanout/app-fanout.mjs plan --skill backend-format
```

Optional: `--force`, `--app backend`, `--base <branch>`.

## 2. Fan out

- One Task per `launchNow` id, `best-of-n-runner`, `environment: local`, background when two or more.
- Child prompt: [agent-prompt.md](agent-prompt.md).

## 3. Merge, close, then record

```
node scripts/app-fanout/app-fanout.mjs close --skill backend-format backend
node scripts/app-fanout/app-fanout.mjs record --skill backend-format --commit <base-sha> backend
```

Do not record failed or skipped trees.

## Out of scope

- Lint (`backend-lint`)
- `frontend/`, `e2e/`, `scripts/`
- `platform-quality`
