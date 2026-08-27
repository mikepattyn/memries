import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { goEnv, runGo } from './run-go.mjs';

describe('runGo', () => {
  it('writes a toolchain hint when go is not on PATH', () => {
    const writes = [];
    const status = runGo(['version'], {
      spawn: () => ({
        status: null,
        error: Object.assign(new Error('spawnSync go ENOENT'), { code: 'ENOENT' }),
      }),
      stdout: { write: () => {} },
      stderr: { write: (chunk) => writes.push(String(chunk)) },
    });
    assert.equal(status, 1);
    assert.match(writes.join(''), /go is not available \(spawnSync go ENOENT\)/);
    assert.match(writes.join(''), /apps\/scripts\/install-requirements/);
  });
});

describe('goEnv', () => {
  it('fills LOCALAPPDATA on Windows when Turbo stripped it', () => {
    const env = goEnv(
      {},
      { platform: 'win32', home: 'C:\\Users\\dev', base: { USERPROFILE: 'C:\\Users\\dev' } },
    );
    assert.equal(env.CGO_ENABLED, '0');
    assert.equal(env.LOCALAPPDATA, 'C:\\Users\\dev\\AppData\\Local');
  });
});
