-- VisaFit sponsorship database schema

CREATE TABLE IF NOT EXISTS employer_lca (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_norm TEXT NOT NULL,
  employer_display TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  certified INTEGER NOT NULL DEFAULT 0,
  denied INTEGER NOT NULL DEFAULT 0,
  withdrawn INTEGER NOT NULL DEFAULT 0,
  median_wage REAL,
  top_titles TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(employer_norm, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_employer_lca_norm ON employer_lca(employer_norm);
CREATE INDEX IF NOT EXISTS idx_employer_lca_display ON employer_lca(employer_display);

CREATE TABLE IF NOT EXISTS employer_alias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alias_norm TEXT NOT NULL UNIQUE,
  canonical_norm TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual'
);

CREATE INDEX IF NOT EXISTS idx_employer_alias_canonical ON employer_alias(canonical_norm);

CREATE TABLE IF NOT EXISTS uscis_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employer_norm TEXT NOT NULL,
  employer_display TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  initial_approved INTEGER NOT NULL DEFAULT 0,
  initial_denied INTEGER NOT NULL DEFAULT 0,
  continuing_approved INTEGER NOT NULL DEFAULT 0,
  continuing_denied INTEGER NOT NULL DEFAULT 0,
  UNIQUE(employer_norm, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_uscis_employer_norm ON uscis_approvals(employer_norm);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  password_hash TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 10,
  slot_names_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot INTEGER NOT NULL CHECK(slot >= 1 AND slot <= 5),
  name TEXT NOT NULL DEFAULT 'Resume',
  content TEXT NOT NULL,
  filename TEXT,
  embedding TEXT,
  profile_json TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);

CREATE TABLE IF NOT EXISTS ingestions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  params_json TEXT NOT NULL,
  total INTEGER NOT NULL DEFAULT 0,
  analyzed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ingestions_user ON ingestions(user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ingestion_id TEXT REFERENCES ingestions(id) ON DELETE SET NULL,
  linkedin_job_id TEXT,
  title TEXT,
  company TEXT,
  location TEXT,
  posted_date TEXT,
  url TEXT,
  jd_text TEXT,
  visa_signal TEXT,
  visa_summary TEXT,
  visa_confidence INTEGER,
  ghost_risk TEXT,
  ghost_score INTEGER DEFAULT 0,
  staffing_score INTEGER DEFAULT 0,
  best_resume_id TEXT REFERENCES resumes(id) ON DELETE SET NULL,
  fit_score REAL DEFAULT 0,
  evidence_json TEXT,
  status TEXT NOT NULL DEFAULT 'interested',
  applied_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, linkedin_job_id)
);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_ingestion ON jobs(ingestion_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(user_id, status);

CREATE TABLE IF NOT EXISTS analyses (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  company TEXT,
  jd_snippet TEXT,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
