import assert from 'node:assert/strict';
import { test } from 'node:test';

import { collectionNames, main, parseArgs, parseEnvFile, trimSlash } from './clear-arango.mjs';

test('parseArgs reads flags', () => {
  assert.deepEqual(parseArgs(['--url', 'http://x:1', '--db', 'other', '--user', 'root', '--env-file', '.env']), {
    url: 'http://x:1',
    db: 'other',
    user: 'root',
    envFile: '.env',
    help: false,
  });
});

test('parseArgs rejects unknown flags', () => {
  assert.throws(() => parseArgs(['--wipe']), /unknown argument/);
});

test('parseEnvFile skips comments and unwraps quotes', () => {
  const env = parseEnvFile('# hi\nARANGO_PASSWORD="abc"\nMEMRIES_ARANGO_DB=memries\n');
  assert.equal(env.ARANGO_PASSWORD, 'abc');
  assert.equal(env.MEMRIES_ARANGO_DB, 'memries');
});

test('collectionNames drops system collections', () => {
  assert.deepEqual(
    collectionNames({
      result: [
        { name: '_graphs', isSystem: true },
        { name: 'photos', isSystem: false },
        { name: 'index_runs', isSystem: false },
      ],
    }),
    ['photos', 'index_runs'],
  );
});

test('trimSlash removes a trailing slash', () => {
  assert.equal(trimSlash('http://127.0.0.1:8529/'), 'http://127.0.0.1:8529');
});

test('main prints help', async () => {
  const logs = [];
  const code = await main(['--help'], {
    log: (...args) => logs.push(args.join(' ')),
    error: () => {},
    env: {},
  });
  assert.equal(code, 0);
  assert.match(logs.join('\n'), /Truncate all non-system collections/);
});

test('main fails without a password', async () => {
  const errors = [];
  const code = await main([], {
    env: {},
    cwd: '/tmp',
    readFile: async () => {
      const err = new Error('missing');
      err.code = 'ENOENT';
      throw err;
    },
    error: (...args) => errors.push(args.join(' ')),
  });
  assert.equal(code, 1);
  assert.match(errors.join('\n'), /ARANGO_PASSWORD/);
});

test('main treats a missing database as already empty', async () => {
  const logs = [];
  const code = await main([], {
    env: { ARANGO_PASSWORD: 'secret' },
    fetch: async () => new Response('{"error":true,"errorMessage":"database not found"}', { status: 404 }),
    log: (...args) => logs.push(args.join(' ')),
  });
  assert.equal(code, 0);
  assert.match(logs.join('\n'), /does not exist/);
});

test('main truncates only document collections', async () => {
  /** @type {string[]} */
  const urls = [];
  const logs = [];
  const code = await main(['--url', 'http://127.0.0.1:8529'], {
    env: { ARANGO_PASSWORD: 'secret' },
    log: (...args) => logs.push(args.join(' ')),
    fetch: async (url, init) => {
      urls.push(`${init?.method ?? 'GET'} ${url}`);
      if (String(url).includes('/_api/collection?')) {
        return new Response(
          JSON.stringify({
            result: [
              { name: '_users', isSystem: true },
              { name: 'photos', isSystem: false },
              { name: 'index_runs', isSystem: false },
            ],
          }),
          { status: 200 },
        );
      }
      if (String(url).includes('/truncate')) {
        return new Response('{"error":false}', { status: 200 });
      }
      return new Response('unexpected', { status: 500 });
    },
  });
  assert.equal(code, 0);
  assert.deepEqual(urls, [
    'GET http://127.0.0.1:8529/_db/memries/_api/collection?excludeSystem=true',
    'PUT http://127.0.0.1:8529/_db/memries/_api/collection/index_runs/truncate',
    'PUT http://127.0.0.1:8529/_db/memries/_api/collection/photos/truncate',
  ]);
  assert.equal(logs.join('\n'), 'cleared memries: index_runs, photos');
});

test('main explains a down stack', async () => {
  const errors = [];
  const code = await main([], {
    env: { ARANGO_PASSWORD: 'secret' },
    error: (...args) => errors.push(args.join(' ')),
    fetch: async () => {
      throw new Error('fetch failed');
    },
  });
  assert.equal(code, 1);
  assert.match(errors.join('\n'), /make up/);
});

test('process env password beats .env', async () => {
  /** @type {string[]} */
  const auths = [];
  const code = await main([], {
    env: { ARANGO_PASSWORD: 'from-process' },
    cwd: '/tmp',
    readFile: async () => 'ARANGO_PASSWORD=from-file\n',
    fetch: async (url, init) => {
      auths.push(init?.headers?.Authorization ?? '');
      if (String(url).includes('/_api/collection?')) {
        return new Response(JSON.stringify({ result: [] }), { status: 200 });
      }
      return new Response('unexpected', { status: 500 });
    },
    log: () => {},
  });
  assert.equal(code, 0);
  assert.equal(auths[0], `Basic ${Buffer.from('root:from-process').toString('base64')}`);
});
