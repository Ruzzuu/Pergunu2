import { Hono } from 'hono';
import sanitizeHtml from 'sanitize-html';
import {
  consumeAuthToken, createSession, currentUser, destroySession, hashPassword, hashToken,
  issueAuthToken, requireAdmin, requireUser, verifyPassword
} from './security.js';
import {
  applicationReference, audit, emailLayout, escapeHtml, publicUser, sendEmail, slugify, verifyTurnstile
} from './services.js';
import { asInteger, cleanEmail, cleanText, normalizeStatus, parseJsonArray, validPassword } from './validation.js';

const app = new Hono();
const ok = (c, data, status = 200) => c.json({ data, error: null }, status);
const fail = (c, status, code, message, details) => c.json({ data: null, error: { code, message, ...(details ? { details } : {}) } }, status);
const now = () => new Date().toISOString();

app.onError((error, c) => {
  console.error('Unhandled request error', error);
  return fail(c, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan pada server.');
});

app.use('/api/*', async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const origin = c.req.header('Origin');
    const requestOrigin = new URL(c.req.url).origin;
    const configuredOrigin = c.env.APP_URL ? new URL(c.env.APP_URL).origin : requestOrigin;
    if (origin && origin !== requestOrigin && origin !== configuredOrigin) {
      return fail(c, 403, 'INVALID_ORIGIN', 'Permintaan berasal dari situs yang tidak diizinkan.');
    }
  }
  await next();
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
});

app.use('/api/admin/*', requireAdmin);
app.use('/api/account/*', requireUser);

async function bodyJson(c) {
  try { return await c.req.json(); } catch { return null; }
}

async function limited(c, bucket, maximum = 10, minutes = 15) {
  const identity = `${bucket}:${c.req.header('CF-Connecting-IP') || 'local'}`;
  const key = await hashToken(identity);
  const row = await c.env.DB.prepare('SELECT attempts, window_started_at FROM rate_limits WHERE key_hash = ?').bind(key).first();
  const current = Date.now();
  const windowMs = minutes * 60 * 1000;
  if (!row || current - new Date(row.window_started_at).getTime() >= windowMs) {
    await c.env.DB.prepare(`
      INSERT INTO rate_limits (key_hash, attempts, window_started_at) VALUES (?, 1, ?)
      ON CONFLICT(key_hash) DO UPDATE SET attempts = 1, window_started_at = excluded.window_started_at
    `).bind(key, now()).run();
    return true;
  }
  if (row.attempts >= maximum) return false;
  await c.env.DB.prepare('UPDATE rate_limits SET attempts = attempts + 1 WHERE key_hash = ?').bind(key).run();
  return true;
}

async function turnstileOk(c, token) {
  return verifyTurnstile(c.env, token, c.req.header('CF-Connecting-IP'));
}

function mapNews(row) {
  return {
    id: row.id, slug: row.slug, title: row.title, summary: row.summary, content: row.content_html,
    author: row.author, category: row.category, imageUrl: row.image_key ? `/media/images/${row.image_key}` : null,
    missingLegacyImage: Boolean(row.legacy_image && !row.image_key), featured: Boolean(row.featured),
    publishedAt: row.published_at, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function mapScholarship(row) {
  return {
    id: row.id, title: row.title, amount: row.amount, startsAt: row.starts_at, deadline: row.deadline,
    status: row.status, description: row.description, requirements: parseJsonArray(row.requirements_json),
    category: row.category, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

function mapMembership(row) {
  return {
    id: row.id, reference: row.reference, userId: row.user_id, fullName: row.full_name, email: row.email,
    phone: row.phone, position: row.position, school: row.school, regionalBranch: row.regional_branch,
    localBranch: row.local_branch, education: row.education, experience: row.experience, address: row.address,
    notes: row.notes, status: row.status, rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at, processedAt: row.processed_at
  };
}

function mapScholarshipApplication(row) {
  return {
    id: row.id, reference: row.reference, scholarshipId: row.scholarship_id, userId: row.user_id,
    fullName: row.full_name, email: row.email, phone: row.phone, address: row.address, reason: row.reason,
    documents: parseJsonArray(row.documents_json), status: row.status, rejectionReason: row.rejection_reason,
    submittedAt: row.submitted_at, processedAt: row.processed_at
  };
}

app.get('/api/health', (c) => ok(c, { status: 'healthy', service: 'pergunu-worker', timestamp: now() }));

app.post('/api/auth/login', async (c) => {
  if (!await limited(c, 'login', 5, 15)) return fail(c, 429, 'RATE_LIMITED', 'Terlalu banyak percobaan. Coba lagi nanti.');
  const body = await bodyJson(c);
  if (!body || !await turnstileOk(c, body.turnstileToken)) return fail(c, 400, 'CHALLENGE_FAILED', 'Verifikasi keamanan gagal.');
  const identifier = cleanText(body.identifier, 254).toLowerCase();
  const user = await c.env.DB.prepare(`
    SELECT * FROM users WHERE lower(email) = ? OR lower(username) = ? LIMIT 1
  `).bind(identifier, identifier).first();
  if (!user || user.status !== 'active' || !await verifyPassword(body.password, user.password_hash)) {
    return fail(c, 401, 'INVALID_CREDENTIALS', 'Email, username, atau kata sandi salah.');
  }
  await createSession(c, user.id);
  await audit(c.env, user.id, 'auth.login', 'user', user.id);
  return ok(c, { user: publicUser(user) });
});

app.post('/api/auth/logout', async (c) => {
  const user = await currentUser(c);
  await destroySession(c);
  if (user) await audit(c.env, user.id, 'auth.logout', 'user', user.id);
  return ok(c, { loggedOut: true });
});

app.get('/api/auth/me', async (c) => {
  const user = await currentUser(c);
  return user ? ok(c, { user: publicUser(user) }) : fail(c, 401, 'UNAUTHENTICATED', 'Belum masuk.');
});

app.post('/api/auth/accept-invitation', async (c) => {
  if (!await limited(c, 'accept-invitation', 8, 30)) return fail(c, 429, 'RATE_LIMITED', 'Terlalu banyak percobaan.');
  const body = await bodyJson(c);
  if (!body?.token || !validPassword(body.password)) return fail(c, 400, 'INVALID_INPUT', 'Token dan kata sandi minimal 12 karakter diperlukan.');
  const tokenRow = await consumeAuthToken(c.env, body.token, 'invitation');
  if (!tokenRow) return fail(c, 400, 'INVALID_TOKEN', 'Tautan undangan tidak valid atau kedaluwarsa.');
  const passwordHash = await hashPassword(body.password);
  await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE users SET password_hash = ?, password_setup_required = 0, status = 'active', updated_at = ? WHERE id = ?`).bind(passwordHash, now(), tokenRow.user_id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(tokenRow.user_id)
  ]);
  await createSession(c, tokenRow.user_id);
  await audit(c.env, tokenRow.user_id, 'auth.invitation_accepted', 'user', tokenRow.user_id);
  return ok(c, { accepted: true });
});

app.post('/api/auth/request-reset', async (c) => {
  if (!await limited(c, 'password-reset', 4, 30)) return ok(c, { requested: true });
  const body = await bodyJson(c);
  const email = cleanEmail(body?.email);
  if (email && await turnstileOk(c, body.turnstileToken)) {
    const user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ? AND status = 'active'").bind(email).first();
    if (user) {
      await c.env.DB.prepare("UPDATE auth_tokens SET used_at = ? WHERE user_id = ? AND purpose = 'password_reset' AND used_at IS NULL").bind(now(), user.id).run();
      const token = await issueAuthToken(c.env, user.id, 'password_reset', 1);
      const link = `${c.env.APP_URL}/atur-password?purpose=reset&token=${encodeURIComponent(token)}`;
      c.executionCtx.waitUntil(sendEmail(c.env, {
        to: user.email,
        subject: 'Atur ulang kata sandi PERGUNU',
        html: emailLayout('Atur ulang kata sandi', `<p>Tautan ini berlaku selama satu jam.</p><p><a href="${escapeHtml(link)}">Atur kata sandi baru</a></p>`)
      }));
    }
  }
  return ok(c, { requested: true });
});

app.post('/api/auth/reset-password', async (c) => {
  const body = await bodyJson(c);
  if (!body?.token || !validPassword(body.password)) return fail(c, 400, 'INVALID_INPUT', 'Token dan kata sandi minimal 12 karakter diperlukan.');
  const tokenRow = await consumeAuthToken(c.env, body.token, 'password_reset');
  if (!tokenRow) return fail(c, 400, 'INVALID_TOKEN', 'Tautan tidak valid atau kedaluwarsa.');
  await c.env.DB.batch([
    c.env.DB.prepare('UPDATE users SET password_hash = ?, password_setup_required = 0, updated_at = ? WHERE id = ?').bind(await hashPassword(body.password), now(), tokenRow.user_id),
    c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(tokenRow.user_id)
  ]);
  await audit(c.env, tokenRow.user_id, 'auth.password_reset', 'user', tokenRow.user_id);
  return ok(c, { reset: true });
});

app.get('/api/news', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM news WHERE published_at IS NOT NULL ORDER BY featured DESC, published_at DESC').all();
  return ok(c, result.results.map(mapNews));
});

app.get('/api/news/:id', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM news WHERE id = ? OR slug = ?').bind(c.req.param('id'), c.req.param('id')).first();
  return row ? ok(c, mapNews(row)) : fail(c, 404, 'NOT_FOUND', 'Berita tidak ditemukan.');
});

app.get('/api/scholarships', async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM scholarships WHERE status != 'draft' ORDER BY deadline ASC").all();
  return ok(c, result.results.map(mapScholarship));
});

app.post('/api/membership-applications', async (c) => {
  if (!await limited(c, 'membership-application', 5, 60)) return fail(c, 429, 'RATE_LIMITED', 'Terlalu banyak pendaftaran dari koneksi ini.');
  const body = await bodyJson(c);
  const email = cleanEmail(body?.email);
  const fullName = cleanText(body?.fullName, 150);
  if (!body || !email || !fullName || !await turnstileOk(c, body.turnstileToken)) return fail(c, 400, 'INVALID_INPUT', 'Nama, email, dan verifikasi keamanan wajib diisi.');
  const existing = await c.env.DB.prepare("SELECT id FROM membership_applications WHERE email = ? AND status IN ('pending','approved') LIMIT 1").bind(email).first();
  if (existing) return fail(c, 409, 'DUPLICATE_APPLICATION', 'Email ini sudah memiliki pendaftaran aktif.');
  const id = crypto.randomUUID();
  const reference = applicationReference('ANG');
  const timestamp = now();
  await c.env.DB.prepare(`
    INSERT INTO membership_applications
      (id, reference, full_name, email, phone, position, school, regional_branch, local_branch, education, experience, address, notes, status, submitted_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).bind(id, reference, fullName, email, cleanText(body.phone, 30) || null, cleanText(body.position, 120) || null,
    cleanText(body.school, 180) || null, cleanText(body.regionalBranch, 150) || null, cleanText(body.localBranch, 150) || null,
    cleanText(body.education, 100) || null, cleanText(body.experience, 100) || null, cleanText(body.address, 1000) || null,
    cleanText(body.notes, 2000) || null, timestamp, timestamp, timestamp).run();
  c.executionCtx.waitUntil(sendEmail(c.env, {
    to: email, subject: `Pendaftaran PERGUNU diterima — ${reference}`,
    html: emailLayout('Pendaftaran diterima', `<p>Halo ${escapeHtml(fullName)}, pendaftaran Anda telah diterima untuk ditinjau.</p><p>Nomor referensi: <strong>${reference}</strong></p>`)
  }));
  return ok(c, { id, reference, status: 'pending' }, 201);
});

app.post('/api/scholarship-applications', async (c) => {
  if (!await limited(c, 'scholarship-application', 5, 60)) return fail(c, 429, 'RATE_LIMITED', 'Terlalu banyak pendaftaran dari koneksi ini.');
  const body = await bodyJson(c);
  const email = cleanEmail(body?.email);
  const fullName = cleanText(body?.fullName, 150);
  const scholarship = body?.scholarshipId ? await c.env.DB.prepare("SELECT id, title FROM scholarships WHERE id = ? AND status = 'open'").bind(body.scholarshipId).first() : null;
  if (!email || !fullName || !scholarship || !await turnstileOk(c, body.turnstileToken)) return fail(c, 400, 'INVALID_INPUT', 'Data pendaftaran tidak lengkap atau beasiswa tidak terbuka.');
  const id = crypto.randomUUID();
  const reference = applicationReference('BEA');
  const timestamp = now();
  await c.env.DB.prepare(`
    INSERT INTO scholarship_applications
      (id, reference, scholarship_id, full_name, email, phone, address, reason, status, submitted_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
  `).bind(id, reference, scholarship.id, fullName, email, cleanText(body.phone, 30) || null,
    cleanText(body.address, 1000) || null, cleanText(body.reason, 3000) || null, timestamp, timestamp, timestamp).run();
  c.executionCtx.waitUntil(sendEmail(c.env, {
    to: email, subject: `Pendaftaran beasiswa diterima — ${reference}`,
    html: emailLayout('Pendaftaran beasiswa diterima', `<p>Program: ${escapeHtml(scholarship.title)}</p><p>Nomor referensi: <strong>${reference}</strong></p>`)
  }));
  return ok(c, { id, reference, status: 'pending' }, 201);
});

app.post('/api/application-status', async (c) => {
  if (!await limited(c, 'application-status', 12, 15)) return fail(c, 429, 'RATE_LIMITED', 'Terlalu banyak pemeriksaan status.');
  const body = await bodyJson(c);
  const email = cleanEmail(body?.email);
  const reference = cleanText(body?.reference, 40).toUpperCase();
  if (!email || !reference) return fail(c, 400, 'INVALID_INPUT', 'Email dan nomor referensi diperlukan.');
  let row = await c.env.DB.prepare('SELECT reference, status, rejection_reason, submitted_at, processed_at FROM membership_applications WHERE reference = ? AND email = ?').bind(reference, email).first();
  let type = 'membership';
  if (!row) {
    row = await c.env.DB.prepare('SELECT reference, status, rejection_reason, submitted_at, processed_at FROM scholarship_applications WHERE reference = ? AND email = ?').bind(reference, email).first();
    type = 'scholarship';
  }
  return row ? ok(c, { type, ...row }) : fail(c, 404, 'NOT_FOUND', 'Pendaftaran tidak ditemukan.');
});

app.get('/api/admin/news', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM news ORDER BY created_at DESC').all();
  return ok(c, result.results.map(mapNews));
});

app.post('/api/admin/news', async (c) => saveNews(c));
app.put('/api/admin/news/:id', async (c) => saveNews(c, c.req.param('id')));

async function saveNews(c, id = null) {
  const body = await bodyJson(c);
  const title = cleanText(body?.title, 220);
  if (!title || !cleanText(body?.content, 100_000)) return fail(c, 400, 'INVALID_INPUT', 'Judul dan isi berita wajib diisi.');
  const cleanHtml = sanitizeHtml(String(body.content).slice(0, 100_000), {
    allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'ol', 'ul', 'li', 'h2', 'h3', 'a'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }, true) }
  });
  const timestamp = now();
  const actor = c.get('user');
  if (id) {
    const previous = await c.env.DB.prepare('SELECT image_key FROM news WHERE id = ?').bind(id).first();
    const result = await c.env.DB.prepare(`
      UPDATE news SET slug = ?, title = ?, summary = ?, content_html = ?, author = ?, category = ?, image_key = ?, featured = ?, published_at = ?, updated_at = ? WHERE id = ?
    `).bind(cleanText(body.slug, 100) || slugify(title), title, cleanText(body.summary, 500) || null, cleanHtml,
      cleanText(body.author, 120) || null, cleanText(body.category, 80) || 'umum', cleanText(body.imageKey, 500) || null,
      body.featured ? 1 : 0, body.published === false ? null : (body.publishedAt || timestamp), timestamp, id).run();
    if (!result.meta.changes) return fail(c, 404, 'NOT_FOUND', 'Berita tidak ditemukan.');
    if (previous?.image_key && previous.image_key !== (cleanText(body.imageKey, 500) || null)) {
      await c.env.MEDIA.delete(`images/${previous.image_key}`);
    }
    await audit(c.env, actor.id, 'news.updated', 'news', id);
  } else {
    id = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO news (id, slug, title, summary, content_html, author, category, image_key, featured, published_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, cleanText(body.slug, 100) || `${slugify(title)}-${id.slice(0, 6)}`, title, cleanText(body.summary, 500) || null,
      cleanHtml, cleanText(body.author, 120) || null, cleanText(body.category, 80) || 'umum', cleanText(body.imageKey, 500) || null,
      body.featured ? 1 : 0, body.published === false ? null : timestamp, timestamp, timestamp).run();
    await audit(c.env, actor.id, 'news.created', 'news', id);
  }
  if (body.featured) await c.env.DB.prepare('UPDATE news SET featured = 0 WHERE id != ?').bind(id).run();
  const row = await c.env.DB.prepare('SELECT * FROM news WHERE id = ?').bind(id).first();
  return ok(c, mapNews(row), id ? 200 : 201);
}

app.delete('/api/admin/news/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare('SELECT image_key FROM news WHERE id = ?').bind(id).first();
  const result = await c.env.DB.prepare('DELETE FROM news WHERE id = ?').bind(id).run();
  if (!result.meta.changes) return fail(c, 404, 'NOT_FOUND', 'Berita tidak ditemukan.');
  if (row?.image_key) await c.env.MEDIA.delete(`images/${row.image_key}`);
  await audit(c.env, c.get('user').id, 'news.deleted', 'news', id);
  return ok(c, { deleted: true });
});

app.get('/api/admin/scholarships', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM scholarships ORDER BY created_at DESC').all();
  return ok(c, result.results.map(mapScholarship));
});

app.post('/api/admin/scholarships', async (c) => saveScholarship(c));
app.put('/api/admin/scholarships/:id', async (c) => saveScholarship(c, c.req.param('id')));

async function saveScholarship(c, id = null) {
  const body = await bodyJson(c);
  const title = cleanText(body?.title, 220);
  if (!title) return fail(c, 400, 'INVALID_INPUT', 'Nama beasiswa wajib diisi.');
  const timestamp = now();
  const values = [title, asInteger(body.amount), body.startsAt || null, body.deadline || null,
    normalizeStatus(body.status, ['draft', 'open', 'closed'], 'draft'), cleanText(body.description, 5000) || null,
    JSON.stringify(parseJsonArray(body.requirements).map((item) => cleanText(item, 500)).filter(Boolean)), cleanText(body.category, 100) || null];
  if (id) {
    const result = await c.env.DB.prepare(`UPDATE scholarships SET title=?, amount=?, starts_at=?, deadline=?, status=?, description=?, requirements_json=?, category=?, updated_at=? WHERE id=?`)
      .bind(...values, timestamp, id).run();
    if (!result.meta.changes) return fail(c, 404, 'NOT_FOUND', 'Beasiswa tidak ditemukan.');
  } else {
    id = crypto.randomUUID();
    await c.env.DB.prepare(`INSERT INTO scholarships (id,title,amount,starts_at,deadline,status,description,requirements_json,category,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(id, ...values, timestamp, timestamp).run();
  }
  await audit(c.env, c.get('user').id, id ? 'scholarship.saved' : 'scholarship.created', 'scholarship', id);
  return ok(c, mapScholarship(await c.env.DB.prepare('SELECT * FROM scholarships WHERE id=?').bind(id).first()));
}

app.delete('/api/admin/scholarships/:id', async (c) => {
  try {
    const result = await c.env.DB.prepare('DELETE FROM scholarships WHERE id = ?').bind(c.req.param('id')).run();
    if (!result.meta.changes) return fail(c, 404, 'NOT_FOUND', 'Beasiswa tidak ditemukan.');
    await audit(c.env, c.get('user').id, 'scholarship.deleted', 'scholarship', c.req.param('id'));
    return ok(c, { deleted: true });
  } catch {
    return fail(c, 409, 'IN_USE', 'Beasiswa memiliki pendaftaran dan tidak dapat dihapus. Tutup program sebagai gantinya.');
  }
});

app.get('/api/admin/applications', async (c) => {
  const type = c.req.query('type') === 'scholarship' ? 'scholarship' : 'membership';
  const table = type === 'scholarship' ? 'scholarship_applications' : 'membership_applications';
  const result = await c.env.DB.prepare(`SELECT * FROM ${table} ORDER BY submitted_at DESC`).all();
  return ok(c, { type, items: result.results.map(type === 'scholarship' ? mapScholarshipApplication : mapMembership) });
});

app.patch('/api/admin/applications/:type/:id', async (c) => {
  const type = c.req.param('type');
  const table = type === 'scholarship' ? 'scholarship_applications' : type === 'membership' ? 'membership_applications' : null;
  if (!table) return fail(c, 400, 'INVALID_TYPE', 'Jenis pendaftaran tidak dikenal.');
  const body = await bodyJson(c);
  const status = normalizeStatus(body?.status, ['pending', 'approved', 'rejected'], null);
  if (!status) return fail(c, 400, 'INVALID_STATUS', 'Status tidak valid.');
  const id = c.req.param('id');
  const application = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
  if (!application) return fail(c, 404, 'NOT_FOUND', 'Pendaftaran tidak ditemukan.');
  const rejectionReason = status === 'rejected' ? cleanText(body.rejectionReason, 1000) : null;
  let userId = application.user_id;
  let invitationToken = null;
  if (status === 'approved' && type === 'membership') {
    let user = await c.env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(application.email).first();
    if (!user) {
      userId = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO users (id,email,username,full_name,role,status,password_setup_required,position,address,phone,created_at,updated_at)
        VALUES (?,?,?,?, 'user','invited',1,?,?,?,?,?)
      `).bind(userId, application.email, null, application.full_name, application.position, application.address, application.phone, now(), now()).run();
      user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
    } else userId = user.id;
    await c.env.DB.prepare("UPDATE auth_tokens SET used_at=? WHERE user_id=? AND purpose='invitation' AND used_at IS NULL").bind(now(), userId).run();
    invitationToken = await issueAuthToken(c.env, userId, 'invitation', 48);
  }
  await c.env.DB.prepare(`UPDATE ${table} SET status=?, rejection_reason=?, processed_at=?, updated_at=?${type === 'membership' ? ', user_id=?' : ''} WHERE id=?`)
    .bind(...(type === 'membership' ? [status, rejectionReason, now(), now(), userId, id] : [status, rejectionReason, now(), now(), id])).run();
  const subject = status === 'approved' ? 'Pendaftaran PERGUNU disetujui' : status === 'rejected' ? 'Pembaruan pendaftaran PERGUNU' : 'Status pendaftaran diperbarui';
  let message = `<p>Status pendaftaran <strong>${escapeHtml(application.reference)}</strong>: ${escapeHtml(status)}</p>`;
  if (invitationToken) {
    const link = `${c.env.APP_URL}/atur-password?purpose=invitation&token=${encodeURIComponent(invitationToken)}`;
    message += `<p><a href="${escapeHtml(link)}">Buat kata sandi akun</a>. Tautan berlaku 48 jam.</p>`;
  }
  if (rejectionReason) message += `<p>Alasan: ${escapeHtml(rejectionReason)}</p>`;
  c.executionCtx.waitUntil(sendEmail(c.env, { to: application.email, subject, html: emailLayout(subject, message) }));
  await audit(c.env, c.get('user').id, `application.${status}`, type, id);
  return ok(c, { id, status, invitationSent: Boolean(invitationToken) });
});

app.get('/api/admin/users', async (c) => {
  const result = await c.env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  return ok(c, result.results.map(publicUser));
});

app.patch('/api/admin/users/:id', async (c) => {
  const body = await bodyJson(c);
  const status = normalizeStatus(body?.status, ['invited', 'active', 'suspended', 'rejected'], null);
  const role = normalizeStatus(body?.role, ['admin', 'user'], null);
  if (!status && !role) return fail(c, 400, 'INVALID_INPUT', 'Tidak ada perubahan yang valid.');
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.req.param('id')).first();
  if (!row) return fail(c, 404, 'NOT_FOUND', 'Pengguna tidak ditemukan.');
  if (row.role === 'admin' && row.status === 'active' && (role === 'user' || status === 'suspended' || status === 'rejected')) {
    const count = await c.env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role='admin' AND status='active'").first();
    if (Number(count.count) <= 1) return fail(c, 409, 'LAST_ADMIN', 'Admin aktif terakhir tidak dapat dinonaktifkan atau diturunkan perannya.');
  }
  await c.env.DB.prepare('UPDATE users SET status=?, role=?, updated_at=? WHERE id=?').bind(status || row.status, role || row.role, now(), row.id).run();
  if (status === 'suspended') await c.env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(row.id).run();
  await audit(c.env, c.get('user').id, 'user.updated', 'user', row.id, { status, role });
  return ok(c, publicUser(await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(row.id).first()));
});

app.post('/api/admin/users/:id/invite', async (c) => {
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(c.req.param('id')).first();
  if (!user) return fail(c, 404, 'NOT_FOUND', 'Pengguna tidak ditemukan.');
  await c.env.DB.prepare("UPDATE auth_tokens SET used_at=? WHERE user_id=? AND purpose='invitation' AND used_at IS NULL").bind(now(), user.id).run();
  const token = await issueAuthToken(c.env, user.id, 'invitation', 48);
  const link = `${c.env.APP_URL}/atur-password?purpose=invitation&token=${encodeURIComponent(token)}`;
  await sendEmail(c.env, { to: user.email, subject: 'Undangan akun PERGUNU', html: emailLayout('Undangan akun', `<p><a href="${escapeHtml(link)}">Buat kata sandi akun</a>. Tautan berlaku 48 jam.</p>`) });
  await audit(c.env, c.get('user').id, 'user.invited', 'user', user.id);
  return ok(c, { sent: true });
});

app.post('/api/admin/media/images', async (c) => {
  const form = await c.req.formData();
  const file = form.get('image');
  if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    return fail(c, 400, 'INVALID_FILE', 'Gunakan gambar JPEG, PNG, WebP, atau GIF maksimal 5 MB.');
  }
  const extension = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[file.type];
  const key = `${crypto.randomUUID()}.${extension}`;
  await c.env.MEDIA.put(`images/${key}`, file.stream(), { httpMetadata: { contentType: file.type }, customMetadata: { uploadedBy: c.get('user').id } });
  await audit(c.env, c.get('user').id, 'image.uploaded', 'media', key, { size: file.size });
  return ok(c, { key, url: `/media/images/${key}` }, 201);
});

app.get('/media/images/:key', async (c) => {
  const object = await c.env.MEDIA.get(`images/${c.req.param('key')}`);
  if (!object) return c.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('ETag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(object.body, { headers });
});

app.post('/api/admin/users/:id/certificates', async (c) => {
  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id=?').bind(c.req.param('id')).first();
  if (!user) return fail(c, 404, 'NOT_FOUND', 'Pengguna tidak ditemukan.');
  const form = await c.req.formData();
  const file = form.get('certificate');
  const title = cleanText(form.get('title'), 200) || 'Sertifikat PERGUNU';
  if (!(file instanceof File) || file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024) return fail(c, 400, 'INVALID_FILE', 'Gunakan PDF maksimal 10 MB.');
  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  if (new TextDecoder().decode(signature) !== '%PDF-') return fail(c, 400, 'INVALID_FILE', 'File bukan PDF yang valid.');
  const id = crypto.randomUUID();
  const objectKey = `certificates/${user.id}/${id}.pdf`;
  await c.env.MEDIA.put(objectKey, file.stream(), { httpMetadata: { contentType: 'application/pdf' } });
  await c.env.DB.prepare(`INSERT INTO certificates (id,user_id,title,original_name,object_key,size_bytes,mime_type,missing_file,uploaded_at,uploaded_by) VALUES (?,?,?,?,?,?,'application/pdf',0,?,?)`)
    .bind(id, user.id, title, cleanText(file.name, 240), objectKey, file.size, now(), c.get('user').id).run();
  await audit(c.env, c.get('user').id, 'certificate.uploaded', 'certificate', id, { userId: user.id, size: file.size });
  return ok(c, { id, userId: user.id, title, originalName: file.name, size: file.size, missingFile: false }, 201);
});

app.get('/api/admin/users/:id/certificates', async (c) => {
  const result = await c.env.DB.prepare('SELECT id,title,original_name,size_bytes,missing_file,uploaded_at FROM certificates WHERE user_id=? ORDER BY uploaded_at DESC').bind(c.req.param('id')).all();
  return ok(c, result.results.map((row) => ({ id: row.id, title: row.title, originalName: row.original_name, size: row.size_bytes, missingFile: Boolean(row.missing_file), uploadedAt: row.uploaded_at })));
});

app.delete('/api/admin/certificates/:id', async (c) => {
  const cert = await c.env.DB.prepare('SELECT * FROM certificates WHERE id=?').bind(c.req.param('id')).first();
  if (!cert) return fail(c, 404, 'NOT_FOUND', 'Sertifikat tidak ditemukan.');
  if (cert.object_key) await c.env.MEDIA.delete(cert.object_key);
  await c.env.DB.prepare('DELETE FROM certificates WHERE id=?').bind(cert.id).run();
  await audit(c.env, c.get('user').id, 'certificate.deleted', 'certificate', cert.id);
  return ok(c, { deleted: true });
});

app.get('/api/account/certificates', async (c) => {
  const result = await c.env.DB.prepare('SELECT id,title,original_name,size_bytes,missing_file,uploaded_at FROM certificates WHERE user_id=? ORDER BY uploaded_at DESC').bind(c.get('user').id).all();
  return ok(c, result.results.map((row) => ({ id: row.id, title: row.title, originalName: row.original_name, size: row.size_bytes, missingFile: Boolean(row.missing_file), uploadedAt: row.uploaded_at, downloadUrl: row.missing_file ? null : `/api/account/certificates/${row.id}/download` })));
});

app.get('/api/account/certificates/:id/download', async (c) => {
  const cert = await c.env.DB.prepare('SELECT * FROM certificates WHERE id=? AND user_id=?').bind(c.req.param('id'), c.get('user').id).first();
  if (!cert || cert.missing_file || !cert.object_key) return fail(c, 404, 'NOT_FOUND', 'File sertifikat belum tersedia.');
  const object = await c.env.MEDIA.get(cert.object_key);
  if (!object) return fail(c, 404, 'NOT_FOUND', 'File sertifikat belum tersedia.');
  return new Response(object.body, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${cleanText(cert.original_name, 180).replaceAll('"', '')}"`, 'Cache-Control': 'private, no-store' } });
});

app.notFound((c) => c.req.path.startsWith('/api/')
  ? fail(c, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan.')
  : new Response('Not found', { status: 404 }));

export default app;
