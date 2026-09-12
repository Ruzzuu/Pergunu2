PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  legacy_id TEXT UNIQUE,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  username TEXT COLLATE NOCASE UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'suspended', 'rejected')),
  password_setup_required INTEGER NOT NULL DEFAULT 1 CHECK (password_setup_required IN (0, 1)),
  position TEXT,
  address TEXT,
  phone TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('invitation', 'password_reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_tokens_lookup_idx ON auth_tokens(token_hash, purpose);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  legacy_id TEXT UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT,
  content_html TEXT NOT NULL,
  author TEXT,
  category TEXT NOT NULL DEFAULT 'umum',
  image_key TEXT,
  legacy_image TEXT,
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS news_published_idx ON news(published_at DESC);

CREATE TABLE IF NOT EXISTS scholarships (
  id TEXT PRIMARY KEY,
  legacy_id TEXT UNIQUE,
  title TEXT NOT NULL,
  amount INTEGER,
  starts_at TEXT,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'closed')),
  description TEXT,
  requirements_json TEXT NOT NULL DEFAULT '[]',
  category TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS membership_applications (
  id TEXT PRIMARY KEY,
  legacy_id TEXT UNIQUE,
  reference TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT,
  position TEXT,
  school TEXT,
  regional_branch TEXT,
  local_branch TEXT,
  education TEXT,
  experience TEXT,
  address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS membership_email_idx ON membership_applications(email);
CREATE INDEX IF NOT EXISTS membership_status_idx ON membership_applications(status);

CREATE TABLE IF NOT EXISTS scholarship_applications (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE,
  scholarship_id TEXT NOT NULL REFERENCES scholarships(id) ON DELETE RESTRICT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  phone TEXT,
  address TEXT,
  reason TEXT,
  documents_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  submitted_at TEXT NOT NULL,
  processed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS scholarship_app_status_idx ON scholarship_applications(status);

CREATE TABLE IF NOT EXISTS certificates (
  id TEXT PRIMARY KEY,
  legacy_id TEXT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  original_name TEXT NOT NULL,
  object_key TEXT,
  size_bytes INTEGER,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  missing_file INTEGER NOT NULL DEFAULT 0 CHECK (missing_file IN (0, 1)),
  uploaded_at TEXT NOT NULL,
  uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS certificates_user_idx ON certificates(user_id);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_events(created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started_at TEXT NOT NULL
);
