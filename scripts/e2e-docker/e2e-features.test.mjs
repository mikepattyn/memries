import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyIsolation,
  composeProjectForId,
  decideE2eFeatureStatus,
  discoverE2eFeatures,
  e2eDiffPaths,
  featureId,
  featureRelPath,
  isolationForLaunchIndex,
} from './e2e-features.mjs';

const localSuite = {
  id: 'memries',
  path: '',
  featuresDir: 'e2e/features',
  gitlink: false,
};

const umbrellaSuite = {
  id: 'memries',
  path: 'apps/memries',
  featuresDir: 'e2e/features',
  gitlink: true,
};

describe('featureRelPath', () => {
  it('uses the features dir when the suite is the repo root', () => {
    assert.equal(featureRelPath('', 'e2e/features'), 'e2e/features');
    assert.equal(featureRelPath('.', 'e2e/features'), 'e2e/features');
  });

  it('prefixes a nested suite path', () => {
    assert.equal(featureRelPath('apps/memries', 'e2e/features'), 'apps/memries/e2e/features');
  });
});

describe('featureId', () => {
  it('joins suite and feature stem', () => {
    assert.equal(featureId('memries', 'timeline.feature'), 'memries-timeline');
    assert.equal(featureId('memries', 'viewer-keyboard.feature'), 'memries-viewer-keyboard');
  });
});

describe('discoverE2eFeatures', () => {
  it('emits one row per feature file at the repo root', () => {
    const apps = discoverE2eFeatures({
      suites: [localSuite],
      listFeatures: (dir) => {
        assert.equal(dir, 'e2e/features');
        return ['albums.feature', 'timeline.feature'];
      },
    });
    assert.deepEqual(
      apps.map((a) => a.id),
      ['memries-albums', 'memries-timeline'],
    );
    assert.deepEqual(apps[1], {
      id: 'memries-timeline',
      kind: 'e2e-feature',
      workflow: null,
      path: 'e2e/features/timeline.feature',
      suiteId: 'memries',
      suitePath: '.',
      featuresDir: 'e2e/features',
      featureFile: 'timeline.feature',
      gitlink: false,
    });
  });

  it('keeps the umbrella-relative path when the suite is nested', () => {
    const apps = discoverE2eFeatures({
      suites: [umbrellaSuite],
      listFeatures: (dir) => {
        assert.equal(dir, 'apps/memries/e2e/features');
        return ['timeline.feature'];
      },
    });
    assert.equal(apps[0].path, 'apps/memries/e2e/features/timeline.feature');
    assert.equal(apps[0].suitePath, 'apps/memries');
    assert.equal(apps[0].gitlink, true);
  });

  it('discovers checked-out feature files', () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
    const dir = join(root, 'e2e', 'features');
    if (!existsSync(dir)) return;
    const files = readdirSync(dir).filter((name) => name.endsWith('.feature'));
    if (!files.includes('timeline.feature')) return;
    const apps = discoverE2eFeatures({
      suites: [localSuite],
      listFeatures: (rel) =>
        readdirSync(join(root, rel)).filter((name) => name.endsWith('.feature')),
    });
    assert.ok(apps.some((a) => a.id === 'memries-timeline'));
    assert.equal(apps.length, files.length);
  });
});

describe('e2eDiffPaths', () => {
  it('includes the feature file, shared harness, and app code', () => {
    assert.deepEqual(e2eDiffPaths('e2e/features', 'timeline.feature'), [
      'e2e/features/timeline.feature',
      'e2e/steps',
      'e2e/scripts',
      'e2e/docker-compose.yml',
      'e2e/playwright.config.ts',
      'e2e/deploy',
      'frontend',
      'backend',
    ]);
  });
});

describe('isolationForLaunchIndex', () => {
  it('uses the 19000 band so 18080 stays free', () => {
    assert.deepEqual(isolationForLaunchIndex(0), {
      ports: {
        caddy: 19000,
        backend: 19001,
        frontend: 19002,
        arango: 19003,
        dex: 19004,
      },
      origin: 'http://localhost:19000',
    });
    assert.equal(isolationForLaunchIndex(1).ports.caddy, 19020);
  });
});

describe('composeProjectForId', () => {
  it('prefixes the feature id', () => {
    assert.equal(composeProjectForId('memries-timeline'), 'e2e-memries-timeline');
  });
});

describe('applyIsolation', () => {
  it('assigns ports by launch index, not by name', () => {
    const rows = applyIsolation([{ id: 'memries-viewer' }, { id: 'memries-albums' }]);
    assert.equal(rows[0].composeProject, 'e2e-memries-viewer');
    assert.equal(rows[0].ports.caddy, 19000);
    assert.equal(rows[1].ports.caddy, 19020);
  });
});

describe('decideE2eFeatureStatus', () => {
  it('needs a run when never recorded', () => {
    assert.deepEqual(decideE2eFeatureStatus({ pathExists: true }), {
      status: 'needs-run',
      reason: 'never-run',
    });
  });

  it('is up to date when the last finding passed and there is no diff', () => {
    assert.deepEqual(
      decideE2eFeatureStatus({
        pathExists: true,
        lastCommit: 'abc',
        commitExists: true,
        findingStatus: 'passed',
        changedFiles: [],
      }),
      { status: 'up-to-date', reason: 'no-diff' },
    );
  });
});
