import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Run against disposable local data only. Never point this at a remote environment.
const base = 'http://localhost:5173';
const bootstrap = await fs.readFile('.generated/ui-test-admin.txt', 'utf8');
const token = bootstrap.match(/token=([^\s]+)/)?.[1];
assert.ok(token, 'Create the local fixture admin first');
const password = `Local-${crypto.randomBytes(18).toString('base64url')}!`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('dialog', dialog => dialog.accept());
const created = { user: null, news: null, scholarship: null, application: null };
async function api(path, method = 'GET', data) {
  const response = await context.request.fetch(`${base}/api${path}`, { method, ...(data === undefined ? {} : { data }) });
  const result = await response.json();
  assert.ok(response.ok(), `${method} ${path}: ${response.status()} ${JSON.stringify(result.error)}`);
  return result.data;
}
try {
  await page.goto(`${base}/atur-password?purpose=invitation&token=${token}`);
  await page.getByLabel('Password baru').fill(password);
  await page.getByRole('button', { name: 'Simpan password' }).click();
  await page.waitForURL('**/admin');
  await page.getByText('UI Test Admin', { exact: false }).first().waitFor();
  const timestamp = Date.now();
  const member = await api('/admin/users', 'POST', { fullName: 'Anggota Uji', email: `restoration-${timestamp}@example.test`, username: `restore_${timestamp}`, role: 'user', position: 'Guru', phone: '0800000000' });
  created.user = member.id;
  assert.equal(member.status, 'invited');
  const changed = await api(`/admin/users/${member.id}`, 'PATCH', { fullName: 'Nama Diperbarui', address: 'Situbondo', phone: '0811111111' });
  assert.equal(changed.fullName, 'Nama Diperbarui');
  assert.equal(changed.address, 'Situbondo');
  const invitation = await context.request.post(`${base}/api/admin/users/${member.id}/invite`, { data: {} });
  assert.equal(invitation.status(), 503, 'Local fixture must have no email delivery configured');
  const news = await api('/admin/news', 'POST', { title: `Berita Uji ${timestamp}`, content: '<p>Berita lokal</p>', published: true });
  created.news = news.id;
  await page.goto(`${base}/berita/${news.id}`);
  await page.getByRole('heading', { name: news.title, exact: true }).first().waitFor();
  const scholarship = await api('/admin/scholarships', 'POST', { title: 'Beasiswa Lokal', amount: 1000000, status: 'open', deadline: '2027-01-01', requirements: ['Guru aktif'] });
  created.scholarship = scholarship.id;
  await page.goto(`${base}/beasiswa/${scholarship.id}`);
  await page.getByRole('heading', { name: scholarship.title, exact: true }).first().waitFor();
  const application = await api('/membership-applications', 'POST', { fullName: 'Pendaftaran Uji', email: `application-${timestamp}@example.test`, phone: '0800000000' });
  created.application = application.id;
  const status = await api('/application-status', 'POST', { reference: application.reference, email: `application-${timestamp}@example.test` });
  assert.equal(status.status, 'pending');
  assert.equal((await context.request.post(`${base}/api/application-status`, { data: { reference: application.reference, email: 'wrong@example.test' } })).status(), 404);
  const rejected = await api(`/admin/applications/membership/${application.id}`, 'PATCH', { status: 'rejected', rejectionReason: 'Pengujian lokal' });
  assert.equal(rejected.emailSent, false);
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF');
  const uploaded = await context.request.post(`${base}/api/admin/users/${member.id}/certificates`, { multipart: { certificate: { name: 'test.pdf', mimeType: 'application/pdf', buffer: pdf }, title: 'Sertifikat Uji' } });
  assert.ok(uploaded.ok());
  const cert = (await uploaded.json()).data;
  assert.equal((await context.request.get(`${base}/api/account/certificates/${cert.id}/download`)).status(), 404, 'Another user cannot download this certificate');
  await api(`/admin/certificates/${cert.id}`, 'DELETE');
  await page.goto(`${base}/admin`);
  await page.waitForTimeout(500);
  assert.deepEqual(errors, [], errors.join('\n'));
  for (const [key, path] of [['application', '/admin/applications/membership'], ['scholarship', '/admin/scholarships'], ['news', '/admin/news'], ['user', '/admin/users']]) {
    await api(`${path}/${created[key]}`, 'DELETE'); created[key] = null;
  }
  await api('/auth/logout', 'POST', {});
  await page.goto(`${base}/admin`);
  await page.waitForURL('**/login');
  await page.locator('#login-username').fill('ui-restoration-local@example.test');
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL('**/admin');
  console.log('PASS: invitation setup, login, protected routes, profile CRUD, news, scholarships, application status privacy, rejection feedback, certificate upload/access isolation/delete.');
} finally {
  // On failure leave only clearly named local fixtures for diagnosis; nothing is sent remotely.
  await browser.close();
}
