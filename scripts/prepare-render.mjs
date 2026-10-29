import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Existing Render services configured with only `bun install` must still
// produce the new app's artifacts. Normal local installs remain unchanged.
if (process.env.RENDER === 'true') {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    console.error('RIFAN Connect on Render requires Node.js 24. Set NODE_VERSION=24.');
    process.exit(1);
  }
  const app = fileURLToPath(new URL('../rifan-app/', import.meta.url));
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  for (const args of [
    ['--prefix', app, 'ci', '--include=dev', '--no-audit', '--no-fund'],
    ['--prefix', app, 'run', 'build'],
  ]) {
    const result = spawnSync(npm, args, { stdio: 'inherit', env: process.env });
    if (result.error) {
      console.error(`Render build could not run npm: ${result.error.message}`);
      process.exit(1);
    }
    if (result.status !== 0) process.exit(result.status || 1);
  }
}
