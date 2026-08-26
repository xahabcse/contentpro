-- LOCAL-ONLY demo fixture. Deliberately NOT a file in migrations/ -- it must
-- never be picked up by `wrangler d1 migrations apply --remote` and land a
-- known-password account in production. Apply it only with:
--   npx wrangler d1 execute contentpro-db --local --file=./seed.sql
-- (docker/api-entrypoint.sh does exactly this on every container start.)
--
-- Seeds a ready-to-use, pre-verified demo account so anyone running the local
-- stack can log in and use the full editor immediately -- no Resend/email and
-- no signup required.
--
--   email:    demo@contentpro.local
--   password: demo1234
--
-- The password fields are a real PBKDF2-HMAC-SHA256 hash produced with the
-- exact parameters src/lib/password.ts verifies against (SHA-256, 100000
-- iterations, 32-byte key, 16-byte salt, base64), so login succeeds unchanged.
--
-- created_at/updated_at are a hardcoded epoch-ms literal (2026-01-01T00:00:00Z)
-- rather than a SQLite time function: keeping the row byte-identical on every
-- re-run makes the ON CONFLICT no-op genuinely idempotent.
INSERT INTO users (
  id,
  email,
  password_hash,
  password_salt,
  password_iterations,
  email_verified,
  token_version,
  session_version,
  created_at,
  updated_at,
  profile_name,
  profile_handle,
  profile_designation,
  profile_company_name
) VALUES (
  'de300000-0000-4000-8000-000000000001',
  'demo@contentpro.local',
  '5rJlLpTc0ba5tap0dpogCKiXRvy8JsZr06ZRcXjoYpM=',
  'mQR+wsBj1BwnOuajVWaHFA==',
  100000,
  1,
  0,
  0,
  1767225600000,
  1767225600000,
  'Demo User',
  'demo',
  'Trying ContentPro locally',
  'ContentPro'
)
ON CONFLICT(email) DO NOTHING;
