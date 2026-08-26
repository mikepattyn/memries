---
name: page-accessibility
description: >-
  Audit and plan WCAG page accessibility work for a Memries SPA surface and
  its child components. Use when making Memories, Albums, Search, or the
  photo viewer accessible. For the whole frontend tree at once, use
  frontend-page-accessibility instead.
---

# Page Accessibility

Use this skill for accessibility work on a specific Memries surface, including the tab shell, child components, tests, and documentation.

## Workflow

1. Identify the target surface.
   - Prefer the focused file or explicit path from the user.
   - If the user asked to run accessibility across the frontend tree, or to trigger `/frontend-page-accessibility`, **stop** and follow [frontend-page-accessibility](../frontend-page-accessibility/SKILL.md) instead.
   - Typical surfaces: Memories (timeline), Albums, Album page, Search, photo viewer.
   - If the surface is unclear, ask one question before exploring widely.

2. Load project context before feature work.
   - Read `CONTEXT-MAP.md`.
   - Read `CONTEXT.md`.
   - Use glossary terms (Photo, Album, Timeline Group, Thumb, Original, Owner). If the user uses a conflicting term, call it out immediately.

3. Trace the full accessibility surface.
   - Route or tab in `frontend/src/App.tsx`.
   - Page component and child components under `frontend/src/components`.
   - Shared UI primitives and hooks those components use.
   - Existing frontend tests for that surface.

4. Research primary sources.
   - Prefer W3C WCAG, WAI-ARIA Authoring Practices, React accessibility docs, and axe-core docs.
   - Cite sources for claims in any research note under `docs/accessibility/`.

5. Grill the design one decision at a time when the user asked to grill.
   - Resolve accessibility target first, usually WCAG 2.2 AA.
   - Resolve verification before implementation: focused assertions plus axe-core when the app already has it; note keyboard/screen-reader checks tools cannot prove.
   - Resolve heading semantics: one page-level `h1`, labelled sections below.

6. Plan the change before editing when the scope is broad.
   - Include exact files to inspect or change.
   - Keep the plan on headings, landmarks, names, roles, states, focus, announcements, keyboard, and contrast-sensitive styling.

7. Implement conservatively.
   - Prefer native HTML semantics over ARIA.
   - Use ARIA only where native semantics do not express the relationship or state.
   - Keep decorative icons and skeleton blocks hidden from assistive tech.
   - Use `role="status"` or `aria-live` for non-urgent loading/status updates.
   - Use `role="alert"` for errors after user activity.
   - Preserve React + Vite + Tailwind conventions already in the tree.

8. Verify.
   - Add or update focused tests for accessible names, landmarks, headings, and state.
   - Add axe-core coverage when the user allows a dependency or the repo already has it.
   - Run the frontend test command when practical.
   - Report remaining manual keyboard, screen-reader, and contrast checks.

## Default Plan Template

```markdown
# [Surface] Accessibility Plan

## Scope
- Target surface, tab/shell, child components, and tests.

## Sources
- Primary accessibility sources to use.

## Implementation
- Semantic structure: headings, landmarks, regions, lists.
- Accessible names and descriptions.
- Dynamic behavior: focus, keyboard, loading/status, errors.

## Verification
- Automated axe coverage when present.
- Focused component assertions.
- Manual keyboard and screen-reader checks.

## Out Of Scope
- Domain behavior, data fetching, or unrelated styling unless needed for accessibility.
```

## Documentation Rules

- Update `CONTEXT.md` only for resolved domain glossary terms, never for implementation details.
- Create an ADR only when the decision is hard to reverse, surprising without context, and based on a real trade-off.
