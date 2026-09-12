export async function verifyTurnstile(env, token, remoteIp) {
  if (!env.TURNSTILE_SECRET) return true;
  if (!token) return false;
  const body = new FormData();
  body.set('secret', env.TURNSTILE_SECRET);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const result = await response.json();
  return result.success === true;
}

export async function sendEmail(env, { to, subject, html }) {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) return { skipped: true };
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.RESEND_FROM, to: [to], subject, html })
  });
  if (!response.ok) throw new Error(`Resend gagal: ${response.status}`);
  return response.json();
}

export function emailLayout(title, body) {
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#183024;line-height:1.6">
    <div style="max-width:600px;margin:auto;padding:24px;border-top:6px solid #0f7536">
      <h1 style="font-size:22px">${escapeHtml(title)}</h1>${body}
      <p style="color:#647067;font-size:13px">PERGUNU Situbondo</p>
    </div></body></html>`;
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

export async function audit(env, actorUserId, action, targetType, targetId, metadata = {}) {
  await env.DB.prepare(`
    INSERT INTO audit_events (id, actor_user_id, action, target_type, target_id, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(crypto.randomUUID(), actorUserId || null, action, targetType, targetId || null, JSON.stringify(metadata), new Date().toISOString()).run();
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || crypto.randomUUID();
}

export function applicationReference(prefix = 'PGN') {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${prefix}-${date}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    fullName: row.full_name,
    role: row.role,
    status: row.status,
    passwordSetupRequired: Boolean(row.password_setup_required),
    position: row.position,
    address: row.address,
    phone: row.phone
  };
}
