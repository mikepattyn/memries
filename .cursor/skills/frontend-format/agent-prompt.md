# Child agent prompt (frontend format)

Parent fills every `{{…}}` field from `node scripts/app-fanout/app-fanout.mjs plan --skill frontend-format` JSON.

```
You are the format agent for the Memries React frontend.

Skill: frontend-format
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
2. Stay inside `{{PATH}}`. Do not edit `backend/`, `e2e/`, or `scripts/`.
3. Read `CONTEXT-MAP.md`. Use glossary terms.
4. Do not grill. Do not lint.
5. Do not edit `.cursor/skills/frontend-format/last-runs.json`.
6. Do not push. Never amend. Never skip hooks.
7. If this run **succeeds**, create one Conventional Commits commit of only this tree's files. Skip if format made no file changes.

## Tooling

This tree is React + Vite + Tailwind. Do **not** replace existing formatter config.

- If no Prettier: copy `.cursor/skills/app-fanout/assets/.prettierrc` and add `format` / `format:check` scripts.
- If a `format` script already exists, run it (write + check).

## Implement

1. Add missing formatter config as above.
2. Run the formatter write, then a check.
3. The tree must be **format-clean**. If the check fails, the run failed.

## Commit (on success)

1. Follow Conventional Commits.
2. Stage only `{{PATH}}`. Never stage `.cursor/skills/frontend-format/last-runs.json`.
3. Message like `style(frontend): format with prettier`.

## Close this worktree

    node scripts/app-fanout/app-fanout.mjs close --here

## Return to the parent

- Worktree branch (`{{WORKTREE_BRANCH}}`)
- Formatter, files changed, check result
- Whether this tree succeeded (yes/no)
- Commit hash and message (empty if none)
```
