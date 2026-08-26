/**
 * Close isolated e2e-docker worktrees after a child finishes.
 * Children pass `{ here }` (remove the worktree, keep the branch).
 * The parent removes leftovers and does not delete the agent branch.
 */
import { join } from 'node:path';
import { isAgentWorktreeBranch } from './e2e-docker-last-runs.mjs';

export function parseWorktreeList(porcelain) {
  const items = [];
  let current = null;
  const flush = () => {
    if (current) items.push(current);
    current = null;
  };
  for (const line of String(porcelain || '').split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      flush();
      current = {
        path: line.slice('worktree '.length),
        head: '',
        branch: null,
        detached: false,
      };
      continue;
    }
    if (!current) continue;
    if (line.startsWith('HEAD ')) current.head = line.slice('HEAD '.length);
    else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    } else if (line === 'detached') current.detached = true;
    else if (line === '') flush();
  }
  flush();
  return items;
}

function norm(p) {
  return String(p || '')
    .replaceAll('\\', '/')
    .replace(/\/+$/, '');
}

function samePath(a, b) {
  return norm(a).toLowerCase() === norm(b).toLowerCase();
}

function containsPath(outer, inner) {
  const o = norm(outer).toLowerCase();
  const i = norm(inner).toLowerCase();
  return i === o || i.startsWith(`${o}/`);
}

function isAbsolutePath(p) {
  return /^([a-zA-Z]:[\\/]|\/|\\\\)/.test(p);
}

function resolveHereEntry(list, here) {
  const matches = list.filter((entry) => containsPath(entry.path, here));
  matches.sort((a, b) => norm(b.path).length - norm(a.path).length);
  return matches[0] ?? null;
}

function expectedWorktreePath(primaryPath, branch) {
  return join(primaryPath, '.worktrees', branch);
}

function assertNotPrimary(path, primaryPath, primaryListed) {
  if (samePath(path, primaryPath) || samePath(path, primaryListed)) {
    throw new Error('refusing to close the primary checkout');
  }
}

function removeWorktreePath(path, runGit, removeDir, exists) {
  try {
    runGit(['worktree', 'remove', '--force', path]);
  } catch {
    runGit(['worktree', 'prune'], { allowFail: true });
    if (exists(path)) removeDir(path);
    runGit(['worktree', 'prune'], { allowFail: true });
  }
  if (exists(path)) {
    removeDir(path);
    runGit(['worktree', 'prune'], { allowFail: true });
  }
}

function deleteAgentBranch(branch, runGit) {
  if (!branch || !isAgentWorktreeBranch(branch)) return false;
  const ref = runGit(['rev-parse', '--verify', `refs/heads/${branch}`], { allowFail: true });
  if (!ref) return false;
  runGit(['branch', '-D', branch], { allowFail: true });
  return true;
}

export function closeOpenedWorktrees({
  here,
  branches = [],
  cloneDirs = [],
  baseWorktree,
  deleteBranch = false,
  primaryPath,
  listPorcelain,
  runGit,
  removeDir,
  exists = () => false,
}) {
  if (!primaryPath) throw new Error('primaryPath is required');
  const list = parseWorktreeList(listPorcelain);
  const primaryListed = list[0]?.path || primaryPath;
  const closed = [];
  const alreadyClosed = [];
  const targets = [];

  if (here) {
    assertNotPrimary(here, primaryPath, primaryListed);
    const entry = resolveHereEntry(list, here);
    if (!entry) {
      alreadyClosed.push(here);
    } else {
      assertNotPrimary(entry.path, primaryPath, primaryListed);
      targets.push({ path: entry.path, branch: entry.branch });
    }
  }

  for (const branch of branches) {
    const entry = list.find((item) => item.branch === branch);
    if (entry) {
      assertNotPrimary(entry.path, primaryPath, primaryListed);
      targets.push({ path: entry.path, branch });
      continue;
    }
    const orphan = expectedWorktreePath(primaryPath, branch);
    if (exists(orphan)) {
      assertNotPrimary(orphan, primaryPath, primaryListed);
      targets.push({ path: orphan, branch });
      continue;
    }
    if (deleteBranch && deleteAgentBranch(branch, runGit)) {
      closed.push({ path: null, branch, deletedBranch: true });
    } else {
      alreadyClosed.push(branch);
    }
  }

  if (baseWorktree) {
    const expected = expectedWorktreePath(primaryPath, baseWorktree);
    const entry =
      list.find((item) => samePath(item.path, expected)) ||
      list.find(
        (item) =>
          item.branch === baseWorktree && containsPath(join(primaryPath, '.worktrees'), item.path),
      );
    if (entry) {
      assertNotPrimary(entry.path, primaryPath, primaryListed);
      targets.push({ path: entry.path, branch: entry.branch, keepBranch: true });
    } else if (exists(expected)) {
      assertNotPrimary(expected, primaryPath, primaryListed);
      targets.push({ path: expected, branch: baseWorktree, keepBranch: true });
    }
  }

  const seen = new Set();
  for (const target of targets) {
    const key = norm(target.path).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    removeWorktreePath(target.path, runGit, removeDir, exists);
    const deleted =
      deleteBranch && !target.keepBranch ? deleteAgentBranch(target.branch, runGit) : false;
    closed.push({ path: target.path, branch: target.branch, deletedBranch: deleted });
  }

  const failed = [];
  const gitlinksRoot = join(primaryPath, '.worktrees', 'gitlinks');
  for (const rel of cloneDirs) {
    const abs = isAbsolutePath(rel) ? rel : join(primaryPath, rel);
    if (!exists(abs)) continue;
    assertNotPrimary(abs, primaryPath, primaryListed);
    if (!containsPath(gitlinksRoot, abs)) {
      throw new Error(`refusing to remove clone dir outside .worktrees/gitlinks: ${rel}`);
    }
    try {
      removeDir(abs);
      closed.push({ path: abs, branch: null, deletedBranch: false, cloneDir: rel });
    } catch (err) {
      failed.push({ path: abs, cloneDir: rel, error: err.message || String(err) });
    }
  }

  return { closed, alreadyClosed, failed };
}
