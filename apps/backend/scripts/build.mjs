#!/usr/bin/env node
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { goEnv, packageRoot, runGo } from './run-go.mjs';

export function main() {
  const binDir = join(packageRoot, 'bin');
  mkdirSync(binDir, { recursive: true });
  const env = goEnv();
  const targets = [
    ['build', '-o', join(binDir, 'server'), './cmd/server'],
    ['build', '-o', join(binDir, 'indexer'), './cmd/indexer'],
  ];
  for (const args of targets) {
    const status = runGo(args, { env });
    if (status !== 0) return status;
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
