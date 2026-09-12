import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const directory = '.generated/ui-check';
await fs.mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const user = { id: 'test-user', userId: 'test-user', fullName: 'Pengguna Uji', username: 'penguji', email: 'ui@example.test', role: 'admin', status: 'active', position: 'Guru', address: 'Situbondo', phone: '0800000000', certificates: [] };
const news = { id: 'test-news', title: 'Berita Pengujian', content: '<p>Isi berita untuk pengujian tampilan.</p>', category: 'Pendidikan', author: 'PERGUNU', featured: true, publishedAt: '2026-01-01T00:00:00Z', publishDate: '2026-01-01T00:00:00Z', imageUrl: '', image: '' };
const scholarship = { id: 'test-scholarship', title: 'Beasiswa Pengujian', amount: 1000000, startsAt: '2026-01-01', deadline: '2027-01-01', status: 'open', requirements: ['Guru aktif'], description: 'Informasi beasiswa', category: 'Pendidikan', judul: 'Beasiswa Pengujian', nominal: 1000000, tanggal_mulai: '2026-01-01', persyaratan: ['Guru aktif'], deskripsi: 'Informasi beasiswa', kategori: 'Pendidikan' };
const report = [];
try {
  for (const width of [1440, 390]) {
    for (const route of ['/', '/login', '/daftar', '/tentang', '/anggota', '/sponsor', '/layanan', '/beasiswa', '/berita/test-news', '/beasiswa/test-scholarship', '/admin', '/user-dashboard']) {
      const pair = [];
      for (const original of [true, false]) {
        const roleUser = { ...user, role: route === '/user-dashboard' ? 'user' : 'admin' };
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        await context.addInitScript(u => {
          localStorage.setItem(u.role === 'admin' ? 'adminAuth' : 'userAuth', JSON.stringify(u));
        }, roleUser);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', async request => {
          const url = new URL(request.request().url());
          if (!['fetch', 'xhr'].includes(request.request().resourceType())) return request.continue();
          const path = url.pathname;
          let data;
          if (path === '/api/auth/me') data = { user: roleUser };
          else if (path.endsWith('/health')) data = { status: 'healthy' };
          else if (path.includes('certificates')) data = [];
          else if (path.includes('applications')) data = original ? [] : { items: [], type: 'membership' };
          else if (path.includes('users')) data = path.endsWith('test-user') ? roleUser : [roleUser];
          else if (path.includes('news')) data = path.endsWith('test-news') ? news : [news];
          else if (path.includes('scholarships') || path.includes('beasiswa')) data = path.endsWith('test-scholarship') ? scholarship : [scholarship];
          else data = {};
          await request.fulfill({ json: original ? data : { data, error: null } });
        });
        await page.goto(`http://127.0.0.1:${original ? 5174 : 5173}${route}`);
        await page.waitForTimeout(700);
        assert.deepEqual(errors, [], `${original ? 'Original' : 'Restored'} ${route} at ${width}: ${errors.join(', ')}`);
        assert.ok((await page.locator('#root').innerText()).length > 30, `Empty route ${route}`);
        const file = `${directory}/${original ? 'original' : 'restored'}-${width}-${route.replaceAll('/', '_') || 'home'}.png`;
        await page.screenshot({ path: file, fullPage: true });
        const style = await page.locator('body').evaluate(element => ({ font: getComputedStyle(element).fontFamily, background: getComputedStyle(element).backgroundColor }));
        pair.push(style);
        await context.close();
      }
      assert.deepEqual(pair[0], pair[1], `Global style changed: ${route}`);
      report.push({ route, width, result: 'rendered without runtime errors; body font/background match original' });
    }
  }
  await fs.writeFile(`${directory}/report.json`, JSON.stringify(report, null, 2));
  console.log(`PASS: ${report.length} desktop/mobile route comparisons. Screenshots: ${directory}`);
} finally { await browser.close(); }
