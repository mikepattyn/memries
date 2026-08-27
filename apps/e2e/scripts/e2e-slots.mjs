/**
 * Machine-wide exclusive leases for the four e2e-docker fan-out port sets.
 * Helpers only — not a CLI.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const FANOUT_SLOT_COUNT = 4;
export const FANOUT_PORT_BASE = 19000;
export const FANOUT_PORT_STRIDE = 20;
export const DEFAULT_STACK_PROJECT = 'memries-e2e';

export class SlotHeldError extends Error {
  constructor(slot, project, ports) {
    const first = ports.caddy;
    const last = ports.dex;
    super(`Ports ${first}–${last} are held by ${project}`);
    this.name = 'SlotHeldError';
    this.code = 'SLOT_HELD';
    this.slot = slot;
    this.project = project;
    this.ports = ports;
  }
}

export function defaultLeaseRoot() {
  return join(tmpdir(), 'memries-e2e-slots');
}

export function isolationForSlot(index) {
  const n = Number(index);
  if (!Number.isInteger(n) || n < 0 || n >= FANOUT_SLOT_COUNT) return null;
  const caddy = FANOUT_PORT_BASE + n * FANOUT_PORT_STRIDE;
  return {
    slot: n,
    ports: {
      caddy,
      backend: caddy + 1,
      frontend: caddy + 2,
      arango: caddy + 3,
      dex: caddy + 4,
    },
    origin: `http://localhost:${caddy}`,
  };
}

export function slotForPorts(ports) {
  if (!ports) return null;
  for (let i = 0; i < FANOUT_SLOT_COUNT; i += 1) {
    const iso = isolationForSlot(i);
    if (
      Number(ports.caddy) === iso.ports.caddy &&
      Number(ports.backend) === iso.ports.backend &&
      Number(ports.frontend) === iso.ports.frontend &&
      Number(ports.arango) === iso.ports.arango &&
      Number(ports.dex) === iso.ports.dex
    ) {
      return i;
    }
  }
  return null;
}

export function isFanoutProject(project) {
  return String(project || '').startsWith('e2e-');
}

function slotDir(leaseRoot, slot) {
  return join(leaseRoot, `slot-${slot}`);
}

function ownerPath(leaseRoot, slot) {
  return join(slotDir(leaseRoot, slot), 'owner.json');
}

function readOwner(leaseRoot, slot) {
  const path = ownerPath(leaseRoot, slot);
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    if (!parsed || typeof parsed.project !== 'string' || !parsed.project) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeOwner(leaseRoot, slot, project) {
  writeFileSync(
    ownerPath(leaseRoot, slot),
    `${JSON.stringify({ project, slot, claimedAt: new Date().toISOString() })}\n`,
    'utf8',
  );
}

function removeLease(leaseRoot, slot) {
  rmSync(slotDir(leaseRoot, slot), { recursive: true, force: true });
}

function canReclaim(owner, project, iso, projectAlive, portsFree) {
  if (!owner) return true;
  if (owner.project === project) return true;
  return !projectAlive(owner.project) && portsFree(iso.ports);
}

export function claimSlot({
  slot,
  project,
  leaseRoot = defaultLeaseRoot(),
  projectAlive = dockerProjectAlive,
  portsFree = hostPortsFree,
} = {}) {
  const iso = isolationForSlot(slot);
  if (!iso) {
    throw new Error('fan-out stack must use one of the four slot port sets');
  }
  if (!project) throw new Error('claimSlot requires a compose project');
  mkdirSync(leaseRoot, { recursive: true });
  const dir = slotDir(leaseRoot, slot);
  try {
    mkdirSync(dir);
    writeOwner(leaseRoot, slot, project);
    return { ...iso, project };
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
  const owner = readOwner(leaseRoot, slot);
  if (!canReclaim(owner, project, iso, projectAlive, portsFree)) {
    throw new SlotHeldError(iso.slot, owner?.project || 'unknown', iso.ports);
  }
  removeLease(leaseRoot, slot);
  mkdirSync(dir);
  writeOwner(leaseRoot, slot, project);
  return { ...iso, project, reclaimed: true };
}

export function releaseSlot({ slot, project, leaseRoot = defaultLeaseRoot() } = {}) {
  const owner = readOwner(leaseRoot, slot);
  if (!owner || owner.project !== project) return false;
  removeLease(leaseRoot, slot);
  return true;
}

export function releaseProjectLease(project, { leaseRoot = defaultLeaseRoot() } = {}) {
  let released = false;
  for (let slot = 0; slot < FANOUT_SLOT_COUNT; slot += 1) {
    if (releaseSlot({ slot, project, leaseRoot })) released = true;
  }
  return released;
}

export function listActiveSlots({
  leaseRoot = defaultLeaseRoot(),
  projectAlive = dockerProjectAlive,
  portsFree = hostPortsFree,
} = {}) {
  const active = [];
  for (let slot = 0; slot < FANOUT_SLOT_COUNT; slot += 1) {
    const owner = readOwner(leaseRoot, slot);
    if (!owner) continue;
    const iso = isolationForSlot(slot);
    if (!projectAlive(owner.project) && portsFree(iso.ports)) continue;
    active.push({ slot, project: owner.project, ports: iso.ports, origin: iso.origin });
  }
  return active;
}

export function applyBusySlotGate(plan, busySlots) {
  const holders = Array.isArray(busySlots) ? busySlots.filter((row) => row?.project) : [];
  if (!holders.length) return plan;
  const names = [...new Set(holders.map((row) => row.project))];
  return {
    ...plan,
    launchNow: [],
    deferred: Array.isArray(plan.needsRun) ? [...plan.needsRun] : plan.deferred,
    hint: `band held by ${names.join(', ')}; close that slice first`,
    busySlots: holders,
  };
}

export function stopFanoutProject(project, { composeDown, leaseRoot = defaultLeaseRoot() } = {}) {
  const result = { project, ok: true, error: null, released: false };
  try {
    if (typeof composeDown === 'function') composeDown(project);
    result.released = releaseProjectLease(project, { leaseRoot });
  } catch (err) {
    result.ok = false;
    result.error = err instanceof Error ? err.message : String(err);
  }
  return result;
}

export function dockerProjectAlive(project) {
  try {
    const out = execFileSync(
      'docker',
      ['ps', '-q', '--filter', `label=com.docker.compose.project=${project}`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 8_000 },
    );
    return Boolean(String(out || '').trim());
  } catch {
    return true;
  }
}

export function hostPortsFree(ports) {
  const values = Object.values(ports || {})
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
  for (const port of values) {
    if (!tryListen(port)) return false;
  }
  return true;
}

function tryListen(port) {
  try {
    execFileSync(
      process.execPath,
      [
        '-e',
        `const {createServer}=require('node:net');const s=createServer();s.on('error',()=>process.exit(2));s.listen(${Number(port)},'127.0.0.1',()=>s.close(()=>process.exit(0)));`,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 3_000 },
    );
    return true;
  } catch {
    return false;
  }
}
