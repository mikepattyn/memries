import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { extrasFor, fillPruneOutput, ROOT_EXTRAS, BACKEND_EXTRAS } from './fill-prune-output.mjs';

describe('extrasFor', () => {
  it('adds Go module files only for a backend filter', () => {
    assert.deepEqual(extrasFor('@memries/frontend'), ROOT_EXTRAS);
    assert.deepEqual(extrasFor('@memries/backend'), [...ROOT_EXTRAS, ...BACKEND_EXTRAS]);
  });
});

describe('fillPruneOutput', () => {
  it('copies present extras into out/json and out/full', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'prune-fill-'));
    mkdirSync(join(repoRoot, 'out', 'json'), { recursive: true });
    mkdirSync(join(repoRoot, 'out', 'full'), { recursive: true });
    writeFileSync(join(repoRoot, 'pnpm-lock.yaml'), 'lock: 1\n');
    writeFileSync(join(repoRoot, 'turbo.json'), '{}\n');
    writeFileSync(join(repoRoot, 'package.json'), '{}\n');
    const result = fillPruneOutput({ repoRoot, filter: '@memries/frontend' });
    assert.deepEqual(result.copied.sort(), ['package.json', 'pnpm-lock.yaml', 'turbo.json']);
    assert.ok(result.skipped.includes('.npmrc'));
    assert.ok(result.skipped.includes('pnpm-workspace.yaml'));
    assert.equal(readFileSync(join(repoRoot, 'out', 'json', 'turbo.json'), 'utf8'), '{}\n');
    assert.equal(readFileSync(join(repoRoot, 'out', 'full', 'pnpm-lock.yaml'), 'utf8'), 'lock: 1\n');
    assert.equal(existsSync(join(repoRoot, 'out', 'json', '.npmrc')), false);
  });

  it('copies go.mod into nested paths for backend', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'prune-fill-go-'));
    mkdirSync(join(repoRoot, 'out', 'json'), { recursive: true });
    mkdirSync(join(repoRoot, 'out', 'full'), { recursive: true });
    mkdirSync(join(repoRoot, 'apps', 'backend'), { recursive: true });
    writeFileSync(join(repoRoot, 'apps', 'backend', 'go.mod'), 'module example\n');
    writeFileSync(join(repoRoot, 'apps', 'backend', 'go.sum'), '');
    const result = fillPruneOutput({ repoRoot, filter: '@memries/backend' });
    assert.ok(result.copied.includes('apps/backend/go.mod'));
    assert.equal(
      readFileSync(join(repoRoot, 'out', 'json', 'apps', 'backend', 'go.mod'), 'utf8'),
      'module example\n',
    );
  });

  it('throws when prune output dirs are missing', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'prune-fill-miss-'));
    assert.throws(() => fillPruneOutput({ repoRoot }), /turbo prune output missing/);
  });
});
