import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const valueAfter = (flag) => {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
};
const email = valueAfter('--email')?.trim().toLowerCase();
const name = valueAfter('--name')?.trim() || 'Administrator PERGUNU';
const preview = process.argv.includes('--preview');
const appUrl = valueAfter('--app-url') || (preview
  ? 'https://pergunu-situbondo-preview.fairuz-fuadi04.workers.dev'
  : 'https://pergunu.fairuzfd.dev');
const remote = process.argv.includes('--remote');
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Gunakan lokal: npm run admin:create -- --email admin@example.com [--name "Nama"]');
  console.error('Gunakan preview: npm run admin:create:preview -- --email admin@example.com [--name "Nama"]');
  process.exit(1);
}

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const token = crypto.randomBytes(32).toString('base64url');
const tokenHash = crypto.createHash('sha256').update(token).digest('base64');
const userId = crypto.randomUUID();
const authId = crypto.randomUUID();
const now = new Date();
const expires = new Date(now.getTime() + 48 * 60 * 60 * 1000);
const sql = `BEGIN TRANSACTION;
INSERT INTO users (id,email,full_name,role,status,password_setup_required,created_at,updated_at)
VALUES (${q(userId)},${q(email)},${q(name)},'admin','invited',1,${q(now.toISOString())},${q(now.toISOString())})
ON CONFLICT(email) DO UPDATE SET full_name=excluded.full_name,role='admin',status='invited',password_hash=NULL,password_setup_required=1,updated_at=excluded.updated_at;
DELETE FROM auth_tokens WHERE user_id=(SELECT id FROM users WHERE email=${q(email)}) AND purpose='invitation';
INSERT INTO auth_tokens (id,user_id,token_hash,purpose,expires_at,created_at)
VALUES (${q(authId)},(SELECT id FROM users WHERE email=${q(email)}),${q(tokenHash)},'invitation',${q(expires.toISOString())},${q(now.toISOString())});
DELETE FROM sessions WHERE user_id=(SELECT id FROM users WHERE email=${q(email)});
COMMIT;\n`;

const tempPath = path.join(os.tmpdir(), `pergunu-admin-${crypto.randomUUID()}.sql`);
fs.writeFileSync(tempPath, sql, { mode: 0o600 });
try {
  const database = preview ? 'pergunu-db-preview' : 'pergunu-db';
  const args = ['wrangler', 'd1', 'execute', database, preview || remote ? '--remote' : '--local'];
  if (preview) args.push('--env', 'preview');
  args.push(`--file=${tempPath}`);
  const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
  console.log('\nAdmin siap diaktifkan. Buka tautan satu kali ini dalam 48 jam:');
  console.log(`${appUrl}/atur-password?purpose=invitation&token=${encodeURIComponent(token)}`);
} finally {
  fs.rmSync(tempPath, { force: true });
}
