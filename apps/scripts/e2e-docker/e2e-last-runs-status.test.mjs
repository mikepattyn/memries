import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyE2eLastRunsReadme,
  catalogRowsFromFeatures,
  renderE2eCatalog,
  renderE2eLastRunsTag,
  replaceMarkedRegion,
  summarizeE2eLastRuns,
} from './e2e-last-runs-status.mjs';

function discovered(...stems) {
  return stems.map((stem) => ({
    id: `memries-${stem}`,
    featureFile: `${stem}.feature`,
    path: `apps/e2e/features/${stem}.feature`,
  }));
}

describe('summarizeE2eLastRuns', () => {
  it('is all-green only when every discovered feature passed', () => {
    const summary = summarizeE2eLastRuns({
      discovered: discovered('login', 'timeline'),
      lastRunsApps: {
        'memries-login': { finding: { status: 'passed' } },
        'memries-timeline': { finding: { status: 'passed' } },
      },
    });
    assert.deepEqual(summary, {
      allPassed: true,
      passed: 2,
      failed: 0,
      missing: 0,
      total: 2,
      rows: [
        { id: 'memries-login', stem: 'login', status: 'passed' },
        { id: 'memries-timeline', stem: 'timeline', status: 'passed' },
      ],
    });
  });

  it('counts failed and never-run findings as not all-green', () => {
    const summary = summarizeE2eLastRuns({
      discovered: discovered('login', 'search', 'viewer'),
      lastRunsApps: {
        'memries-login': { finding: { status: 'passed' } },
        'memries-search': { finding: { status: 'failed' } },
      },
    });
    assert.equal(summary.allPassed, false);
    assert.equal(summary.passed, 1);
    assert.equal(summary.failed, 1);
    assert.equal(summary.missing, 1);
    assert.equal(summary.total, 3);
    assert.deepEqual(
      summary.rows.map((row) => row.status),
      ['passed', 'failed', 'missing'],
    );
  });
});

describe('renderE2eLastRunsTag', () => {
  it('renders a green check when every last-run passed', () => {
    const tag = renderE2eLastRunsTag({
      allPassed: true,
      passed: 14,
      failed: 0,
      missing: 0,
      total: 14,
      rows: [],
    });
    assert.equal(tag, '[**E2E last-runs:** ✅ all 14 passed](#end-to-end-tests)');
  });

  it('names the stems that kept the tag from going green', () => {
    const tag = renderE2eLastRunsTag({
      allPassed: false,
      passed: 10,
      failed: 3,
      missing: 1,
      total: 14,
      rows: [
        { id: 'memries-login', stem: 'login', status: 'failed' },
        { id: 'memries-search', stem: 'search', status: 'failed' },
        { id: 'memries-timeline', stem: 'timeline', status: 'passed' },
        { id: 'memries-viewer', stem: 'viewer', status: 'failed' },
        { id: 'memries-zoom', stem: 'zoom', status: 'missing' },
      ],
    });
    assert.equal(
      tag,
      '[**E2E last-runs:** ❌ 10 of 14 passed](#end-to-end-tests) — login, search, viewer, zoom',
    );
  });
});

describe('replaceMarkedRegion', () => {
  it('rewrites the body between matching start and end comments', () => {
    const next = replaceMarkedRegion(
      '# Title\n\n<!-- e2e-last-runs-tag:start -->\nold\n<!-- e2e-last-runs-tag:end -->\n\nMore\n',
      'e2e-last-runs-tag',
      '[**E2E last-runs:** ✅ all 2 passed](#end-to-end-tests)',
    );
    assert.equal(
      next,
      '# Title\n\n<!-- e2e-last-runs-tag:start -->\n[**E2E last-runs:** ✅ all 2 passed](#end-to-end-tests)\n<!-- e2e-last-runs-tag:end -->\n\nMore\n',
    );
  });

  it('throws when the marked region is missing', () => {
    assert.throws(
      () => replaceMarkedRegion('# Title\n', 'e2e-last-runs-tag', 'x'),
      /missing marked region e2e-last-runs-tag/,
    );
  });
});

describe('catalogRowsFromFeatures', () => {
  it('reads the Feature title and description paragraph', () => {
    const rows = catalogRowsFromFeatures([
      {
        id: 'memries-login',
        source: `Feature: Sign in
  Dex login puts the owner on Memories.

  Scenario: Admin sees memories after login
    Given I am signed in
`,
      },
      {
        id: 'memries-timeline',
        source: `Feature: Timeline periods
  Year / month / week / day headings follow capture time. The pinned
  label follows the first visible Timeline Group.

  Scenario: Granularity headings include an ISO week range
    Given I am signed in
`,
      },
    ]);
    assert.deepEqual(rows, [
      {
        id: 'memries-login',
        title: 'Sign in',
        blurb: 'Dex login puts the owner on Memories.',
      },
      {
        id: 'memries-timeline',
        title: 'Timeline periods',
        blurb:
          'Year / month / week / day headings follow capture time. The pinned label follows the first visible Timeline Group.',
      },
    ]);
  });
});

describe('renderE2eCatalog', () => {
  it('marks each feature from the last-run finding', () => {
    const markdown = renderE2eCatalog(
      [
        { id: 'memries-login', title: 'Sign in', blurb: 'Dex login puts the owner on Memories.' },
        { id: 'memries-search', title: 'Search', blurb: 'Filter on Memories opens Search.' },
      ],
      {
        rows: [
          { id: 'memries-login', stem: 'login', status: 'passed' },
          { id: 'memries-search', stem: 'search', status: 'failed' },
        ],
      },
    );
    assert.equal(
      markdown,
      '- ✅ **Sign in** — Dex login puts the owner on Memories.\n- ❌ **Search** — Filter on Memories opens Search.',
    );
  });
});

describe('applyE2eLastRunsReadme', () => {
  const template = `# Memries

<!-- e2e-last-runs-tag:start -->
old tag
<!-- e2e-last-runs-tag:end -->

## End-to-end tests

<!-- e2e-last-runs-catalog:start -->
old catalog
<!-- e2e-last-runs-catalog:end -->
`;

  it('refreshes the tag and catalog from last-runs and Feature blurbs', () => {
    const sources = {
      'memries-login': `Feature: Sign in
  Dex login puts the owner on Memories.
`,
      'memries-search': `Feature: Search
  Filter on Memories opens Search.
`,
    };
    const result = applyE2eLastRunsReadme({
      markdown: template,
      discovered: discovered('login', 'search'),
      lastRunsApps: {
        'memries-login': { finding: { status: 'passed' } },
        'memries-search': { finding: { status: 'failed' } },
      },
      readFeature: (row) => sources[row.id],
    });
    assert.equal(result.summary.allPassed, false);
    assert.match(
      result.markdown,
      /<!-- e2e-last-runs-tag:start -->\n\[\*+E2E last-runs:\*\* ❌ 1 of 2 passed\]\(#end-to-end-tests\) — search\n<!-- e2e-last-runs-tag:end -->/,
    );
    assert.match(
      result.markdown,
      /<!-- e2e-last-runs-catalog:start -->\n- ✅ \*\*Sign in\*\* — Dex login puts the owner on Memories\.\n- ❌ \*\*Search\*\* — Filter on Memories opens Search\.\n<!-- e2e-last-runs-catalog:end -->/,
    );
  });

  it('refuses a discovered feature that has no Feature title', () => {
    assert.throws(
      () =>
        applyE2eLastRunsReadme({
          markdown: template,
          discovered: discovered('login'),
          lastRunsApps: {},
          readFeature: () => 'Scenario: missing heading\n',
        }),
      /feature file missing Feature: title: memries-login/,
    );
  });
});
