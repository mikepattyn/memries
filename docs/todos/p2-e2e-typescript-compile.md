# [P2] E2E TypeScript project does not compile

## Problem

`npx tsc -p e2e/tsconfig.json` fails with **TS18048** because `originalsFor` in [e2e/steps/library.steps.ts](../../e2e/steps/library.steps.ts) closes over a `list` that TypeScript still treats as `string[] | undefined` inside the nested `page.on('request')` callback.

The helper is a per-`Page` `WeakMap` of `/api/original/` request URLs. Runtime is already correct: when the map misses, the code assigns `list = []`, stores that array, then listens. The compile break is control-flow narrowing only. The callback does not keep the `if (!list)` narrowing from the enclosing function, so `list.push` is illegal under `strict`.

## Evidence

Confirmed 2026-08-26 from this checkout:

```text
npx tsc -p e2e/tsconfig.json --pretty false
e2e/steps/library.steps.ts(27,49): error TS18048: 'list' is possibly 'undefined'.
```

[e2e/tsconfig.json](../../e2e/tsconfig.json) is already the intended project: `strict: true` (line 5), `noEmit: true` (line 6), include `playwright.config.ts` and `steps/**/*.ts` (line 10).

Current helper ([e2e/steps/library.steps.ts](../../e2e/steps/library.steps.ts) lines 19–31):

```ts
const originalRequests = new WeakMap<Page, string[]>();

function originalsFor(page: Page): string[] {
  let list = originalRequests.get(page);
  if (!list) {
    list = [];
    originalRequests.set(page, list);
    page.on('request', (req) => {
      if (req.url().includes('/api/original/')) list.push(req.url());
    });
  }
  return list;
}
```

- Line 22: `originalRequests.get(page)` is `string[] | undefined`.
- Line 24: assignment to `[]` narrows `list` in the `if` block only.
- Line 27, column 49: `list.push` inside the listener is TS18048. Nested closures do not retain that narrowing.

Call sites that must keep the same runtime contract:

- Line 176–178: `Given('I am watching media requests')` calls `originalsFor(page)` to attach the listener.
- Line 194–196: `Then('no original image has been requested')` asserts `originalsFor(page)` is `[]`.
- Line 198–200: `Then('the original image is requested')` polls `originalsFor(page).length`.

## Decision (locked)

Fix TS18048 by closing over a **definite** `const list: string[]`. Do **not** weaken `strict` in [e2e/tsconfig.json](../../e2e/tsconfig.json). Do **not** use `list!` or `list?.push`.

Recommended shape (equivalent is fine):

```ts
function originalsFor(page: Page): string[] {
  const existing = originalRequests.get(page);
  if (existing) return existing;
  const list: string[] = [];
  originalRequests.set(page, list);
  page.on('request', (req) => {
    if (req.url().includes('/api/original/')) list.push(req.url());
  });
  return list;
}
```

Why this is locked: a locally declared `const list: string[]` is never `undefined`, so the listener may call `list.push` under `strict`. Early-return of the cached array preserves one listener per `Page`. Behavior stays: same `WeakMap`, same `/api/original/` URL filter, same `string[]` return.

## Context map

Stay in this repository. Isolated Playwright BDD is the `e2e/` context in [CONTEXT-MAP.md](../../CONTEXT-MAP.md); orchestration is [docs/adr/0009-e2e-docker-skill-owns-isolated-stacks.md](../adr/0009-e2e-docker-skill-owns-isolated-stacks.md).

| Path | Why |
|------|-----|
| [e2e/steps/library.steps.ts](../../e2e/steps/library.steps.ts) | **Edit this file.** `originalsFor` (lines 19–31) and the three step defs that use it (lines 176–178, 194–196, 198–200). |
| [e2e/tsconfig.json](../../e2e/tsconfig.json) | **Read only.** Public compile seam: `strict` + `noEmit`. Do not change it. |
| [e2e/playwright.config.ts](../../e2e/playwright.config.ts) | Included by the same `tsc` project. Do not change it for this ticket. |
| [CONTEXT-MAP.md](../../CONTEXT-MAP.md) | Map row “Isolated Playwright BDD” → `e2e/`. |
| [docs/adr/0009-e2e-docker-skill-owns-isolated-stacks.md](../adr/0009-e2e-docker-skill-owns-isolated-stacks.md) | Skill owns isolated stacks; children may touch `e2e/steps`. This ticket is a typecheck fix, not a new feature. |
| [AGENTS.md](../../AGENTS.md) | Platform-lint/format cover `e2e/`; no e2e unit-test runner for helpers. |

No frontend or backend files. Compact-thumb and original-URL assertions stay as they are ([docs/adr/0007-viewport-forced-compact-thumbs.md](../adr/0007-viewport-forced-compact-thumbs.md) is product context only).

## Confirmed seams

- **Public seam:** the e2e TypeScript project compile: `npx tsc -p e2e/tsconfig.json` (`noEmit`, `strict`).
- There is **no** e2e unit-test runner for this helper. Do not add a Jest/Vitest suite for step defs.
- Do **not** change Playwright runtime behavior: same `WeakMap<Page, string[]>`, same request filter (`req.url().includes('/api/original/')`), same step text and assertions.
- TDD still applies: the compile is the red/green gate. New `*_test.go` / frontend tests are the usual product seams; this ticket is not product code.

## First red test

There is no e2e unit-test runner for this helper. The first red “test” **is** the typecheck.

```bash
npx tsc -p e2e/tsconfig.json
```

**Red (current):** exit 2; `e2e/steps/library.steps.ts(27,49): error TS18048: 'list' is possibly 'undefined'.`

**Green (after the locked fix):** `tsc -p e2e/tsconfig.json` exits 0. No new test files.

Do not run the full Playwright suite to prove this compile fix. Do not start Compose.

## Implementation notes

1. Change only `originalsFor` in [e2e/steps/library.steps.ts](../../e2e/steps/library.steps.ts) (today lines 21–31).
2. Close over `const list: string[]` (or an equivalent definite `string[]`). Early-return when `originalRequests.get(page)` already has an array so a second `Given` does not attach a second listener.
3. Leave [e2e/tsconfig.json](../../e2e/tsconfig.json) unchanged. Do not set `strict` false, do not add `strictNullChecks: false`, do not exclude `steps/**`.
4. Forbidden escapes: `list!`, `list?.push`, `as string[]` on a still-optional binding, `// @ts-expect-error` / `// @ts-ignore` on the push.
5. Do not rename step text, do not move the helper to another file, do not change the `WeakMap` key type.
6. After the edit, re-run `npx tsc -p e2e/tsconfig.json` and stop when it exits 0.

## Acceptance

- [ ] `npx tsc -p e2e/tsconfig.json` exits 0.
- [ ] [e2e/tsconfig.json](../../e2e/tsconfig.json) is unchanged (`strict` remains `true`).
- [ ] `originalsFor` closes over a definite `string[]` (no `!`, no `?.push`).
- [ ] Playwright behavior is unchanged: one list per `Page`, URLs that include `/api/original/` only.
- [ ] No Jest/Vitest (or other) unit suite added for step defs.
- [ ] Diff is [e2e/steps/library.steps.ts](../../e2e/steps/library.steps.ts) only, unless a later reviewer asks for docs.

## Out of scope

- Implementing or committing this ticket in the chat that only authored the work-order.
- Weakening or “simplifying” the e2e `tsconfig`.
- New unit tests for step definitions.
- Playwright feature edits, new scenarios, or Docker / `e2e-docker` stack runs.
- Frontend or backend changes, including thumb/original product behavior.
- Refactors of other helpers in `library.steps.ts` or `fixtures`.
- Platform-lint / platform-format / `/platform-quality` waves.
