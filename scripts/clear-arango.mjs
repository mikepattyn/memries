#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_URL = 'http://127.0.0.1:8529';
const DEFAULT_DB = 'memries';
const DEFAULT_USER = 'root';

const USAGE = `Usage: clear-arango [--url URL] [--db NAME] [--user USER] [--env-file PATH]

Truncate all non-system collections in the Memries Arango database.
Does not delete ./data/photos, thumb cache, or Docker volumes.

Defaults: ${DEFAULT_URL} / ${DEFAULT_DB} / ${DEFAULT_USER}
Password: MEMRIES_ARANGO_PASSWORD or ARANGO_PASSWORD (.env or environment)
`;

/**
 * @param {string[]} argv
 * @returns {{ url?: string, db?: string, user?: string, envFile?: string, help: boolean }}
 */
export function parseArgs(argv) {
  /** @type {{ url?: string, db?: string, user?: string, envFile?: string, help: boolean }} */
  const out = { help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    const take = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('-')) {
        throw new Error(`missing value for ${arg}`);
      }
      i += 1;
      return value;
    };
    if (arg === '--url') out.url = take();
    else if (arg === '--db') out.db = take();
    else if (arg === '--user') out.user = take();
    else if (arg === '--env-file') out.envFile = take();
    else throw new Error(`unknown argument: ${arg}`);
  }
  return out;
}

/**
 * @param {string} text
 * @returns {Record<string, string>}
 */
export function parseEnvFile(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * @param {string} url
 */
export function trimSlash(url) {
  return url.replace(/\/+$/, '');
}

/**
 * @param {{ result?: Array<{ name?: string, isSystem?: boolean }> }} body
 * @returns {string[]}
 */
export function collectionNames(body) {
  const rows = Array.isArray(body?.result) ? body.result : [];
  return rows
    .filter((row) => row && row.name && !row.isSystem)
    .map((row) => row.name);
}

/**
 * @param {string[]} argv
 * @param {{
 *   fetch?: typeof fetch,
 *   readFile?: typeof readFile,
 *   env?: NodeJS.ProcessEnv,
 *   cwd?: string,
 *   log?: (...args: unknown[]) => void,
 *   error?: (...args: unknown[]) => void,
 * }} [deps]
 */
export async function main(argv, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const readFileImpl = deps.readFile ?? readFile;
  const env = deps.env ?? process.env;
  const cwd = deps.cwd ?? process.cwd();
  const log = deps.log ?? console.log;
  const error = deps.error ?? console.error;

  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    error(err instanceof Error ? err.message : String(err));
    error(USAGE.trim());
    return 1;
  }
  if (args.help) {
    log(USAGE.trim());
    return 0;
  }

  const fileEnv = await loadEnvFile(args.envFile, cwd, readFileImpl);
  const url = trimSlash(args.url || env.MEMRIES_ARANGO_URL || fileEnv.MEMRIES_ARANGO_URL || DEFAULT_URL);
  const dbName = args.db || env.MEMRIES_ARANGO_DB || fileEnv.MEMRIES_ARANGO_DB || DEFAULT_DB;
  const user = args.user || env.MEMRIES_ARANGO_USER || fileEnv.MEMRIES_ARANGO_USER || DEFAULT_USER;
  const password =
    env.MEMRIES_ARANGO_PASSWORD ||
    env.ARANGO_PASSWORD ||
    fileEnv.MEMRIES_ARANGO_PASSWORD ||
    fileEnv.ARANGO_PASSWORD ||
    '';

  if (!password) {
    error('ARANGO_PASSWORD or MEMRIES_ARANGO_PASSWORD required (see .env)');
    return 1;
  }

  const auth = `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
  const headers = { Authorization: auth, Accept: 'application/json' };

  let listed;
  try {
    listed = await arangoJson(fetchImpl, `${url}/_db/${encodeURIComponent(dbName)}/_api/collection?excludeSystem=true`, {
      headers,
    });
  } catch (err) {
    if (err instanceof ArangoHttpError && err.status === 404) {
      log(`database ${dbName} does not exist (nothing to clear)`);
      return 0;
    }
    error(formatConnectError(url, err));
    return 1;
  }

  const names = collectionNames(listed);
  names.sort();
  for (const name of names) {
    try {
      await arangoJson(
        fetchImpl,
        `${url}/_db/${encodeURIComponent(dbName)}/_api/collection/${encodeURIComponent(name)}/truncate`,
        { method: 'PUT', headers },
      );
    } catch (err) {
      error(formatConnectError(url, err));
      return 1;
    }
  }

  if (names.length === 0) {
    log(`${dbName} has no document collections`);
  } else {
    log(`cleared ${dbName}: ${names.join(', ')}`);
  }
  return 0;
}

/**
 * @param {string | undefined} envFile
 * @param {string} cwd
 * @param {typeof readFile} readFileImpl
 */
async function loadEnvFile(envFile, cwd, readFileImpl) {
  const path = envFile
    ? isAbsolute(envFile)
      ? envFile
      : resolve(cwd, envFile)
    : join(cwd, '.env');
  try {
    return parseEnvFile(await readFileImpl(path, 'utf8'));
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      return {};
    }
    throw err;
  }
}

class ArangoHttpError extends Error {
  /**
   * @param {number} status
   * @param {string} body
   */
  constructor(status, body) {
    super(`ArangoDB HTTP ${status}${body ? `: ${body}` : ''}`);
    this.status = status;
    this.body = body;
  }
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string} url
 * @param {RequestInit} init
 */
async function arangoJson(fetchImpl, url, init) {
  const res = await fetchImpl(url, init);
  const text = await res.text();
  if (!res.ok) {
    throw new ArangoHttpError(res.status, text.slice(0, 300));
  }
  if (!text) return {};
  return JSON.parse(text);
}

/**
 * @param {string} url
 * @param {unknown} err
 */
function formatConnectError(url, err) {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof ArangoHttpError) {
    if (err.status === 401 || err.status === 403) {
      return `ArangoDB rejected ${url} (${message}). Check ARANGO_PASSWORD.`;
    }
    return message;
  }
  return `Cannot reach ArangoDB at ${url} (${message}). Is the stack up? Try: make up`;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    });
}
