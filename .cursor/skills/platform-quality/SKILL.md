---
name: platform-quality
description: >-
  User-invoked umbrella only. Sequences page accessibility, then e2e-docker,
  then lint, then format across the Memries frontend, backend, e2e, and
  scripts trees. One agent per tree or feature per step, worktrees from the
  current local branch, merge into that branch between quality waves, max 40
  per wave (e2e caps at 20). Use only when the user typed /platform-quality
  or asked to run all quality workflows. Never start this skill from
  frontend-format, frontend-lint, e2e-docker, or any other orchestrator.
---

# Platform quality (Memries)

Reusable **umbrella orchestrator**. This skill does **not** format, lint, audit, or run a feature itself. It plans every nested skill, launches **one wave at a time**, merges successful branches into the **current local branch**, closes each opened worktree, records last-runs (and commits each nested `last-runs.json` when an entry is added or last-run time changes), then plans the next wave.

**User-invoked only.** Start this skill only when the current user message called `/platform-quality` (or this skill by name). Atomic orchestrators must never launch it.

Planning uses [`scripts/app-fanout/app-fanout.mjs`](../../../scripts/app-fanout/app-fanout.mjs) (`--skill platform-quality`). The script reads the current branch and puts it on every `launchNow` row as `baseBranch`. Pass that through to every child as `{{BASE_BRANCH}}`. Each nested skill diffs that tree (or feature) from its last recorded commit to the current tip. Empty `launchNow` means no diff — skip the wave.

New scripts follow the dual-shell Cursor rule.

## Progress

```
Progress:
- [ ] 1. Confirm the user invoked this skill directly
- [ ] 2. Plan the current wave (re-plan after each merge)
- [ ] 3. Fan out one agent per launchNow row (max 40; e2e max 20)
- [ ] 4. Merge child branches into baseBranch
- [ ] 5. Close each opened worktree (nested `close --skill …`; `--base-worktree` after the wave)
- [ ] 6. Record each nested skill using that branch's new SHA (commits last-runs.json)
- [ ] 7. Next wave, or stop if deferred / empty
- [ ] 8. Summarize
```

## Waves (never combine steps)

Same-tree lint and format must not run in parallel. E2E setup runs before lint/format so new `e2e/` files get both.

1. **page-accessibility** — `frontend-page-accessibility` only
2. **e2e** — `e2e-docker` only (one feature file per Docker stack, max 20; setup + run + merge `e2e/` commits)
3. **lint** — `frontend-lint` + `backend-lint` + `platform-lint`
4. **format** — `frontend-format` + `backend-format` + `platform-format`

Re-run `plan --skill platform-quality --wave <n>` after each wave's merges so diffs see the new `baseBranch` tip. After page-accessibility merges: `--wave 1` (e2e). After e2e merges: `--wave 2` (lint). After lint merges: `--wave 3` (format).

## Defaults

- Cap **40** agents per wave (shared across nested skills, not 40 each). The e2e wave caps at **20**
- Task `description` = plan `agentName` (`frontend-page-accessibility-frontend`)
- `best-of-n-runner`, `environment: local`, background when two or more
- Do not poll. End the turn after launch
- Never push
- `last-runs.json` files are parent-only; record per nested skill, never `--skill platform-quality`. `record` commits that file when an entry is added or last-run time changes
- Children close their worktree with `close --here` before they return (keeps the branch). The parent always runs nested `close --skill` after merge or failure
- E2E children may edit `e2e/` only. Merge those commits even when the finding failed. `lastCommit` advances only on pass

## Parent checkout (do not move it)

- The parent checkout **never** `git checkout`s a child `worktreeBranch`.
- The parent **never** `git reset --hard`.
- Children work only in the isolated `best-of-n-runner` worktree. They never run git in the parent path.
- After launch, the parent stays on the plan `baseBranch` until it merges.
- After every child (success or fail), close that worktree. After the wave, close `.worktrees/<baseBranch>` if you created it.

## 1. Plan

```
node scripts/app-fanout/app-fanout.mjs plan --skill platform-quality --wave 0
```

After page-accessibility merges: `--wave 1` (e2e). After e2e merges: `--wave 2` (lint). After lint merges: `--wave 3` (format).

Optional: `--force`, repeatable `--app <id>`, `--base <branch>` (default is the current checkout).

If the current wave's `launchNow` is empty (`no-diff` / skipped), skip to the next wave. If every remaining wave is empty, stop. If `deferred` is non-empty, finish this slice, then re-plan the same wave.

## 2. Fan out

- One Task per `launchNow` row, one message, never more than 40 (20 on the e2e wave)
- Fill the **nested skill's** agent prompt (`frontend-page-accessibility/agent-prompt.md`, `e2e-docker/agent-prompt.md`, etc.) including `{{BASE_BRANCH}}` from the plan
- E2E rows follow [e2e-docker](../e2e-docker/SKILL.md). Use that child prompt and the row's `featureFile`, `suiteCommit`, `composeProject`, `origin`, and `ports`. Merge `e2e/` commits. Record `--finding` into `e2e-docker` `last-runs.json` (pass and fail). `lastCommit` only advances on pass.
- Link each agent as `[agentName](id)`

## 3. Merge, close, then record

Merge `worktreeBranch` into the plan `baseBranch`. If this checkout is still on that branch and merge-clean, merge here. Otherwise `git worktree add .worktrees/<baseBranch> <baseBranch>` and merge there.

Then close the worktree that child opened — success or fail, merged or not — using the **nested** skill:

```
node scripts/app-fanout/app-fanout.mjs close --skill frontend-page-accessibility frontend
node scripts/app-fanout/app-fanout.mjs close --skill e2e-docker memries-timeline
```

After the last child of the wave, if you created `.worktrees/<baseBranch>` for merges:

```
node scripts/app-fanout/app-fanout.mjs close --skill frontend-page-accessibility --base-worktree
```

Then record the **nested** skill with that branch's new SHA:

```
node scripts/app-fanout/app-fanout.mjs record --skill frontend-page-accessibility --commit <base-sha> frontend
node scripts/app-fanout/app-fanout.mjs record --skill e2e-docker --commit <base-sha> --finding "{\"status\":\"passed\",\"summary\":\"12 passed\",\"composeProject\":\"e2e-memries-timeline\",\"suiteCommit\":\"<sha>\"}" memries-timeline
```

`record` Conventional-Commits **only** that nested skill's `last-runs.json` when an id is new or `recordedAt` / `lastCommit` / `finding` changed. Do not leave the file unstaged. Do not record the umbrella. Do not record quality-wave failures except the e2e wave, which records pass **and** fail findings.

## 4. Summarize

Per wave: launched, merged, closed worktrees, deferred, skipped empty (`no-diff`), failures. Never push.

## Out of scope

- Starting this skill unless the user invoked it
- Combining lint and format in one child
- Infrastructure deploys
