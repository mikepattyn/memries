#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { packageRoot } from './run-go.mjs';

export function main({ spawn = spawnSync } = {}) {
  const result = spawn('gofmt', ['-w', '.'], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
