#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { goEnv, runGo } from './run-go.mjs';

export function main() {
  return runGo(['test', './...'], { env: goEnv() });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
