import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { claimSlot, listActiveSlots } from './e2e-slots.mjs';
import {
  beginFanoutUp,
  composeArgs,
  failFanoutUp,
  finishFanoutDown,
  renderDexConfig,
  requireFanoutSlot,
  resolveStackConfig,
  up,
} from './stack.mjs';

const temps = [];

function leaseRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'memries-stack-slots-'));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  while (temps.length) {
    rmSync(temps.pop(), { recursive: true, force: true });
  }
});

const FANOUT_ENV = {
  MEMRIES_E2E_PROJECT: 'e2e-memries-viewer',
  CADDY_HOST_PORT: '19060',
  BACKEND_HOST_PORT: '19061',
  FRONTEND_HOST_PORT: '19062',
  ARANGO_HOST_PORT: '19063',
  DEX_HOST_PORT: '19064',
};

const DEX_TEMPLATE = `issuer: http://localhost:15556

staticClients:
  - id: memries
    redirectURIs:
      - http://localhost:18080/oauth/callback
`;

describe('resolveStackConfig', () => {
  it('uses the single-instance defaults so make e2e keeps 18080', () => {
    const config = resolveStackConfig({});
    assert.equal(config.project, 'memries-e2e');
    assert.deepEqual(config.ports, {
      caddy: 18080,
      backend: 18081,
      frontend: 15173,
      arango: 18529,
      dex: 15556,
    });
    assert.equal(config.origin, 'http://localhost:18080');
    assert.equal(config.healthz, 'http://localhost:18081/healthz');
    assert.equal(config.oidcIssuer, 'http://localhost:15556');
    assert.equal(config.oidcRedirectUrl, 'http://localhost:18080/oauth/callback');
    assert.equal(config.publicUrl, 'http://localhost:18080');
    assert.equal(config.viteApiBase, 'http://localhost:18080');
  });

  it('reads project and host ports from the environment', () => {
    const config = resolveStackConfig({
      MEMRIES_E2E_PROJECT: 'e2e-memries-timeline',
      CADDY_HOST_PORT: '19000',
      BACKEND_HOST_PORT: '19001',
      FRONTEND_HOST_PORT: '19002',
      ARANGO_HOST_PORT: '19003',
      DEX_HOST_PORT: '19004',
    });
    assert.equal(config.project, 'e2e-memries-timeline');
    assert.deepEqual(config.ports, {
      caddy: 19000,
      backend: 19001,
      frontend: 19002,
      arango: 19003,
      dex: 19004,
    });
    assert.equal(config.origin, 'http://localhost:19000');
    assert.equal(config.healthz, 'http://localhost:19001/healthz');
    assert.equal(config.oidcIssuer, 'http://localhost:19004');
    assert.equal(config.oidcRedirectUrl, 'http://localhost:19000/oauth/callback');
    assert.deepEqual(config.composeEnv, {
      CADDY_HOST_PORT: '19000',
      BACKEND_HOST_PORT: '19001',
      FRONTEND_HOST_PORT: '19002',
      ARANGO_HOST_PORT: '19003',
      DEX_HOST_PORT: '19004',
      MEMRIES_E2E_ORIGIN: 'http://localhost:19000',
    });
  });

  it('honors an explicit origin override', () => {
    const config = resolveStackConfig({
      CADDY_HOST_PORT: '19000',
      MEMRIES_E2E_ORIGIN: 'http://127.0.0.1:19000',
    });
    assert.equal(config.origin, 'http://127.0.0.1:19000');
    assert.equal(config.oidcRedirectUrl, 'http://127.0.0.1:19000/oauth/callback');
  });
});

describe('composeArgs', () => {
  it('pins the compose project and files', () => {
    const config = resolveStackConfig({ MEMRIES_E2E_PROJECT: 'e2e-memries-albums' });
    assert.deepEqual(composeArgs(config, '/e2e/docker-compose.yml', '/app/.env', ['up', '-d']), [
      'compose',
      '-p',
      'e2e-memries-albums',
      '-f',
      '/e2e/docker-compose.yml',
      '--env-file',
      '/app/.env',
      'up',
      '-d',
    ]);
  });
});

describe('renderDexConfig', () => {
  it('rewrites issuer and redirect to the instance ports', () => {
    const config = resolveStackConfig({
      CADDY_HOST_PORT: '19000',
      DEX_HOST_PORT: '19004',
    });
    const rendered = renderDexConfig(DEX_TEMPLATE, config);
    assert.match(rendered, /issuer: http:\/\/localhost:19004/);
    assert.match(rendered, /http:\/\/localhost:19000\/oauth\/callback/);
    assert.doesNotMatch(rendered, /localhost:15556/);
    assert.doesNotMatch(rendered, /localhost:18080/);
  });
});

describe('requireFanoutSlot', () => {
  it('leaves the default 18080 stack unleased', () => {
    assert.equal(requireFanoutSlot(resolveStackConfig({})), null);
  });

  it('accepts a valid fan-out slot and rejects a fifth set', () => {
    assert.equal(requireFanoutSlot(resolveStackConfig(FANOUT_ENV)), 3);
    assert.throws(
      () =>
        requireFanoutSlot(
          resolveStackConfig({
            MEMRIES_E2E_PROJECT: 'e2e-memries-extra',
            CADDY_HOST_PORT: '19080',
            BACKEND_HOST_PORT: '19081',
            FRONTEND_HOST_PORT: '19082',
            ARANGO_HOST_PORT: '19083',
            DEX_HOST_PORT: '19084',
          }),
        ),
      /four slot port sets/,
    );
  });
});

describe('fan-out lease lifecycle', () => {
  it('claims before up and releases after a failed start', () => {
    const root = leaseRoot();
    const config = resolveStackConfig(FANOUT_ENV);
    const deps = { leaseRoot: root, projectAlive: () => false, portsFree: () => true };
    assert.equal(beginFanoutUp(config, deps), 3);
    let wiped = false;
    failFanoutUp(config, {
      ...deps,
      composeDown: () => {
        wiped = true;
      },
    });
    assert.equal(wiped, true);
    assert.deepEqual(
      listActiveSlots({ leaseRoot: root, projectAlive: () => true, portsFree: () => false }),
      [],
    );
    assert.equal(
      beginFanoutUp(
        resolveStackConfig({
          ...FANOUT_ENV,
          MEMRIES_E2E_PROJECT: 'e2e-memries-search',
        }),
        deps,
      ),
      3,
    );
  });

  it('releases only after a wipe down', () => {
    const root = leaseRoot();
    const config = resolveStackConfig(FANOUT_ENV);
    const deps = { leaseRoot: root, projectAlive: () => false, portsFree: () => true };
    beginFanoutUp(config, deps);
    finishFanoutDown(config, { ...deps, wipe: false });
    assert.equal(
      listActiveSlots({ leaseRoot: root, projectAlive: () => true, portsFree: () => false }).length,
      1,
    );
    finishFanoutDown(config, { ...deps, wipe: true });
    assert.equal(
      listActiveSlots({ leaseRoot: root, projectAlive: () => true, portsFree: () => false }).length,
      0,
    );
  });

  it('fails immediately when another project holds the slot', () => {
    const root = leaseRoot();
    claimSlot({
      slot: 3,
      project: 'e2e-memries-navigation',
      leaseRoot: root,
    });
    assert.throws(
      () =>
        beginFanoutUp(resolveStackConfig(FANOUT_ENV), {
          leaseRoot: root,
          projectAlive: () => true,
          portsFree: () => false,
        }),
      /held by e2e-memries-navigation/,
    );
  });
});

describe('up', () => {
  it('cleans a partial fan-out stack and lease when compose fails', async () => {
    const root = leaseRoot();
    const commands = [];
    await assert.rejects(
      () =>
        up({
          env: FANOUT_ENV,
          allowMissingEnv: true,
          skipFixtures: true,
          skipLogs: true,
          leaseRoot: root,
          projectAlive: () => false,
          portsFree: () => true,
          runDocker: async (_cmd, args) => {
            commands.push(
              args.at(-2) === 'up' || args.includes('up')
                ? 'up'
                : args.includes('down')
                  ? 'down'
                  : args.join(' '),
            );
            if (args.includes('up')) throw new Error('compose failed');
          },
        }),
      /compose failed/,
    );
    assert.deepEqual(commands, ['up', 'down']);
    assert.deepEqual(
      listActiveSlots({ leaseRoot: root, projectAlive: () => true, portsFree: () => false }),
      [],
    );
  });
});
