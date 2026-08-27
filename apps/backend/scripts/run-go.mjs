import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function runGo(
  args,
  {
    env = process.env,
    spawn = spawnSync,
    cwd = packageRoot,
    stdout = process.stdout,
    stderr = process.stderr,
  } = {},
) {
  const result = spawn('go', args, {
    cwd,
    env,
    encoding: 'utf8',
    stdio: ['inherit', 'pipe', 'pipe'],
  });
  if (result.stdout) stdout.write(result.stdout);
  if (result.stderr) stderr.write(result.stderr);
  if (result.error) {
    stderr.write(`go is not available (${result.error.message}).\n`);
    stderr.write('Install the host toolchain from apps/scripts/install-requirements/, then open a new terminal.\n');
  }
  return result.status ?? 1;
}

export function goEnv(extra = {}, { platform = process.platform, home = homedir(), base = process.env } = {}) {
  const env = { ...base, CGO_ENABLED: '0', ...extra };
  if (platform === 'win32' && !env.LOCALAPPDATA) {
    env.LOCALAPPDATA = join(env.USERPROFILE || home, 'AppData', 'Local');
  }
  return env;
}
