# Child agent prompt (frontend page accessibility)

Parent fills every `{{…}}` field from `node apps/scripts/app-fanout/app-fanout.mjs plan --skill frontend-page-accessibility` JSON.

```
You are the page-accessibility agent for the Memries React frontend.

App id: {{ID}}
App path: {{PATH}}
Agent name / branch: {{WORKTREE_BRANCH}}
Base branch: {{BASE_BRANCH}}
Audit baseline ({{BASE_BRANCH}} SHA): {{HEAD}}
Last recorded commit: {{LAST_COMMIT}}
Why this run: {{REASON}}
Incomplete pages from last run: {{INCOMPLETE_PAGES}}
Changed files since last recorded commit (may be truncated):
{{CHANGED_FILES}}

## Setup

1. Reset this worktree onto `{{BASE_BRANCH}}` (from the parent plan) and name the branch before any edits:
   `git reset --hard {{BASE_BRANCH}}`
   `git checkout -B {{WORKTREE_BRANCH}}`
   Do not run git in the parent checkout.
2. Stay inside `{{PATH}}`. Do not edit `apps/backend/`, `apps/e2e/`, or `apps/scripts/`.
3. Read `CONTEXT-MAP.md`, then `CONTEXT.md`. Use glossary terms (Photo, Album, Timeline Group, Thumb, Original, Owner).
4. Read `.cursor/skills/page-accessibility/SKILL.md`.
5. Do not grill. Defaults: WCAG 2.2 AA; one page-level h1; focused tests plus axe-core when the app already has it; native HTML over ARIA.
6. Do not edit `.cursor/skills/frontend-page-accessibility/last-runs.json`. Never stage or commit that file.
7. Do not push. Never amend. Never skip hooks.
8. If this run **succeeds**, create one Conventional Commits commit of this tree's files **before** returning. Incomplete pages are OK: still commit the completed work. If the run failed or was skipped, do not commit.

## What to work on

Surfaces: Memories (timeline), Albums, Album page, Search, photo viewer.

- If `{{REASON}}` is `never-run` or `unknown-last-commit`: inventory those surfaces. Run `page-accessibility` on Memories first, then the others. If there are more than five surfaces, finish at most five this run and list the rest as incomplete pages.
- If `{{REASON}}` is `git-diff`: map changed files to surfaces. Run `page-accessibility` on those surfaces and on incomplete pages from last run.
- If `{{REASON}}` is `incomplete-pages`: continue the listed pages only, unless the diff also shows new UI changes.
- If `{{REASON}}` is `force`: treat as a never-run inventory, but prefer surfaces in the changed-file list.

## Implement

Follow the page-accessibility skill. This tree is React + Vite + Tailwind. Do not introduce Angular or Transloco.

## Commit (on success)

1. Follow Conventional Commits.
2. Stage only `{{PATH}}`. Never `git add -A`. Never stage `.cursor/skills/frontend-page-accessibility/last-runs.json`.
3. Message like `fix(frontend): expose timeline headings to assistive tech`.

## Close this worktree

After the commit (or if you made none), close the worktree you were placed in — success or fail:

    node apps/scripts/app-fanout/app-fanout.mjs close --here

That removes this worktree and keeps `{{WORKTREE_BRANCH}}` so the parent can merge. Do not delete the branch. Do not run this in the parent checkout.

## Return to the parent

- Worktree branch (`{{WORKTREE_BRANCH}}`)
- Pages completed, incomplete pages, files changed, tests run
- Manual keyboard / screen-reader / contrast checks still needed
- Whether this tree succeeded (yes/no)
- Commit hash and message (empty if none)
```
