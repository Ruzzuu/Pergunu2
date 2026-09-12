import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sanitizeHtml from 'sanitize-html';

const sourcePath = path.resolve(process.argv[2] || '../backend/src/db.json');
const outputDir = path.resolve('.generated');
const outputPath = path.join(outputDir, 'legacy-import.sql');
const reportPath = path.join(outputDir, 'legacy-import-report.json');

if (!fs.existsSync(sourcePath)) throw new Error(`Database lama tidak ditemukan: ${sourcePath}`);
const legacy = JSON.parse(fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, ''));
const expected = { users: 6, news: 7, applications: 8, beasiswa: 6 };
for (const [collection, count] of Object.entries(expected)) {
  if (!Array.isArray(legacy[collection]) || legacy[collection].length !== count) {
    throw new Error(`Validasi gagal: ${collection} berisi ${legacy[collection]?.length ?? 'bukan array'}, seharusnya ${count}.`);
  }
}

const q = (value) => value === null || value === undefined || value === '' ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`;
const timestamp = (value) => {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};
const stableId = (type, value) => {
  const hex = crypto.createHash('sha256').update(`pergunu:${type}:${value}`).digest('hex').slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
};
const slugify = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70);
const html = (value) => sanitizeHtml(String(value || ''), {
  allowedTags: ['p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'ol', 'ul', 'li', 'h2', 'h3', 'a'],
  allowedAttributes: { a: ['href', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto']
});
const status = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (['active', 'aktif', 'open', 'dibuka'].includes(normalized)) return 'open';
  if (['closed', 'tutup', 'ditutup', 'expired'].includes(normalized)) return 'closed';
  return 'draft';
};

const sql = ['PRAGMA foreign_keys = ON;', 'BEGIN TRANSACTION;'];
const userIds = new Map();
let missingCertificates = 0;
let missingNewsImages = 0;

for (const user of legacy.users) {
  const id = stableId('user', user.id);
  userIds.set(String(user.id), id);
  const email = String(user.email || '').trim().toLowerCase();
  if (!email.includes('@')) throw new Error(`User legacy ${user.id} tidak memiliki email valid.`);
  const created = timestamp(user.createdAt);
  sql.push(`INSERT INTO users (id,legacy_id,email,username,full_name,password_hash,role,status,password_setup_required,position,address,phone,created_at,updated_at) VALUES (${q(id)},${q(user.id)},${q(email)},${q(user.username)},${q(user.fullName || user.name || user.username)},NULL,${q(user.role === 'admin' ? 'admin' : 'user')},'invited',1,${q(user.position)},${q(user.address)},${q(user.phone)},${q(created)},${q(created)}) ON CONFLICT(legacy_id) DO UPDATE SET email=excluded.email,username=excluded.username,full_name=excluded.full_name,position=excluded.position,address=excluded.address,phone=excluded.phone,updated_at=excluded.updated_at;`);
  for (const certificate of user.certificates || []) {
    const certificateId = stableId('certificate', `${user.id}:${certificate.id || certificate.filename || certificate.fileName}`);
    const uploadedAt = timestamp(certificate.uploadDate || certificate.uploadedAt);
    sql.push(`INSERT INTO certificates (id,legacy_id,user_id,title,original_name,object_key,size_bytes,mime_type,missing_file,uploaded_at,uploaded_by) VALUES (${q(certificateId)},${q(certificate.id)},${q(id)},${q(certificate.title || certificate.description || 'Sertifikat PERGUNU')},${q(certificate.originalName || certificate.fileName || certificate.filename || 'sertifikat.pdf')},NULL,${Number(certificate.size) || 'NULL'},'application/pdf',1,${q(uploadedAt)},NULL) ON CONFLICT(id) DO UPDATE SET title=excluded.title,original_name=excluded.original_name,missing_file=1;`);
    missingCertificates += 1;
  }
}

for (const item of legacy.news) {
  const id = stableId('news', item.id);
  const created = timestamp(item.createdAt || item.publishDate);
  const updated = timestamp(item.updatedAt || item.createdAt || item.publishDate);
  const published = item.publishDate || item.createdAt ? timestamp(item.publishDate || item.createdAt) : null;
  const slug = `${slugify(item.title)}-${String(item.id).slice(-6)}`;
  sql.push(`INSERT INTO news (id,legacy_id,slug,title,summary,content_html,author,category,image_key,legacy_image,featured,published_at,created_at,updated_at) VALUES (${q(id)},${q(item.id)},${q(slug)},${q(item.title)},${q(item.summary)},${q(html(item.content))},${q(item.author)},${q(item.category || 'umum')},NULL,${q(item.image)},${item.featured ? 1 : 0},${q(published)},${q(created)},${q(updated)}) ON CONFLICT(legacy_id) DO UPDATE SET slug=excluded.slug,title=excluded.title,summary=excluded.summary,content_html=excluded.content_html,author=excluded.author,category=excluded.category,legacy_image=excluded.legacy_image,featured=excluded.featured,published_at=excluded.published_at,updated_at=excluded.updated_at;`);
  if (item.image) missingNewsImages += 1;
}

for (const item of legacy.beasiswa) {
  const id = stableId('scholarship', item.id);
  const created = timestamp(item.createdAt);
  const updated = timestamp(item.updatedAt || item.createdAt);
  const requirements = Array.isArray(item.persyaratan) ? item.persyaratan : [];
  const amount = Number(String(item.nominal ?? '').replace(/[^0-9]/g, '')) || null;
  sql.push(`INSERT INTO scholarships (id,legacy_id,title,amount,starts_at,deadline,status,description,requirements_json,category,created_at,updated_at) VALUES (${q(id)},${q(item.id)},${q(item.judul || item.title)},${amount ?? 'NULL'},${q(item.tanggal_mulai)},${q(item.deadline)},${q(status(item.status))},${q(item.deskripsi)},${q(JSON.stringify(requirements))},${q(item.kategori)},${q(created)},${q(updated)}) ON CONFLICT(legacy_id) DO UPDATE SET title=excluded.title,amount=excluded.amount,starts_at=excluded.starts_at,deadline=excluded.deadline,status=excluded.status,description=excluded.description,requirements_json=excluded.requirements_json,category=excluded.category,updated_at=excluded.updated_at;`);
}

for (const item of legacy.applications) {
  const id = stableId('membership-application', item.id);
  const created = timestamp(item.createdAt || item.submittedAt || item.submissionDate);
  const updated = timestamp(item.updatedAt || item.processedAt || item.submittedAt || item.submissionDate);
  const normalizedStatus = ['approved', 'rejected'].includes(String(item.status).toLowerCase()) ? String(item.status).toLowerCase() : 'pending';
  const userId = userIds.get(String(item.userId)) || null;
  const reference = `ANG-LEGACY-${String(item.id).replace(/[^a-zA-Z0-9]/g, '').slice(-12).toUpperCase()}`;
  sql.push(`INSERT INTO membership_applications (id,legacy_id,reference,user_id,full_name,email,phone,position,school,regional_branch,local_branch,education,experience,address,notes,status,rejection_reason,submitted_at,processed_at,created_at,updated_at) VALUES (${q(id)},${q(item.id)},${q(reference)},${q(userId)},${q(item.fullName || item.applicantName)},${q(String(item.email || '').toLowerCase())},${q(item.phone)},${q(item.position)},${q(item.school)},${q(item.pw)},${q(item.pc)},${q(item.education)},${q(item.experience)},${q(item.address)},${q(item.notes)},${q(normalizedStatus)},${q(item.rejectionReason)},${q(timestamp(item.submittedAt || item.submissionDate))},${q(item.processedAt ? timestamp(item.processedAt) : null)},${q(created)},${q(updated)}) ON CONFLICT(legacy_id) DO UPDATE SET user_id=excluded.user_id,full_name=excluded.full_name,email=excluded.email,phone=excluded.phone,position=excluded.position,school=excluded.school,regional_branch=excluded.regional_branch,local_branch=excluded.local_branch,education=excluded.education,experience=excluded.experience,address=excluded.address,notes=excluded.notes,status=excluded.status,rejection_reason=excluded.rejection_reason,processed_at=excluded.processed_at,updated_at=excluded.updated_at;`);
}

sql.push('DELETE FROM sessions;', 'COMMIT;');
fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${sql.join('\n')}\n`, { mode: 0o600 });
const report = {
  source: path.basename(sourcePath), generatedAt: new Date().toISOString(), expected,
  imported: { users: legacy.users.length, news: legacy.news.length, membershipApplications: legacy.applications.length, scholarships: legacy.beasiswa.length },
  ignoredSessions: Array.isArray(legacy.sessions) ? legacy.sessions.length : 0,
  missingMedia: { newsImages: missingNewsImages, certificates: missingCertificates },
  passwordPolicy: 'All imported password hashes discarded; password setup required.'
};
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(`Import SQL dibuat: ${outputPath}`);
console.log(`Laporan dibuat: ${reportPath}`);
console.log(JSON.stringify(report, null, 2));
