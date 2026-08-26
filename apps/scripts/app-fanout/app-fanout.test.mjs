import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  decideTreeStatus,
  listSkillsFromConfig,
  maxLaunchOf,
  planTrees,
  planUmbrellaWaves,
} from './app-fanout.mjs';

const config = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'app-fanout.config.json'), 'utf8'),
);

describe('app-fanout.config', () => {
  it('registers four quality waves and no scripts-to-node', () => {
    const waves = config.skills['platform-quality'].waves;
    assert.deepEqual(
      waves.map((w) => w.step),
      ['page-accessibility', 'e2e', 'lint', 'format'],
    );
    assert.deepEqual(waves[1].skills, ['e2e-docker']);
    assert.equal(config.skills['scripts-to-node'], undefined);
    assert.equal(config.skills['e2e-docker'].maxLaunch, 4);
    assert.equal(config.skills['platform-quality'].maxLaunch, 4);
    assert.equal(config.maxLaunch, 40);
  });

  it('pins local trees only', () => {
    assert.deepEqual(config.skills['frontend-lint'].trees, [{ id: 'frontend', path: 'apps/frontend' }]);
    assert.deepEqual(config.skills['backend-format'].trees, [{ id: 'backend', path: 'apps/backend' }]);
    assert.deepEqual(
      config.skills['platform-lint'].trees.map((t) => t.id),
      ['e2e', 'scripts'],
    );
  });
});

describe('maxLaunchOf', () => {
  it('uses the skill cap when it is lower than the global cap', () => {
    assert.equal(maxLaunchOf(config, config.skills['e2e-docker']), 4);
    assert.equal(maxLaunchOf(config, config.skills['platform-quality']), 4);
    assert.equal(maxLaunchOf(config, config.skills['frontend-lint']), 40);
  });
});

describe('decideTreeStatus', () => {
  it('needs a run when never recorded', () => {
    assert.deepEqual(decideTreeStatus({}), { status: 'needs-run', reason: 'never-run' });
  });

  it('is up to date when there is no diff', () => {
    assert.deepEqual(
      decideTreeStatus({ lastCommit: 'aaa', commitExists: true, changedFiles: [] }),
      { status: 'up-to-date', reason: 'no-diff' },
    );
  });
});

describe('planTrees', () => {
  const discovered = [
    { id: 'frontend', kind: 'tree', workflow: null, path: 'frontend' },
    { id: 'backend', kind: 'tree', workflow: null, path: 'backend' },
    { id: 'e2e', kind: 'tree', workflow: null, path: 'e2e' },
  ];

  it('launches never-run trees and defers past the cap', () => {
    const plan = planTrees({
      discovered,
      head: 'abc',
      maxLaunch: 2,
      baseBranch: 'feature/quality',
      skillId: 'platform-lint',
      lastRunsPath: '.cursor/skills/platform-lint/last-runs.json',
      steps: ['lint'],
      cohort: 'platform',
    });
    assert.deepEqual(plan.launchNow, ['frontend', 'backend']);
    assert.deepEqual(plan.deferred, ['e2e']);
    assert.equal(plan.apps[0].agentName, 'platform-lint-frontend');
    assert.equal(plan.apps[0].baseBranch, 'feature/quality');
  });

  it('skips a tree with no diff since lastCommit', () => {
    const plan = planTrees({
      discovered: discovered.slice(0, 1),
      lastRunsApps: { frontend: { lastCommit: 'abc' } },
      head: 'abc',
      baseBranch: 'feature/quality',
      skillId: 'frontend-lint',
      lastRunsPath: '.cursor/skills/frontend-lint/last-runs.json',
      steps: ['lint'],
      commitExists: () => true,
      changedFilesFor: () => [],
    });
    assert.deepEqual(plan.upToDate, ['frontend']);
    assert.deepEqual(plan.launchNow, []);
  });
});

describe('planUmbrellaWaves', () => {
  it('keeps e2e after page-accessibility and before lint/format', () => {
    const frontend = planTrees({
      discovered: [{ id: 'frontend', kind: 'tree', workflow: null, path: 'frontend' }],
      head: 'abc',
      baseBranch: 'main',
      skillId: 'frontend-page-accessibility',
      lastRunsPath: '.cursor/skills/frontend-page-accessibility/last-runs.json',
      steps: ['page-accessibility'],
    });
    const e2e = {
      skill: 'e2e-docker',
      steps: ['e2e'],
      lastRunsPath: '.cursor/skills/e2e-docker/last-runs.json',
      apps: [
        {
          id: 'memries-login',
          skill: 'e2e-docker',
          status: 'needs-run',
          agentName: 'e2e-docker-memries-login',
          worktreeBranch: 'e2e-docker-memries-login',
          baseBranch: 'main',
          path: 'e2e/features/login.feature',
          featureFile: 'login.feature',
          suiteCommit: 'abc',
          composeProject: 'e2e-memries-login',
          origin: 'http://localhost:19000',
          ports: { caddy: 19000 },
        },
      ],
    };
    const lint = planTrees({
      discovered: [{ id: 'frontend', kind: 'tree', workflow: null, path: 'frontend' }],
      head: 'abc',
      baseBranch: 'main',
      skillId: 'frontend-lint',
      lastRunsPath: '.cursor/skills/frontend-lint/last-runs.json',
      steps: ['lint'],
    });
    const format = planTrees({
      discovered: [{ id: 'frontend', kind: 'tree', workflow: null, path: 'frontend' }],
      head: 'abc',
      baseBranch: 'main',
      skillId: 'frontend-format',
      lastRunsPath: '.cursor/skills/frontend-format/last-runs.json',
      steps: ['format'],
    });
    const plan = planUmbrellaWaves({
      waves: config.skills['platform-quality'].waves,
      nestedBySkill: {
        'frontend-page-accessibility': frontend,
        'e2e-docker': e2e,
        'frontend-lint': lint,
        'backend-lint': { apps: [], steps: ['lint'], lastRunsPath: 'x' },
        'platform-lint': { apps: [], steps: ['lint'], lastRunsPath: 'x' },
        'frontend-format': format,
        'backend-format': { apps: [], steps: ['format'], lastRunsPath: 'x' },
        'platform-format': { apps: [], steps: ['format'], lastRunsPath: 'x' },
      },
      maxLaunch: 40,
      baseBranch: 'main',
      head: 'abc',
    });
    assert.deepEqual(plan.steps, ['page-accessibility', 'e2e', 'lint', 'format']);
    assert.equal(plan.waves[1].step, 'e2e');
    assert.equal(plan.waves[1].label, '1.1');
    assert.equal(plan.waves[1].launchNow[0].featureFile, 'login.feature');
    assert.equal(plan.waves[1].launchNow[0].composeProject, 'e2e-memries-login');
    assert.equal(plan.waves[2].step, 'lint');
  });

  it('splits e2e into sequential slices of 4 labeled 1.1, 1.2, 1.3', () => {
    const apps = Array.from({ length: 9 }, (_, i) => ({
      id: `memries-f${i}`,
      skill: 'e2e-docker',
      status: 'needs-run',
      agentName: `e2e-docker-memries-f${i}`,
      worktreeBranch: `e2e-docker-memries-f${i}`,
      baseBranch: 'main',
      path: `e2e/features/f${i}.feature`,
      featureFile: `f${i}.feature`,
      suiteCommit: 'abc',
    }));
    const plan = planUmbrellaWaves({
      waves: [
        { step: 'page-accessibility', skills: ['frontend-page-accessibility'] },
        { step: 'e2e', skills: ['e2e-docker'] },
      ],
      nestedBySkill: {
        'frontend-page-accessibility': {
          apps: [],
          steps: ['page-accessibility'],
          lastRunsPath: '.cursor/skills/frontend-page-accessibility/last-runs.json',
        },
        'e2e-docker': {
          apps,
          steps: ['e2e'],
          lastRunsPath: '.cursor/skills/e2e-docker/last-runs.json',
          maxLaunch: 4,
        },
      },
      maxLaunch: 4,
      waveFilter: 1,
      baseBranch: 'main',
      head: 'abc',
    });
    assert.deepEqual(
      plan.waves.map((w) => w.label),
      ['1.1', '1.2', '1.3'],
    );
    assert.equal(plan.waves[0].launchNow.length, 4);
    assert.equal(plan.waves[1].launchNow.length, 4);
    assert.equal(plan.waves[2].launchNow.length, 1);
    assert.equal(plan.waves[0].deferred.length, 5);
    assert.equal(plan.waves[0].launchNow[0].ports.caddy, 19000);
    assert.equal(plan.waves[0].launchNow[3].ports.caddy, 19060);
    assert.equal(plan.waves[1].launchNow[0].ports.caddy, 19000);
    assert.equal(plan.waves[0].sequential, true);
    assert.equal(plan.waves[0].launchNow[0].slot, 0);
    assert.equal(plan.waves[0].launchNow[3].slot, 3);
  });

  it('blocks e2e launchNow when a prior slot is still active', () => {
    const apps = Array.from({ length: 5 }, (_, i) => ({
      id: `memries-f${i}`,
      skill: 'e2e-docker',
      status: 'needs-run',
      agentName: `e2e-docker-memries-f${i}`,
      worktreeBranch: `e2e-docker-memries-f${i}`,
      baseBranch: 'main',
      path: `e2e/features/f${i}.feature`,
      featureFile: `f${i}.feature`,
      suiteCommit: 'abc',
    }));
    const plan = planUmbrellaWaves({
      waves: [
        { step: 'page-accessibility', skills: ['frontend-page-accessibility'] },
        { step: 'e2e', skills: ['e2e-docker'] },
      ],
      nestedBySkill: {
        'frontend-page-accessibility': {
          apps: [],
          steps: ['page-accessibility'],
          lastRunsPath: 'x',
        },
        'e2e-docker': {
          apps,
          steps: ['e2e'],
          lastRunsPath: '.cursor/skills/e2e-docker/last-runs.json',
          maxLaunch: 4,
        },
      },
      maxLaunch: 4,
      waveFilter: 1,
      baseBranch: 'main',
      head: 'abc',
      listBusySlots: () => [{ slot: 3, project: 'e2e-memries-navigation' }],
    });
    assert.deepEqual(plan.waves[0].launchNow, []);
    assert.deepEqual(plan.waves[1].launchNow, []);
    assert.equal(
      plan.waves[0].hint,
      'band held by e2e-memries-navigation; close that slice first',
    );
    assert.equal(plan.waves[0].deferred.length, 5);
  });

  it('relabels the next remaining e2e batch as 1.2 when that slice is requested', () => {
    const apps = Array.from({ length: 5 }, (_, i) => ({
      id: `memries-f${i}`,
      skill: 'e2e-docker',
      status: 'needs-run',
      agentName: `e2e-docker-memries-f${i}`,
      worktreeBranch: `e2e-docker-memries-f${i}`,
      baseBranch: 'main',
      path: `e2e/features/f${i}.feature`,
      featureFile: `f${i}.feature`,
      suiteCommit: 'abc',
    }));
    const plan = planUmbrellaWaves({
      waves: [
        { step: 'page-accessibility', skills: ['frontend-page-accessibility'] },
        { step: 'e2e', skills: ['e2e-docker'] },
      ],
      nestedBySkill: {
        'frontend-page-accessibility': {
          apps: [],
          steps: ['page-accessibility'],
          lastRunsPath: 'x',
        },
        'e2e-docker': {
          apps,
          steps: ['e2e'],
          lastRunsPath: '.cursor/skills/e2e-docker/last-runs.json',
          maxLaunch: 4,
        },
      },
      maxLaunch: 4,
      waveFilter: { index: 1, slice: 2 },
      baseBranch: 'main',
      head: 'abc',
    });
    assert.deepEqual(
      plan.waves.map((w) => w.label),
      ['1.2', '1.3'],
    );
    assert.equal(plan.waves[0].launchNow.length, 4);
    assert.equal(plan.waves[1].launchNow.length, 1);
  });
});

describe('listSkillsFromConfig', () => {
  it('lists the umbrella without a convert wave', () => {
    const listed = listSkillsFromConfig(config, 'main');
    const umbrella = listed.skills.find((s) => s.id === 'platform-quality');
    assert.equal(umbrella.kind, 'umbrella');
    assert.deepEqual(umbrella.steps, ['page-accessibility', 'e2e', 'lint', 'format']);
    assert.equal(
      listed.skills.some((s) => s.id === 'scripts-to-node'),
      false,
    );
  });
});
