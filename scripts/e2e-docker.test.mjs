import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lastRunsCommitTarget } from './e2e-docker-last-runs.mjs';
import { planE2eFeatures } from './e2e-docker.mjs';

const discovered = [
  {
    id: 'memries-albums',
    kind: 'e2e-feature',
    workflow: null,
    path: 'e2e/features/albums.feature',
    featureFile: 'albums.feature',
    suiteId: 'memries',
    suitePath: '.',
    gitlink: false,
  },
  {
    id: 'memries-capture',
    kind: 'e2e-feature',
    workflow: null,
    path: 'e2e/features/capture.feature',
    featureFile: 'capture.feature',
    suiteId: 'memries',
    suitePath: '.',
    gitlink: false,
  },
  {
    id: 'memries-empty-states',
    kind: 'e2e-feature',
    workflow: null,
    path: 'e2e/features/empty-states.feature',
    featureFile: 'empty-states.feature',
    suiteId: 'memries',
    suitePath: '.',
    gitlink: false,
  },
  {
    id: 'memries-indexing',
    kind: 'e2e-feature',
    workflow: null,
    path: 'e2e/features/indexing.feature',
    featureFile: 'indexing.feature',
    suiteId: 'memries',
    suitePath: '.',
    gitlink: false,
  },
  {
    id: 'memries-login',
    kind: 'e2e-feature',
    workflow: null,
    path: 'e2e/features/login.feature',
    featureFile: 'login.feature',
    suiteId: 'memries',
    suitePath: '.',
    gitlink: false,
  },
];

describe('planE2eFeatures', () => {
  it('launches at most four never-run features and defers the rest', () => {
    const plan = planE2eFeatures({
      discovered,
      suiteHead: 'abc',
      baseBranch: 'feature/design',
    });
    assert.deepEqual(plan.launchNow, [
      'memries-albums',
      'memries-capture',
      'memries-empty-states',
      'memries-indexing',
    ]);
    assert.deepEqual(plan.deferred, ['memries-login']);
    assert.equal(plan.apps[0].composeProject, 'e2e-memries-albums');
    assert.equal(plan.apps[0].ports.caddy, 19000);
    assert.equal(plan.apps[1].ports.caddy, 19020);
    assert.equal(plan.apps[3].origin, 'http://localhost:19060');
    assert.equal(plan.apps[4].composeProject, undefined);
  });

  it('skips a passed feature with no suite diff', () => {
    const plan = planE2eFeatures({
      discovered: discovered.slice(0, 1),
      lastRunsApps: {
        'memries-albums': {
          lastCommit: 'abc',
          finding: { status: 'passed', summary: '8 passed' },
        },
      },
      suiteHead: 'abc',
      commitExists: () => true,
      changedFilesFor: () => [],
      baseBranch: 'feature/design',
    });
    assert.deepEqual(plan.upToDate, ['memries-albums']);
    assert.deepEqual(plan.launchNow, []);
  });
});

describe('lastRunsCommitTarget', () => {
  it('commits inside the suite repo when last-runs live there', () => {
    const target = lastRunsCommitTarget({
      root: '/repo',
      lastRunsPath: 'apps/memries/.cursor/skills/e2e-docker/last-runs.json',
      suitePath: 'apps/memries',
    });
    assert.equal(target.relPath, '.cursor/skills/e2e-docker/last-runs.json');
    assert.match(target.cwd.replaceAll('\\', '/'), /\/apps\/memries$/);
  });

  it('keeps the umbrella root when last-runs are not under the suite', () => {
    const target = lastRunsCommitTarget({
      root: '/repo',
      lastRunsPath: '.cursor/skills/e2e-docker/last-runs.json',
      suitePath: 'apps/memries',
    });
    assert.deepEqual(target, {
      cwd: '/repo',
      relPath: '.cursor/skills/e2e-docker/last-runs.json',
    });
  });
});
