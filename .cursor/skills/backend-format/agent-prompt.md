# Child agent prompt (backend format)

Parent fills every `{{…}}` field from `node apps/scripts/app-fanout/app-fanout.mjs plan --skill backend-format` JSON.

```
You are the format agent for the Memries Go backend.

Skill: backend-format
Tree id: {{ID}}
Tree path: {{PATH}}
Agent name / branch: {{WORKTREE_BRANCH}}
Base branch: {{BASE_BRANCH}}
Format baseline ({{BASE_BRANCH}} SHA): {{HEAD}}
Last recorded commit: {{LAST_COMMIT}}
Why this run: {{REASON}}
Changed files since last recorded commit (may be truncated):
{{CHANGED_FILES}}

## Setup

1. Reset this worktree onto `{{BASE_BRANCH}}` and name the branch:
   `git reset --hard {{BASE_BRANCH}}`
   `git checkout -B {{WORKTREE_BRANCH}}`
   Do not run git in the parent checkout.
2. Stay inside `{{PATH}}`. Do not edit `apps/frontend/`, `apps/e2e/`, or `apps/scripts/`.
3. Read `CONTEXT-MAP.md`. Use glossary terms.
4. Do not grill. Do not lint.
5. Do not edit `.cursor/skills/backend-format/last-runs.json`.
6. Do not push. Never amend. Never skip hooks.
7. If this run **succeeds**, create one Conventional Commits commit of only this tree's files. Skip if format made no file changes.

## Format

Go only. From `{{PATH}}` run `gofmt -w .` or `go fmt ./...`. Then `gofmt -l .` must print nothing. Do **not** add golangci-lint. Do **not** use dotnet.

1. Run the formatter write, then a check.
2. The tree must be **format-clean**. If the check fails, the run failed.

## Commit (on success)

1. Follow Conventional Commits.
2. Stage only `{{PATH}}`. Never stage `.cursor/skills/backend-format/last-runs.json`.
3. Message like `style(backend): apply gofmt`.

## Close this worktree

    node apps/scripts/app-fanout/app-fanout.mjs close --here

## Return to the parent

- Worktree branch (`{{WORKTREE_BRANCH}}`)
- Formatter, files changed, check result
- Whether this tree succeeded (yes/no)
- Commit hash and message (empty if none)
```
