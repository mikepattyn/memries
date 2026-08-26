import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  SlotHeldError,
  claimSlot,
  isolationForSlot,
  listActiveSlots,
  releaseProjectLease,
  releaseSlot,
  slotForPorts,
  stopFanoutProject,
} from './e2e-slots.mjs';

const temps = [];

function leaseRoot() {
  const dir = mkdtempSync(join(tmpdir(), 'memries-e2e-slots-'));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  while (temps.length) {
    rmSync(temps.pop(), { recursive: true, force: true });
  }
});

describe('isolationForSlot', () => {
  it('maps the four fan-out slots onto the 19000 band', () => {
    assert.deepEqual(isolationForSlot(0), {
      slot: 0,
      ports: { caddy: 19000, backend: 19001, frontend: 19002, arango: 19003, dex: 19004 },
      origin: 'http://localhost:19000',
    });
    assert.equal(isolationForSlot(1).ports.caddy, 19020);
    assert.equal(isolationForSlot(2).ports.caddy, 19040);
    assert.equal(isolationForSlot(3).ports.caddy, 19060);
    assert.equal(isolationForSlot(4), null);
    assert.equal(isolationForSlot(-1), null);
  });
});

describe('slotForPorts', () => {
  it('matches a complete slot set and rejects custom ports', () => {
    assert.equal(slotForPorts(isolationForSlot(3).ports), 3);
    assert.equal(slotForPorts({ caddy: 18080, backend: 18081, frontend: 15173, arango: 18529, dex: 15556 }), null);
    assert.equal(slotForPorts({ caddy: 19080, backend: 19081, frontend: 19082, arango: 19083, dex: 19084 }), null);
    assert.equal(slotForPorts({ caddy: 19000, backend: 19001, frontend: 19002, arango: 19003, dex: 19999 }), null);
  });
});

describe('claimSlot / releaseSlot', () => {
  it('gives exclusive ownership of one slot to a compose project', () => {
    const root = leaseRoot();
    const claimed = claimSlot({
      slot: 0,
      project: 'e2e-memries-albums',
      leaseRoot: root,
    });
    assert.equal(claimed.project, 'e2e-memries-albums');
    assert.equal(claimed.ports.caddy, 19000);
    assert.throws(
      () =>
        claimSlot({
          slot: 0,
          project: 'e2e-memries-navigation',
          leaseRoot: root,
          projectAlive: () => true,
          portsFree: () => false,
        }),
      (err) => {
        assert.ok(err instanceof SlotHeldError);
        assert.equal(err.project, 'e2e-memries-albums');
        assert.match(err.message, /19000–19004/);
        assert.match(err.message, /e2e-memries-albums/);
        return true;
      },
    );
  });

  it('lets the owner reclaim its own leftover lease', () => {
    const root = leaseRoot();
    claimSlot({ slot: 3, project: 'e2e-memries-navigation', leaseRoot: root });
    const again = claimSlot({
      slot: 3,
      project: 'e2e-memries-navigation',
      leaseRoot: root,
      projectAlive: () => false,
      portsFree: () => true,
    });
    assert.equal(again.project, 'e2e-memries-navigation');
    assert.equal(again.reclaimed, true);
  });

  it('releases only when the caller is the owner', () => {
    const root = leaseRoot();
    claimSlot({ slot: 1, project: 'e2e-memries-indexing', leaseRoot: root });
    assert.equal(
      releaseSlot({ slot: 1, project: 'e2e-memries-viewer', leaseRoot: root }),
      false,
    );
    assert.throws(
      () =>
        claimSlot({
          slot: 1,
          project: 'e2e-memries-viewer',
          leaseRoot: root,
          projectAlive: () => true,
          portsFree: () => false,
        }),
      SlotHeldError,
    );
    assert.equal(releaseSlot({ slot: 1, project: 'e2e-memries-indexing', leaseRoot: root }), true);
    const next = claimSlot({ slot: 1, project: 'e2e-memries-viewer', leaseRoot: root });
    assert.equal(next.project, 'e2e-memries-viewer');
  });

  it('reclaims a stale lease when the docker project is gone and ports are free', () => {
    const root = leaseRoot();
    claimSlot({ slot: 3, project: 'e2e-memries-navigation', leaseRoot: root });
    const claimed = claimSlot({
      slot: 3,
      project: 'e2e-memries-viewer',
      leaseRoot: root,
      projectAlive: () => false,
      portsFree: () => true,
    });
    assert.equal(claimed.project, 'e2e-memries-viewer');
    assert.equal(claimed.reclaimed, true);
  });

  it('does not reclaim a stale lease while ports are still bound', () => {
    const root = leaseRoot();
    claimSlot({ slot: 3, project: 'e2e-memries-navigation', leaseRoot: root });
    assert.throws(
      () =>
        claimSlot({
          slot: 3,
          project: 'e2e-memries-viewer',
          leaseRoot: root,
          projectAlive: () => false,
          portsFree: () => false,
        }),
      (err) => {
        assert.ok(err instanceof SlotHeldError);
        assert.equal(err.project, 'e2e-memries-navigation');
        return true;
      },
    );
  });

  it('rejects a fifth or custom slot', () => {
    const root = leaseRoot();
    assert.throws(
      () => claimSlot({ slot: 4, project: 'e2e-memries-extra', leaseRoot: root }),
      /four slot port sets/,
    );
  });
});

describe('listActiveSlots', () => {
  it('reports holders that are still alive or still binding ports', () => {
    const root = leaseRoot();
    claimSlot({ slot: 0, project: 'e2e-memries-albums', leaseRoot: root });
    claimSlot({ slot: 3, project: 'e2e-memries-navigation', leaseRoot: root });
    const active = listActiveSlots({
      leaseRoot: root,
      projectAlive: (project) => project === 'e2e-memries-navigation',
      portsFree: (ports) => ports.caddy !== 19060,
    });
    assert.deepEqual(
      active.map((row) => row.project),
      ['e2e-memries-navigation'],
    );
    assert.equal(active[0].slot, 3);
  });
});

describe('stopFanoutProject', () => {
  it('releases the lease only after compose down succeeds', () => {
    const root = leaseRoot();
    claimSlot({ slot: 2, project: 'e2e-memries-motion', leaseRoot: root });
    const result = stopFanoutProject('e2e-memries-motion', {
      composeDown: () => {},
      leaseRoot: root,
    });
    assert.equal(result.ok, true);
    assert.equal(result.released, true);
    const next = claimSlot({ slot: 2, project: 'e2e-memries-search', leaseRoot: root });
    assert.equal(next.project, 'e2e-memries-search');
  });

  it('keeps the lease when compose down fails', () => {
    const root = leaseRoot();
    claimSlot({ slot: 2, project: 'e2e-memries-motion', leaseRoot: root });
    const result = stopFanoutProject('e2e-memries-motion', {
      composeDown: () => {
        throw new Error('docker failed');
      },
      leaseRoot: root,
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, 'docker failed');
    assert.equal(result.released, false);
    assert.equal(releaseProjectLease('e2e-memries-search', { leaseRoot: root }), false);
    assert.throws(
      () =>
        claimSlot({
          slot: 2,
          project: 'e2e-memries-search',
          leaseRoot: root,
          projectAlive: () => true,
          portsFree: () => false,
        }),
      SlotHeldError,
    );
  });
});
