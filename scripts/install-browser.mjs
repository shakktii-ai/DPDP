import { execSync } from 'child_process';

// Do not run inside Vercel serverless build
if (process.env.VERCEL === '1') {
  console.log('[install-browser] Detected Vercel deployment. Skipping Playwright browser installation.');
  process.exit(0);
}

console.log('[install-browser] Installing Playwright Chromium browser binary for worker deployment...');
try {
  // First try installing with Linux system dependencies (requires sudo/root on Debian/Ubuntu)
  console.log('[install-browser] Attempting: npx playwright install --with-deps chromium');
  execSync('npx playwright install --with-deps chromium', { stdio: 'inherit' });
  console.log('[install-browser] Playwright Chromium and system dependencies installed successfully.');
} catch (depErr) {
  console.warn('[install-browser] Warning: "--with-deps" failed or not supported in this environment. Falling back to browser-only download...');
  try {
    console.log('[install-browser] Attempting: npx playwright install chromium');
    execSync('npx playwright install chromium', { stdio: 'inherit' });
    console.log('[install-browser] Playwright Chromium binary installed successfully.');
  } catch (err) {
    console.error('[install-browser] Fatal: Failed to install Playwright Chromium:', err.message);
    process.exit(1);
  }
}
