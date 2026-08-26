#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { packageRoot, runGo } from './run-go.mjs';

export function main({ spawn = spawnSync } = {}) {
  const listed = spawn('gofmt', ['-l', '.'], {
    cwd: packageRoot,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  if (listed.stderr) process.stderr.write(listed.stderr);
  if ((listed.status ?? 1) !== 0) return listed.status ?? 1;
  const dirty = String(listed.stdout || '').trim();
  if (dirty) {
    process.stderr.write(`gofmt -l found unformatted files:\n${dirty}\n`);
    return 1;
  }
  return runGo(['vet', './...'], { spawn });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
