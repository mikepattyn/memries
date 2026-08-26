---
name: frontend-page-accessibility
description: >-
  Orchestrates /page-accessibility for the Memries React frontend. Diffs
  last-run commits against the current local branch and fans out one isolated
  worktree agent when frontend/ is dirty (max 40). Use when the user wants
  /frontend-page-accessibility. Do not mix format or lint into this launch.
  Do not invoke platform-quality.
---

# Frontend page accessibility

Reusable **orchestrator**. This skill does **not** audit a page itself. It diffs `frontend/` against the last recorded commit on the **current local branch** and launches one isolated worktree agent when that tree still needs work.

Planning uses [`scripts/app-fanout/app-fanout.mjs`](../../../scripts/app-fanout/app-fanout.mjs) (`--skill frontend-page-accessibility`).

Shared assets: [app-fanout](../app-fanout/README.md).

## Progress

```
Progress:
- [ ] 1. Plan (discover + git diff against the current branch)
- [ ] 2. Fan out one worktree agent per launchNow tree
- [ ] 3. Merge each successful branch into the plan baseBranch
- [ ] 4. Close each opened worktree (`close --skill …`; `--base-worktree` after the wave)
- [ ] 5. Record last-run commits using that branch's new SHA (commits last-runs.json)
- [ ] 6. Summarize remaining manual checks
```

## Defaults (do not grill per tree)

- Accessibility target: WCAG 2.2 AA for Memories, Albums, Album page, Search, and the photo viewer
- Verification: focused assertions + axe-core when the app already has it; note keyboard/screen-reader checks tools cannot prove
- Headings: one page-level `h1`, labelled sections below
- Stay inside `frontend/`
- Never push
- `last-runs.json` is parent-only; the executing parent commits it when `record` adds an id or changes last-run time
- Children close their worktree with `close --here` before they return. The parent always runs `close --skill` after merge or failure
- Launch **only** `launchNow` (at most 40). Task description = `frontend-page-accessibility-<id>`
- Do **not** invoke `platform-quality`
- If `deferred` is non-empty, merge + close + record the finished wave and tell the user to re-run

## Parent checkout (do not move it)

- The parent checkout **never** `git checkout`s a child `worktreeBranch`.
- The parent **never** `git reset --hard`.
- Children work only in the isolated `best-of-n-runner` worktree. They never run git in the parent path.
- After launch, the parent stays on the plan `baseBranch` until it merges.
- After every child (success or fail), close that worktree. After the wave, close `.worktrees/<baseBranch>` if you created it.

## 1. Plan

```
node scripts/app-fanout/app-fanout.mjs plan --skill frontend-page-accessibility
```

Wrappers: `./scripts/app-fanout/app-fanout.sh plan --skill frontend-page-accessibility` or `./scripts/app-fanout/app-fanout.ps1 plan --skill frontend-page-accessibility`.

Optional: `--force`, `--app frontend`, `--base <branch>`.

Treat `status: "needs-run"` as work. Skip `up-to-date` (`no-diff`) and `skipped`. If `launchNow` is empty, report that and stop. Fill `{{BASE_BRANCH}}` from the plan.

## 2. Fan out (Multitask + worktrees)

- One Task per `launchNow` id, one message, `best-of-n-runner`, `environment: local`, background when two or more. Never more than 40.
- Task `description`: `agentName` (e.g. `frontend-page-accessibility-frontend`).
- Do not poll. Child prompt: [agent-prompt.md](agent-prompt.md). Pass `{{BASE_BRANCH}}` from the plan.

## 3. Merge, close, then record

Merge `worktreeBranch` into the plan `baseBranch`. Then close:

```
node scripts/app-fanout/app-fanout.mjs close --skill frontend-page-accessibility frontend
```

After the last child, if you created `.worktrees/<baseBranch>`:

```
node scripts/app-fanout/app-fanout.mjs close --skill frontend-page-accessibility --base-worktree
```

Then record that branch's new SHA:

```
node scripts/app-fanout/app-fanout.mjs record --skill frontend-page-accessibility --commit <base-sha> frontend
```

`record` Conventional-Commits **only** this skill's `last-runs.json` when an id is new or `recordedAt` / `lastCommit` changed. Do not record failed or skipped trees.

## 4. Summarize

Pages completed, incomplete pages, merge, closed worktrees. Never push.

## Out of scope

- Lint and format
- `backend/`, `e2e/`, `scripts/`
- `platform-quality`
