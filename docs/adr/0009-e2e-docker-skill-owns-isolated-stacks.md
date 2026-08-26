# 0009. e2e-docker skill owns isolated stacks

- Status: Accepted
- Date: 2026-08-26
- Source type: Internal decision (test orchestration)

## Key thesis

`/e2e-docker` lives in this repository. One feature file gets one Compose project on the 19000 port band. Last-run findings are recorded here. The Platform umbrella points at this skill; it does not keep a second last-runs file.

## Context

Playwright BDD under `e2e/` needs a second stack so `make up` on 18080 stays free. A Platform prototype planned features from the umbrella and treated Memries as a gitlink. That forced empty-gitlink clones, an overlay of uncommitted isolation files, and last-runs commits in the wrong repo.

ADR 0001 said not to copy a global skill into this tree. That still holds for `context-map`. This orchestrator is different: the suite, the isolation env, and the findings belong here, and agents in this workspace must not leave the folder.

## Decision

1. The skill shelf is [`.cursor/skills/e2e-docker/`](../../.cursor/skills/e2e-docker/). Plan, record, and close run as `node scripts/e2e-docker.mjs`.
2. Isolation is `MEMRIES_E2E_PROJECT`, `MEMRIES_E2E_FEATURE`, and the `*_HOST_PORT` band starting at 19000. Defaults in `e2e/scripts/stack.mjs` stay on `memries-e2e` / 18080 for `make e2e`.
3. `lastCommit` is this repo's SHA and only advances when the finding passed.
4. The Platform umbrella references this path and records into this `last-runs.json`.

## Consequences

- Opening Memries as its own workspace is enough to run `/e2e-docker`.
- A checked-out gitlink is enough for the umbrella to plan; it must not write last-runs into the umbrella tree.
- Children stay run-only. Product fixes are a later chat.
