import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { claimSlot } from '../../e2e/scripts/e2e-slots.mjs';
import { lastRunsCommitTarget } from './e2e-docker-last-runs.mjs';
import { downFanoutProjects, MAX_LAUNCH, planE2eFeatures } from './e2e-docker.mjs';

const temps = [];

function leaseRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'memries-e2e-plan-'));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  while (temps.length) {
    rmSync(temps.pop(), { recursive: true, force: true });
  }
});

function feature(stem) {
  return {
    id: `memries-${stem}`,
    kind: 'e2e-feature',
    workflow: null,
    path: `apps/e2e/features/${stem}.feature`,
    featureFile: `${stem}.feature`,
    suiteId: 'memries',
    suitePath: '.',
    gitlink: false,
  };
}

const discovered = Array.from({ length: MAX_LAUNCH + 1 }, (_, i) =>
  feature(`f${String(i).padStart(2, '0')}`),
);

describe('planE2eFeatures', () => {
  it('launches at most four never-run features as wave 1.1 and previews later slices', () => {
    const plan = planE2eFeatures({
      discovered,
      suiteHead: 'abc',
      baseBranch: 'feature/design',
    });
    assert.equal(plan.maxLaunch, 4);
    assert.equal(plan.launchNow.length, 4);
    assert.deepEqual(plan.deferred, ['memries-f04']);
    assert.deepEqual(
      plan.waves.map((w) => w.label),
      ['1.1', '1.2'],
    );
    assert.deepEqual(plan.waves[0].launchNow, plan.launchNow);
    assert.equal(plan.apps[0].composeProject, 'e2e-memries-f00');
    assert.equal(plan.apps[0].ports.caddy, 19000);
    assert.equal(plan.apps[1].ports.caddy, 19020);
    assert.equal(plan.apps[3].origin, 'http://localhost:19060');
    assert.equal(plan.apps[4].composeProject, undefined);
  });

  it('skips a passed feature with no suite diff', () => {
    const plan = planE2eFeatures({
      discovered: discovered.slice(0, 1),
      lastRunsApps: {
        'memries-f00': {
          lastCommit: 'abc',
          finding: { status: 'passed', summary: '8 passed' },
        },
      },
      suiteHead: 'abc',
      commitExists: () => true,
      changedFilesFor: () => [],
      baseBranch: 'feature/design',
    });
    assert.deepEqual(plan.upToDate, ['memries-f00']);
    assert.deepEqual(plan.launchNow, []);
    assert.equal(
      plan.hint,
      'pass --force to rerun every feature and refresh last-runs',
    );
  });

  it('force-relaunches passed features so last-runs can refresh', () => {
    const plan = planE2eFeatures({
      discovered: discovered.slice(0, 2),
      lastRunsApps: {
        'memries-f00': {
          lastCommit: 'abc',
          finding: { status: 'passed', summary: '8 passed' },
        },
        'memries-f01': {
          lastCommit: 'abc',
          finding: { status: 'passed', summary: '4 passed' },
        },
      },
      suiteHead: 'abc',
      force: true,
      commitExists: () => true,
      changedFilesFor: () => [],
      baseBranch: 'feature/design',
    });
    assert.equal(plan.force, true);
    assert.deepEqual(plan.upToDate, []);
    assert.deepEqual(plan.launchNow, ['memries-f00', 'memries-f01']);
    assert.equal(plan.apps[0].reason, 'force');
    assert.equal(plan.apps[1].reason, 'force');
    assert.equal(plan.apps[0].composeProject, 'e2e-memries-f00');
    assert.equal(plan.apps[1].composeProject, 'e2e-memries-f01');
    assert.equal(plan.hint, undefined);
  });

  it('blocks launchNow when a prior slot is still active', () => {
    const plan = planE2eFeatures({
      discovered,
      suiteHead: 'abc',
      baseBranch: 'feature/design',
      listBusySlots: () => [
        {
          slot: 3,
          project: 'e2e-memries-navigation',
          ports: { caddy: 19060, backend: 19061, frontend: 19062, arango: 19063, dex: 19064 },
        },
      ],
    });
    assert.deepEqual(plan.launchNow, []);
    assert.deepEqual(
      plan.deferred,
      discovered.map((row) => row.id),
    );
    assert.equal(plan.hint, 'band held by e2e-memries-navigation; close that slice first');
    assert.equal(plan.apps[0].ports.caddy, 19000);
    assert.equal(plan.apps[3].ports.caddy, 19060);
  });
});

describe('downFanoutProjects', () => {
  it('surfaces a teardown failure and keeps the lease', () => {
    const root = leaseRoot();
    claimSlot({ slot: 0, project: 'e2e-memries-f00', leaseRoot: root });
    const stacks = downFanoutProjects(['memries-f00'], {
      leaseRoot: root,
      composeDown: () => {
        throw new Error('compose down failed');
      },
    });
    assert.equal(stacks[0].ok, false);
    assert.equal(stacks[0].error, 'compose down failed');
    assert.equal(stacks[0].released, false);
  });

  it('releases a confirmed-stopped lease', () => {
    const root = leaseRoot();
    claimSlot({ slot: 0, project: 'e2e-memries-f00', leaseRoot: root });
    const stacks = downFanoutProjects(['memries-f00'], {
      leaseRoot: root,
      composeDown: () => {},
    });
    assert.equal(stacks[0].ok, true);
    assert.equal(stacks[0].released, true);
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
