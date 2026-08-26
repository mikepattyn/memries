#!/usr/bin/env node
/**
 * Plan, record, and close isolated Playwright feature runs for Memries.
 * Children may author or update e2e/ coverage, then run the feature.
 * The parent merges e2e/ commits; lastCommit advances only on pass.
 *
 * Usage:
 *   node scripts/e2e-docker/e2e-docker.mjs plan [--force] [--app <id> ...] [--base <branch>]
 *   node scripts/e2e-docker/e2e-docker.mjs record [--commit <sha>] [--finding <json>] <id> [<id> ...]
 *   node scripts/e2e-docker/e2e-docker.mjs close --here
 *   node scripts/e2e-docker/e2e-docker.mjs close [--base-worktree] [--base <branch>] <id> [<id> ...]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { closeOpenedWorktrees, parseWorktreeList } from './e2e-docker-close.mjs';
import {
  applyE2eRecord,
  commitLastRunsIfNeeded,
  isAgentWorktreeBranch,
  parseFinding,
} from './e2e-docker-last-runs.mjs';
import {
  applyIsolation,
  composeProjectForId,
  decideE2eFeatureStatus,
  discoverE2eFeatures,
  e2eDiffPaths,
} from './e2e-features.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LAST_RUNS_REL = '.cursor/skills/e2e-docker/last-runs.json';
const LAST_RUNS_PATH = join(ROOT, LAST_RUNS_REL);
const SKILL_ID = 'e2e-docker';
export const MAX_LAUNCH = 20;
const MAX_CHANGED_FILES = 40;
const SUITES = [{ id: 'memries', path: '', featuresDir: 'e2e/features', gitlink: false }];

export function planE2eFeatures({
  discovered,
  lastRunsApps = {},
  suiteHead,
  dockerAvailable = true,
  force = false,
  pathExists = () => true,
  commitExists = () => false,
  changedFilesFor = () => [],
  maxLaunch = MAX_LAUNCH,
  baseBranch,
  skillId = SKILL_ID,
}) {
  const apps = [];
  for (const row of discovered) {
    const recorded = lastRunsApps[row.id] ?? {};
    const lastCommit = recorded.lastCommit ?? null;
    const files = lastCommit && suiteHead ? changedFilesFor(row) : [];
    const decided = decideE2eFeatureStatus({
      gitlinkPinned: !row.gitlink || Boolean(suiteHead),
      pathExists: pathExists(row),
      dockerAvailable,
      force,
      lastCommit,
      findingStatus: recorded.finding?.status ?? null,
      commitExists: lastCommit ? commitExists(lastCommit) : false,
      changedFiles: files,
    });
    const name = `${skillId}-${row.id}`;
    const entry = {
      id: row.id,
      skill: skillId,
      kind: row.kind,
      workflow: row.workflow,
      path: row.path,
      agentName: name,
      worktreeBranch: name,
      baseBranch,
      lastCommit,
      status: decided.status,
      reason: decided.reason,
      changedFiles: files.slice(0, MAX_CHANGED_FILES),
      changedFileCount: files.length,
      featureFile: row.featureFile,
      suiteId: row.suiteId,
      suitePath: row.suitePath,
      suiteCommit: suiteHead || null,
    };
    if (recorded.finding) entry.finding = recorded.finding;
    apps.push(entry);
  }

  const needsRun = apps.filter((a) => a.status === 'needs-run');
  const launchSlice = applyIsolation(needsRun.slice(0, maxLaunch));
  const isolatedById = new Map(launchSlice.map((row) => [row.id, row]));
  for (const app of apps) {
    const extra = isolatedById.get(app.id);
    if (!extra?.composeProject) continue;
    app.composeProject = extra.composeProject;
    app.origin = extra.origin;
    app.ports = extra.ports;
  }

  const launchNow = launchSlice.map((a) => a.id);
  const upToDate = apps.filter((a) => a.status === 'up-to-date').map((a) => a.id);
  const plan = {
    skill: skillId,
    kind: 'atomic',
    cohort: 'e2e',
    steps: ['e2e'],
    baseBranch,
    head: suiteHead || null,
    lastRunsPath: LAST_RUNS_REL,
    force,
    maxLaunch,
    apps,
    needsRun: needsRun.map((a) => a.id),
    launchNow,
    deferred: needsRun.slice(maxLaunch).map((a) => a.id),
    upToDate,
    skipped: apps.filter((a) => a.status === 'skipped').map((a) => a.id),
  };
  if (!force && launchNow.length === 0 && upToDate.length) {
    plan.hint = 'pass --force to rerun every feature and refresh last-runs';
  }
  return plan;
}

function usage() {
  console.error(`Usage:
  node scripts/e2e-docker/e2e-docker.mjs plan [--force] [--app <id> ...] [--base <branch>]
  node scripts/e2e-docker/e2e-docker.mjs record [--commit <sha>] [--finding <json>] <id> [<id> ...]
  node scripts/e2e-docker/e2e-docker.mjs close --here
  node scripts/e2e-docker/e2e-docker.mjs close [--base-worktree] [--base <branch>] <id> [<id> ...]`);
  process.exit(2);
}

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', ['-C', ROOT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (err) {
    if (allowFail) return '';
    const detail = err.stderr?.toString().trim() || err.message;
    throw new Error(`git ${args.join(' ')} failed: ${detail}`);
  }
}

function gitOk(args) {
  try {
    execFileSync('git', ['-C', ROOT, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

let dockerInfoCache;

function dockerAvailable() {
  if (dockerInfoCache !== undefined) return dockerInfoCache;
  try {
    execFileSync('docker', ['info'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 15_000,
    });
    dockerInfoCache = true;
  } catch {
    dockerInfoCache = false;
  }
  return dockerInfoCache;
}

function listFeatureFiles(dir) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs).filter((name) => name.endsWith('.feature'));
}

function loadLastRuns() {
  if (!existsSync(LAST_RUNS_PATH)) return { version: 1, apps: {} };
  const parsed = JSON.parse(readFileSync(LAST_RUNS_PATH, 'utf8'));
  if (!parsed || parsed.version !== 1 || typeof parsed.apps !== 'object' || parsed.apps === null) {
    throw new Error(`${LAST_RUNS_REL} must be { version: 1, apps: { ... } }`);
  }
  return parsed;
}

function detectCurrentBranch() {
  const name = git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
  if (!name || name === 'HEAD') {
    throw new Error('e2e-docker needs a named branch; checkout is detached.');
  }
  if (isAgentWorktreeBranch(name)) {
    throw new Error(
      `current branch '${name}' looks like an agent worktree. Checkout the feature branch first.`,
    );
  }
  return name;
}

function resolveBaseBranch(opts = {}) {
  const named = typeof opts.base === 'string' && opts.base ? opts.base : detectCurrentBranch();
  if (isAgentWorktreeBranch(named)) {
    throw new Error(`base branch '${named}' looks like an agent worktree.`);
  }
  if (!gitOk(['rev-parse', '--verify', `${named}^{commit}`])) {
    throw new Error(`local branch '${named}' is required for e2e-docker plans`);
  }
  return named;
}

function suiteChangedFiles(lastCommit, head, paths) {
  if (!lastCommit || !head || !paths?.length) return [];
  const out = git(['diff', '--name-only', `${lastCommit}..${head}`, '--', ...paths], {
    allowFail: true,
  });
  if (!out) return [];
  return out.split(/\r?\n/).filter(Boolean);
}

function composeDown(project) {
  try {
    execFileSync('docker', ['compose', '-p', project, 'down', '-v', '--remove-orphans'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    // leftover stacks are best-effort
  }
}

function plan(opts) {
  const branch = resolveBaseBranch(opts);
  const suiteHead = git(['rev-parse', 'HEAD'], { allowFail: true });
  const lastRuns = loadLastRuns();
  const wanted = new Set(opts.apps);
  const discovered = discoverE2eFeatures({
    suites: SUITES,
    listFeatures: listFeatureFiles,
  }).filter((row) => !wanted.size || wanted.has(row.id));

  return planE2eFeatures({
    discovered,
    lastRunsApps: lastRuns.apps,
    suiteHead,
    dockerAvailable: dockerAvailable(),
    force: Boolean(opts.force),
    pathExists: (row) => existsSync(join(ROOT, row.path)),
    commitExists: (sha) => gitOk(['cat-file', '-e', `${sha}^{commit}`]),
    changedFilesFor: (row) =>
      suiteChangedFiles(
        lastRuns.apps[row.id]?.lastCommit,
        suiteHead,
        e2eDiffPaths(row.featuresDir, row.featureFile),
      ),
    maxLaunch: MAX_LAUNCH,
    baseBranch: branch,
  });
}

function record(ids, opts) {
  if (!ids.length) usage();
  const finding = parseFinding(opts.finding);
  const discovered = new Map(
    discoverE2eFeatures({ suites: SUITES, listFeatures: listFeatureFiles }).map((a) => [a.id, a]),
  );
  const lastRuns = loadLastRuns();
  const beforeApps = structuredClone(lastRuns.apps);
  const recordedAt = new Date().toISOString();
  const sha = opts.commit || git(['rev-parse', 'HEAD'], { allowFail: true }) || null;

  for (const id of ids) {
    const app = discovered.get(id);
    if (!app) throw new Error(`unknown e2e feature id '${id}' — no matching feature file`);
    lastRuns.apps[id] = applyE2eRecord({
      previous: lastRuns.apps[id],
      path: app.path,
      sha,
      recordedAt,
      finding,
    });
  }

  mkdirSync(dirname(LAST_RUNS_PATH), { recursive: true });
  writeFileSync(LAST_RUNS_PATH, `${JSON.stringify(lastRuns, null, 2)}\n`, 'utf8');
  const lastRunsCommit = commitLastRunsIfNeeded({
    beforeApps,
    afterApps: lastRuns.apps,
    ids,
    skillId: SKILL_ID,
    relPath: LAST_RUNS_REL,
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true }),
    runGit: (args, options) => git(args, options),
  });
  const result = {
    skill: SKILL_ID,
    lastRunsPath: LAST_RUNS_REL,
    commit: sha,
    ids,
    lastRunsCommitted: lastRunsCommit.committed,
  };
  if (finding) result.finding = finding;
  if (lastRunsCommit.message) result.lastRunsMessage = lastRunsCommit.message;
  if (lastRunsCommit.commit) result.lastRunsCommit = lastRunsCommit.commit;
  return result;
}

function closeHelpers() {
  return {
    removeDir: (p) => rmSync(p, { recursive: true, force: true, maxRetries: 8, retryDelay: 150 }),
    exists: (p) => existsSync(p),
  };
}

function closeHere() {
  const here = process.cwd();
  const listPorcelain = git(['worktree', 'list', '--porcelain']);
  const listed = parseWorktreeList(listPorcelain);
  const primaryPath = listed[0]?.path;
  if (!primaryPath) {
    throw new Error('cannot resolve the primary checkout from this directory');
  }
  return closeOpenedWorktrees({
    here,
    deleteBranch: false,
    primaryPath,
    listPorcelain,
    runGit: (args, options) => git(args, options),
    ...closeHelpers(),
  });
}

function closeSkill(ids, opts) {
  if (!opts.baseWorktree && !ids.length) usage();
  const listPorcelain = git(['worktree', 'list', '--porcelain']);
  const listed = parseWorktreeList(listPorcelain);
  const primaryPath = listed[0]?.path || ROOT;
  const branches = ids.map((id) => `${SKILL_ID}-${id}`);
  for (const id of ids) composeDown(composeProjectForId(id));
  return closeOpenedWorktrees({
    branches,
    baseWorktree: opts.baseWorktree ? resolveBaseBranch(opts) : null,
    deleteBranch: true,
    primaryPath,
    listPorcelain,
    runGit: (args, options) => git(args, options),
    ...closeHelpers(),
  });
}

export function buildE2ePlan(opts) {
  return plan(opts);
}

export function recordE2eFindings(ids, opts) {
  return record(ids, opts);
}

export function main(argv = process.argv.slice(2)) {
  const { cmd, ids, opts } = parseArgs(argv);
  let result;
  if (cmd === 'plan') result = plan(opts);
  else if (cmd === 'record') result = record(ids, opts);
  else if (cmd === 'close') result = opts.here ? closeHere() : closeSkill(ids, opts);
  else usage();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function parseArgs(argv) {
  const positional = [];
  const opts = {
    apps: [],
    force: false,
    commit: null,
    finding: null,
    base: null,
    here: false,
    baseWorktree: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--force') opts.force = true;
    else if (arg === '--here') opts.here = true;
    else if (arg === '--base-worktree') opts.baseWorktree = true;
    else if (arg === '--app') opts.apps.push(argv[++i]);
    else if (arg === '--commit') opts.commit = argv[++i];
    else if (arg === '--finding') opts.finding = argv[++i];
    else if (arg === '--base') opts.base = argv[++i];
    else if (arg.startsWith('-')) usage();
    else positional.push(arg);
  }
  return { cmd: positional[0], ids: positional.slice(1), opts };
}

const isMain = Boolean(process.argv[1]) && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMain) {
  main();
}
