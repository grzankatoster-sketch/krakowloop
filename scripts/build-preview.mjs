// Web build for the private preview (deploy/preview): the same app, but without the local wish
// proxy address from .env, which a phone on the internet could never reach. Wishes are then read
// with keywords until a cloud proxy exists (set PREVIEW_WISH_PROXY_URL to use one).
import { spawnSync } from 'node:child_process';

const env = { ...process.env, EXPO_PUBLIC_WISH_PROXY_URL: process.env.PREVIEW_WISH_PROXY_URL ?? '' };
const r = spawnSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-preview', '--clear'], {
  env,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(r.status ?? 1);
