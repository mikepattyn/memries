# Child agent prompt (e2e-docker)

Parent fills every `{{…}}` field from `node scripts/e2e-docker.mjs plan` JSON.

```
You are the e2e-docker agent for one feature file in the Memries repo.

Skill: e2e-docker
Feature id: {{ID}}
Feature path: {{PATH}}
Feature file: {{FEATURE_FILE}}
Suite commit: {{SUITE_COMMIT}}
Agent name / branch: {{WORKTREE_BRANCH}}
Base branch: {{BASE_BRANCH}}
Last recorded commit: {{LAST_COMMIT}}
Why this run: {{REASON}}
Compose project: {{COMPOSE_PROJECT}}
Origin: {{ORIGIN}}
Caddy port: {{CADDY_PORT}}
Backend port: {{BACKEND_PORT}}
Frontend port: {{FRONTEND_PORT}}
Arango port: {{ARANGO_PORT}}
Dex port: {{DEX_PORT}}
Changed files since last recorded commit (may be truncated):
{{CHANGED_FILES}}

## Setup

1. Reset this worktree onto `{{BASE_BRANCH}}` (from the parent plan) and name the branch before any work:
   `git reset --hard {{BASE_BRANCH}}`
   `git checkout -B {{WORKTREE_BRANCH}}`
   Do not run git in the parent checkout.
2. Copy the parent checkout `.env` into this worktree `.env`. Never commit it.
3. Reuse the machine Playwright browser cache (`PLAYWRIGHT_BROWSERS_PATH` = the user `ms-playwright` folder). `npm install` in `e2e` if `node_modules` is missing.
4. Do not edit product code under `frontend/` or `backend/`. Do not edit `.cursor/skills/e2e-docker/last-runs.json`.
5. Do not push. Never amend. Never skip hooks. Do not create a product commit.

## Run

From `e2e`, with this environment:

- `MEMRIES_E2E_PROJECT={{COMPOSE_PROJECT}}`
- `MEMRIES_E2E_ORIGIN={{ORIGIN}}`
- `MEMRIES_E2E_FEATURE={{FEATURE_FILE}}`
- `CADDY_HOST_PORT={{CADDY_PORT}}`
- `BACKEND_HOST_PORT={{BACKEND_PORT}}`
- `FRONTEND_HOST_PORT={{FRONTEND_PORT}}`
- `ARANGO_HOST_PORT={{ARANGO_PORT}}`
- `DEX_HOST_PORT={{DEX_PORT}}`
- `PLAYWRIGHT_BROWSERS_PATH` = the machine Playwright cache

1. `node scripts/stack.mjs up` (or let Playwright's webServer do it).
2. `MEMRIES_E2E_FEATURE={{FEATURE_FILE}} npm test`
3. Always tear down, success or fail: `node scripts/stack.mjs down --wipe`

## Close this worktree

Success or fail:

    node scripts/e2e-docker.mjs close --here

Do not delete the branch. Do not run this in the parent checkout.

## Return to the parent

- Worktree branch (`{{WORKTREE_BRANCH}}`)
- Whether this feature succeeded (yes/no)
- Finding JSON the parent will pass to `record --finding`:
  `{"status":"passed"|"failed","summary":"<playwright counts>","composeProject":"{{COMPOSE_PROJECT}}","suiteCommit":"{{SUITE_COMMIT}}"}`
- SHA actually tested (`{{SUITE_COMMIT}}` unless you had to check out another)
```
