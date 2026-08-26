#!/usr/bin/env node
/**
 * Copy lockfile and root config files that turbo prune --docker sometimes omits
 * into both out/json and out/full.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ROOT_EXTRAS = [
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'package.json',
  'turbo.json',
  '.npmrc',
];

export const BACKEND_EXTRAS = ['apps/backend/go.mod', 'apps/backend/go.sum'];

export function extrasFor(filter = '') {
  return /backend/i.test(String(filter)) ? [...ROOT_EXTRAS, ...BACKEND_EXTRAS] : [...ROOT_EXTRAS];
}

export function fillPruneOutput({ repoRoot, outDir = join(repoRoot, 'out'), filter = '' } = {}) {
  if (!repoRoot) throw new Error('repoRoot is required');
  const jsonDir = join(outDir, 'json');
  const fullDir = join(outDir, 'full');
  if (!existsSync(jsonDir) || !existsSync(fullDir)) {
    throw new Error(`turbo prune output missing under ${outDir} (need json/ and full/)`);
  }
  const copied = [];
  const skipped = [];
  for (const rel of extrasFor(filter)) {
    const src = join(repoRoot, rel);
    if (!existsSync(src)) {
      skipped.push(rel);
      continue;
    }
    for (const destRoot of [jsonDir, fullDir]) {
      const dest = join(destRoot, rel);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(src, dest);
    }
    copied.push(rel);
  }
  return { copied, skipped };
}

export function main(argv = process.argv.slice(2), { repoRoot = process.cwd(), log = console.log } = {}) {
  const filter = argv[0] || '';
  const result = fillPruneOutput({ repoRoot, filter });
  log(JSON.stringify(result));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
