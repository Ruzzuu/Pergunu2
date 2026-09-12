import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const base = process.env.PREVIEW_URL || 'https://pergunu-situbondo-preview.fairuz-fuadi04.workers.dev';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const response = await fetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'healthy');
  for (const route of ['/', '/login', '/daftar', '/tentang', '/anggota', '/layanan', '/beasiswa']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const navigation = await page.goto(`${base}${route}`, { waitUntil: 'networkidle' });
    assert.equal(navigation.status(), 200, route);
    assert.ok((await page.locator('#root').innerText()).length > 30, `Empty page: ${route}`);
    assert.deepEqual(errors, [], `${route}: ${errors.join('; ')}`);
    await page.close();
  }
  const protectedPage = await browser.newPage();
  await protectedPage.goto(`${base}/admin`);
  await protectedPage.waitForURL('**/login');
  console.log(`PASS: live API, seven public routes, assets, and protected admin redirect at ${base}`);
} finally { await browser.close(); }
