-- Migration number: 0001 	 2026-08-26T07:24:31.881Z

-- Users. `profile` is flattened into profile_* columns rather than a separate
-- table: it is strictly 1:1 with the account, and the hot path (authRequired,
-- which runs on every authenticated request) needs it in the same row.
--
-- All timestamps are INTEGER epoch-milliseconds (Date.now()), matching
-- auth_events.ts's existing `ts` field. Conversion to/from the Date-typed
-- fields in src/schema.ts happens only at the src/lib/db.ts boundary.
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_iterations INTEGER NOT NULL,
  email_verified INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 0,
  session_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_login_at INTEGER,
  profile_name TEXT,
  profile_designation TEXT,
  profile_photo_url TEXT,
  profile_company_name TEXT,
  profile_company_logo_url TEXT,
  profile_handle TEXT
);

-- Best-effort audit trail of auth-flow events, surfaced read-only through the
-- admin API. Written off the response path (waitUntil), never blocking auth.
CREATE TABLE auth_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  type TEXT NOT NULL,
  email TEXT,
  ip TEXT,
  detail TEXT
);

-- The admin log view is always "newest N events", so the index carries the sort.
CREATE INDEX idx_auth_events_ts ON auth_events(ts DESC);
