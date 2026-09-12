import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 600_000;
const SESSION_HOURS = 12;

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

export function randomToken(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return bytesToBase64(data).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export async function hashToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(token));
  return bytesToBase64(new Uint8Array(digest));
}

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    material,
    256
  );
  return `pbkdf2_sha256$${PBKDF2_ITERATIONS}$${bytesToBase64(salt)}$${bytesToBase64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password, encoded) {
  if (!encoded?.startsWith('pbkdf2_sha256$')) return false;
  const [, iterationsText, saltText, expectedText] = encoded.split('$');
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100_000) return false;
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64ToBytes(saltText), iterations, hash: 'SHA-256' },
    material,
    256
  );
  const actual = new Uint8Array(bits);
  const expected = base64ToBytes(expectedText);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

function cookieName(c) {
  return new URL(c.req.url).protocol === 'https:' ? '__Host-pergunu_session' : 'pergunu_session';
}

export async function createSession(c, userId) {
  const token = randomToken();
  const tokenHash = await hashToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1000);
  await c.env.DB.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), userId, tokenHash, expires.toISOString(), now.toISOString(), now.toISOString()).run();
  setCookie(c, cookieName(c), token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_HOURS * 60 * 60
  });
}

export async function destroySession(c) {
  const token = getCookie(c, '__Host-pergunu_session') || getCookie(c, 'pergunu_session');
  if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hashToken(token)).run();
  deleteCookie(c, '__Host-pergunu_session', { path: '/', secure: true });
  deleteCookie(c, 'pergunu_session', { path: '/' });
}

export async function currentUser(c) {
  const token = getCookie(c, '__Host-pergunu_session') || getCookie(c, 'pergunu_session');
  if (!token) return null;
  const row = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.username, u.full_name, u.role, u.status, u.password_setup_required,
           u.position, u.address, u.phone, s.id AS session_id, s.expires_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
  `).bind(await hashToken(token), new Date().toISOString()).first();
  if (!row) return null;
  c.executionCtx.waitUntil(
    c.env.DB.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?')
      .bind(new Date().toISOString(), row.session_id).run()
  );
  delete row.session_id;
  delete row.expires_at;
  return row;
}

export async function requireUser(c, next) {
  const user = await currentUser(c);
  if (!user) return c.json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Silakan masuk terlebih dahulu.' } }, 401);
  c.set('user', user);
  await next();
}

export async function requireAdmin(c, next) {
  const user = c.get('user') || await currentUser(c);
  if (!user) return c.json({ data: null, error: { code: 'UNAUTHENTICATED', message: 'Silakan masuk terlebih dahulu.' } }, 401);
  if (user.role !== 'admin') return c.json({ data: null, error: { code: 'FORBIDDEN', message: 'Akses admin diperlukan.' } }, 403);
  c.set('user', user);
  await next();
}

export async function issueAuthToken(env, userId, purpose, lifetimeHours = 24) {
  const token = randomToken();
  const now = new Date();
  await env.DB.prepare(`
    INSERT INTO auth_tokens (id, user_id, token_hash, purpose, expires_at, used_at, created_at)
    VALUES (?, ?, ?, ?, ?, NULL, ?)
  `).bind(
    crypto.randomUUID(), userId, await hashToken(token), purpose,
    new Date(now.getTime() + lifetimeHours * 60 * 60 * 1000).toISOString(), now.toISOString()
  ).run();
  return token;
}

export async function consumeAuthToken(env, token, purpose) {
  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare(`
    SELECT id, user_id FROM auth_tokens
    WHERE token_hash = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?
  `).bind(tokenHash, purpose, new Date().toISOString()).first();
  if (!row) return null;
  await env.DB.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ? AND used_at IS NULL')
    .bind(new Date().toISOString(), row.id).run();
  return row;
}
