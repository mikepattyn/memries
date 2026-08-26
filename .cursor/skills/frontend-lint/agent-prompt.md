# Child agent prompt (frontend lint)

Parent fills every `{{…}}` field from `node scripts/app-fanout/app-fanout.mjs plan --skill frontend-lint` JSON.

```
You are the lint agent for the Memries React frontend.

Skill: frontend-lint
Tree id: {{ID}}
Tree path: {{PATH}}
Agent name / branch: {{WORKTREE_BRANCH}}
Base branch: {{BASE_BRANCH}}
Lint baseline ({{BASE_BRANCH}} SHA): {{HEAD}}
Last recorded commit: {{LAST_COMMIT}}
Why this run: {{REASON}}
Incomplete files from last run: {{INCOMPLETE_FILES}}
Changed files since last recorded commit (may be truncated):
{{CHANGED_FILES}}

## Setup

1. Reset this worktree onto `{{BASE_BRANCH}}` and name the branch:
   `git reset --hard {{BASE_BRANCH}}`
   `git checkout -B {{WORKTREE_BRANCH}}`
   Do not run git in the parent checkout.
2. Stay inside `{{PATH}}`. Do not edit `backend/`, `e2e/`, or `scripts/`.
3. Read `CONTEXT-MAP.md`. Use glossary terms.
4. Do not grill. Do not format.
5. Do not edit `.cursor/skills/frontend-lint/last-runs.json`.
6. Do not push. Never amend. Never skip hooks.
7. If this run **succeeds** (clean or capped incomplete), create one Conventional Commits commit of only this tree's files. Skip if lint made no file changes.

## Tooling

This tree is React + Vite + Tailwind. Do **not** replace existing linter config.

- If no ESLint: copy `.cursor/skills/app-fanout/assets/eslint.config.js`, add `eslint`, `eslint-config-prettier`, `eslint-plugin-react`, and `eslint-plugin-react-hooks`, and a `lint` script.
- If a `lint` script already exists, run it (with auto-fix when the tool supports it).

## What to work on

- `never-run`, `unknown-last-commit`, or `force`: lint the whole tree.
- `git-diff`: lint changed files and incomplete files from last run; still run the tree lint command.
- `incomplete-files`: continue the listed files first.

## Implement

1. Add missing linter config as above.
2. Run auto-fix, then fix leftovers until exit 0 or **40** leftover diagnostics. List incomplete files if capped.
3. After code-fixing lint, run `npm test` in `frontend/` if that script exists. Test failure = failed run.

## Commit (on success)

1. Follow Conventional Commits.
2. Stage only `{{PATH}}`. Never stage `.cursor/skills/frontend-lint/last-runs.json`.
3. Message like `fix(frontend): satisfy eslint`.

## Close this worktree

    node scripts/app-fanout/app-fanout.mjs close --here

## Return to the parent

- Worktree branch (`{{WORKTREE_BRANCH}}`)
- Linter, incomplete files, remaining diagnostic count, tests run
- Whether this tree succeeded (yes/no)
- Commit hash and message (empty if none)
```
