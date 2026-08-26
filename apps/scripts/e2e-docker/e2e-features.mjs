/**
 * Discover Playwright BDD feature files for the e2e-docker skill.
 * One row per `.feature` file. Isolation (compose project + ports) is assigned
 * by launch index so parallel Docker stacks do not collide.
 */
import { isolationForSlot } from '../../e2e/scripts/e2e-slots.mjs';

export function posix(p) {
  return String(p || '').replaceAll('\\', '/');
}

export function featureRelPath(suitePath, featuresDir) {
  const dir = posix(featuresDir || 'apps/e2e/features').replace(/\/$/, '');
  const root = posix(suitePath || '')
    .replace(/\/$/, '')
    .replace(/^\.$/, '');
  return root ? `${root}/${dir}` : dir;
}

export function featureStem(fileName) {
  return String(fileName || '').replace(/\.feature$/i, '');
}

export function featureId(suiteId, fileName) {
  return `${suiteId}-${featureStem(fileName)}`;
}

export function e2eDiffPaths(featuresDir, featureFile) {
  const dir = posix(featuresDir).replace(/\/$/, '');
  const e2eRoot = dir.replace(/\/features$/, '') || 'apps/e2e';
  return [
    `${dir}/${featureFile}`,
    `${e2eRoot}/steps`,
    `${e2eRoot}/scripts`,
    `${e2eRoot}/docker-compose.yml`,
    `${e2eRoot}/playwright.config.ts`,
    `${e2eRoot}/deploy`,
    'apps/frontend',
    'apps/backend',
  ];
}

export function composeProjectForId(id) {
  return `e2e-${id}`;
}

export function isolationForLaunchIndex(index) {
  return isolationForSlot(index);
}

export function applyIsolation(rows) {
  return rows.map((row, index) => {
    const isolation = isolationForLaunchIndex(index);
    if (!isolation) {
      throw new Error('fan-out stack must use one of the four slot port sets');
    }
    return {
      ...row,
      composeProject: composeProjectForId(row.id),
      origin: isolation.origin,
      ports: isolation.ports,
      slot: isolation.slot,
    };
  });
}

export function parseWaveArg(value) {
  const raw = String(value ?? '').trim();
  if (/^\d+$/.test(raw)) return { index: Number(raw), slice: null };
  const matched = /^(\d+)\.(\d+)$/.exec(raw);
  if (!matched) return null;
  return { index: Number(matched[1]), slice: Number(matched[2]) };
}

export function e2eSequentialWaves(
  needsRun,
  { maxLaunch = 4, startSlice = 1, waveIndex = 1 } = {},
) {
  const size = Number(maxLaunch) > 0 ? Number(maxLaunch) : 4;
  const start = Number(startSlice) > 0 ? Number(startSlice) : 1;
  const index = Number.isInteger(Number(waveIndex)) ? Number(waveIndex) : 1;
  const rows = Array.isArray(needsRun) ? needsRun : [];
  if (!rows.length) {
    return [{ label: `${index}.${start}`, slice: start, sequential: true, rows: [] }];
  }
  const waves = [];
  for (let i = 0; i < rows.length; i += size) {
    const slice = start + waves.length;
    waves.push({
      label: `${index}.${slice}`,
      slice,
      sequential: true,
      rows: applyIsolation(rows.slice(i, i + size)),
    });
  }
  return waves;
}

export function decideE2eFeatureStatus({
  gitlinkPinned = true,
  pathExists = true,
  dockerAvailable = true,
  force = false,
  lastCommit = null,
  findingStatus = null,
  commitExists = false,
  changedFiles = [],
} = {}) {
  if (gitlinkPinned === false) return { status: 'skipped', reason: 'missing-gitlink' };
  if (!pathExists) return { status: 'skipped', reason: 'missing-path' };
  if (!dockerAvailable) return { status: 'skipped', reason: 'docker-unavailable' };
  if (force) return { status: 'needs-run', reason: 'force' };
  if (findingStatus && findingStatus !== 'passed') {
    return { status: 'needs-run', reason: 'last-finding-failed' };
  }
  if (!lastCommit) return { status: 'needs-run', reason: 'never-run' };
  if (!commitExists) return { status: 'needs-run', reason: 'unknown-last-commit' };
  if (Array.isArray(changedFiles) && changedFiles.length) {
    return { status: 'needs-run', reason: 'git-diff' };
  }
  if (findingStatus === 'passed') return { status: 'up-to-date', reason: 'no-diff' };
  return { status: 'needs-run', reason: 'never-run' };
}

export function discoverE2eFeatures({ suites, listFeatures }) {
  if (!Array.isArray(suites) || !suites.length) {
    throw new Error("discover 'e2e-features' requires a non-empty suites array");
  }
  if (typeof listFeatures !== 'function') {
    throw new Error('discoverE2eFeatures requires listFeatures(dir)');
  }
  const apps = [];
  for (const suite of suites) {
    const suiteId = suite.id;
    const suitePath = posix(suite.path || '')
      .replace(/\/$/, '')
      .replace(/^\.$/, '');
    const featuresDir = posix(suite.featuresDir || 'apps/e2e/features');
    const featureRel = featureRelPath(suitePath, featuresDir);
    const files = [...listFeatures(featureRel)].filter(Boolean).sort();
    for (const fileName of files) {
      if (!/\.feature$/i.test(fileName)) continue;
      apps.push({
        id: featureId(suiteId, fileName),
        kind: 'e2e-feature',
        workflow: null,
        path: posix(`${featureRel}/${fileName}`),
        suiteId,
        suitePath: suitePath || '.',
        featuresDir,
        featureFile: fileName,
        gitlink: Boolean(suite.gitlink),
      });
    }
  }
  return apps;
}
