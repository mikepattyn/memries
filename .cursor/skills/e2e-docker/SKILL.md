---
name: e2e-docker
description: >-
  Orchestrates one Docker Playwright BDD feature per isolated worktree in
  this Memries repo. Diffs this checkout (not an umbrella gitlink pointer)
  and fans out at most 20 stacks on the 19000 port band. Children only run
  tests. The parent records a last-run finding per feature file. Use when
  the user wants /e2e-docker. Do not invoke platform-quality.
---

# E2E Docker

Reusable **orchestrator** for this repository. Each child runs **one feature file** against its own Compose project. Children do not change product code.

Planning uses [`scripts/e2e-docker.mjs`](../../../scripts/e2e-docker.mjs). Discovery lives in [`scripts/e2e-features.mjs`](../../../scripts/e2e-features.mjs). Isolation env is owned by [`e2e/scripts/stack.mjs`](../../../e2e/scripts/stack.mjs).

## Progress

```
Progress:
- [ ] 1. Plan (discover feature files + git diff)
- [ ] 2. Fan out one worktree agent per launchNow feature (max 4)
- [ ] 3. Do not merge child branches
- [ ] 4. Close each opened worktree (`close <id>`; `--base-worktree` after the wave)
- [ ] 5. Record a last-run finding per feature (commits last-runs.json)
- [ ] 6. Re-plan the same wave if deferred is non-empty
- [ ] 7. Summarize
```

## Defaults (do not grill per feature)

- One feature file per agent. Not the whole suite
- Run-only: start the isolated stack, run that feature, wipe the stack
- Never push. Do not edit product code under `frontend/` or `backend/`
- `last-runs.json` is parent-only; the executing parent commits it when `record` adds an id or changes last-run time / lastCommit / finding
- Children close their worktree with `close --here` before they return. The parent always runs `close` after success or failure
- Launch **only** `launchNow` (at most **4**). Task description = `e2e-docker-<id>`
- Do **not** invoke `platform-quality`
- If `deferred` is non-empty, close + record the finished slice and re-plan the same wave
- Docker Desktop must be running. The plan skips with `docker-unavailable` when it is not

## Parent checkout (do not move it)

- The parent checkout **never** `git checkout`s a child `worktreeBranch`.
- The parent **never** `git reset --hard`.
- Children work only in the isolated `best-of-n-runner` worktree. They never run git in the parent path.
- After launch, the parent stays on the plan `baseBranch`.
- After every child (success or fail), close that worktree. After the wave, close `.worktrees/<baseBranch>` if you created it.

## 1. Plan

```
node scripts/e2e-docker.mjs plan
```

Optional: `--force`, repeatable `--app <id>` (slug like `memries-timeline`), `--base <branch>`.

Treat `status: "needs-run"` as work. Skip `up-to-date` (`no-diff` after a passed finding) and `skipped` (`docker-unavailable`, missing path). If `launchNow` is empty, report that and stop. Fill `{{BASE_BRANCH}}` from the plan.

Each `launchNow` row includes `featureFile`, `suiteCommit`, `composeProject`, `origin`, and `ports`. Pass those into the child prompt.

## 2. Fan out (Multitask + worktrees)

- One Task per `launchNow` id, one message, `best-of-n-runner`, `environment: local`, background when two or more. Never more than 4.
- Task `description`: `agentName` (e.g. `e2e-docker-memries-timeline`).
- Do not poll. Do not mix format/lint children.
- Child prompt: [agent-prompt.md](agent-prompt.md). Pass `{{BASE_BRANCH}}` and the isolation fields from the plan.

## 3. Close, then record

Do **not** merge the child branch. Then close the worktree that child opened — success or fail:

```
node scripts/e2e-docker.mjs close memries-timeline
```

If this checkout is not still on `baseBranch` and you created `.worktrees/<baseBranch>`:

```
node scripts/e2e-docker.mjs close --base-worktree
```

Then record the finding (pass **and** fail). `lastCommit` is this repo's SHA and only advances on pass:

```
node scripts/e2e-docker.mjs record --commit <sha> --finding "{\"status\":\"passed\",\"summary\":\"12 passed\",\"composeProject\":\"e2e-memries-timeline\",\"suiteCommit\":\"<sha>\"}" memries-timeline
```

`record` Conventional-Commits **only** this skill's `last-runs.json` when an id is new or `recordedAt` / `lastCommit` / `finding` changed. Do not leave the file unstaged. Do not `git checkout` the child branch here.

## 4. Summarize

Status, finding, compose project, whether the worktree was closed, deferred features. Never push.

## Out of scope

- Fixing product code to make a feature pass
- Infrastructure deploys
- `platform-quality`
