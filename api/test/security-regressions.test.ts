import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import { getAdminOverview, patchUserProfile, recordLoginIfSessionVersion, resetUserPasswordIfTokenVersion } from '../src/lib/db.ts';
import { verifySessionToken, signSessionToken } from '../src/lib/jwt.ts';
import { deleteProfileImages } from '../src/lib/storage.ts';

const openDatabases: DatabaseSync[] = [];

afterEach(() => {
  for (const db of openDatabases.splice(0)) db.close();
});

function localD1() {
  const sqlite = new DatabaseSync(':memory:');
  openDatabases.push(sqlite);
  sqlite.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    password_iterations INTEGER NOT NULL,
    token_version INTEGER NOT NULL,
    session_version INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    last_login_at INTEGER,
    profile_name TEXT,
    profile_designation TEXT,
    profile_photo_url TEXT,
    profile_company_name TEXT,
    profile_company_logo_url TEXT,
    profile_handle TEXT
  )`);
  sqlite.prepare(`INSERT INTO users (
    id, password_hash, password_salt, password_iterations, token_version,
    session_version, updated_at, profile_name, profile_photo_url
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    'user-1', 'old-hash', 'old-salt', 100_000, 4, 2, 1, 'Old name', 'profiles/photo/user-1',
  );
  const d1 = {
    prepare(sql: string) {
      const statement = sqlite.prepare(sql);
      return {
        bind(...values: (string | number | null)[]) {
          return {
            async run() {
              const result = statement.run(...values);
              return { meta: { changes: Number(result.changes) } };
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  return { sqlite, d1 };
}

describe('account data updates', () => {
  it('keeps an image reference when profile text is edited', async () => {
    const { sqlite, d1 } = localD1();
    assert.equal(await patchUserProfile(d1, 'user-1', { name: 'New name' }), true);
    assert.equal(await patchUserProfile(d1, 'user-1', { companyLogoUrl: 'profiles/logo/user-1' }), true);
    assert.deepEqual({ ...sqlite.prepare('SELECT profile_name, profile_photo_url, profile_company_logo_url FROM users WHERE id = ?').get('user-1') },
      { profile_name: 'New name', profile_photo_url: 'profiles/photo/user-1', profile_company_logo_url: 'profiles/logo/user-1' });
  });

  it('consumes a password reset version exactly once', async () => {
    const { sqlite, d1 } = localD1();
    const first = { hash: 'first-hash', salt: 'first-salt', iterations: 100_000 };
    const second = { hash: 'second-hash', salt: 'second-salt', iterations: 100_000 };
    assert.equal(await resetUserPasswordIfTokenVersion(d1, 'user-1', 4, first), true);
    assert.equal(await resetUserPasswordIfTokenVersion(d1, 'user-1', 4, second), false);
    assert.deepEqual({ ...sqlite.prepare('SELECT password_hash, token_version, session_version FROM users WHERE id = ?').get('user-1') },
      { password_hash: 'first-hash', token_version: 5, session_version: 3 });
  });

  it('does not restore the old password when login rehash finishes after a reset', async () => {
    const { sqlite, d1 } = localD1();
    const newPassword = { hash: 'new-password-hash', salt: 'new-salt', iterations: 100_000 };
    assert.equal(await resetUserPasswordIfTokenVersion(d1, 'user-1', 4, newPassword), true);
    assert.equal(await recordLoginIfSessionVersion(d1, 'user-1', 2, {
      hash: 'old-password-rehash', salt: 'old-salt-rehash', iterations: 100_000,
    }), false);
    assert.deepEqual({ ...sqlite.prepare('SELECT password_hash, session_version FROM users WHERE id = ?').get('user-1') },
      { password_hash: 'new-password-hash', session_version: 3 });
  });
});

describe('token and media cleanup', () => {
  it('rejects a malformed signature without throwing', async () => {
    const secret = 'test-secret-long-enough-for-hmac';
    const token = await signSessionToken('user-1', true, 2, secret);
    const [header, payload] = token.split('.');
    assert.equal(await verifySessionToken(`${header}.${payload}.%%%`, secret), null);
    assert.equal((await verifySessionToken(token, secret))?.sub, 'user-1');
  });

  it('removes both deterministic R2 image keys', async () => {
    const deleted: string[] = [];
    const bucket = { delete: async (key: string) => { deleted.push(key); } } as unknown as R2Bucket;
    await deleteProfileImages(bucket, 'user-1');
    assert.deepEqual(deleted.sort(), ['profiles/logo/user-1', 'profiles/photo/user-1']);
  });
});

describe('admin overview counts', () => {
  it('counts all matching rows, including events beyond the 200-row log preview', async () => {
    const sqlite = new DatabaseSync(':memory:');
    openDatabases.push(sqlite);
    sqlite.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, email_verified INTEGER NOT NULL, created_at INTEGER NOT NULL, status INTEGER NOT NULL DEFAULT 1);
      CREATE TABLE auth_events (ts INTEGER NOT NULL, type TEXT NOT NULL, ip TEXT);`);
    const now = Date.UTC(2026, 10, 11, 12);
    const day = 24 * 60 * 60 * 1000;
    const sevenDays = 7 * day;
    const insertUser = sqlite.prepare('INSERT INTO users (id, email_verified, created_at) VALUES (?, ?, ?)');
    insertUser.run('u1', 1, now - 60 * 60 * 1000);
    insertUser.run('u2', 0, now - 3 * day);
    insertUser.run('u3', 1, now - 8 * day);
    insertUser.run('u4', 1, now - day);
    insertUser.run('u5', 0, now - sevenDays);
    const insertEvent = sqlite.prepare('INSERT INTO auth_events VALUES (?, ?, ?)');
    for (let i = 0; i < 205; i++) insertEvent.run(now - 1000, 'login_failed', '203.0.113.1');
    insertEvent.run(now - 2 * day, 'login_failed', '203.0.113.1');
    insertEvent.run(now - sevenDays, 'login_failed', '203.0.113.2');
    insertEvent.run(now - 60 * 1000, 'login_failed', null);
    insertEvent.run(now - 8 * day, 'login_failed', '203.0.113.3');
    insertEvent.run(now - 1000, 'login', '203.0.113.4');
    insertEvent.run(now - 8 * day, 'login', '203.0.113.4');
    const d1 = {
      prepare(sql: string) {
        const statement = sqlite.prepare(sql);
        return {
          bind(...values: (string | number | null)[]) {
            return {
              async first() {
                const row = statement.get(...values);
                return row ? { ...row } : null;
              },
            };
          },
        };
      },
    } as unknown as D1Database;
    assert.deepEqual(await getAdminOverview(d1, now), {
      totalUsers: 5,
      verifiedUsers: 3,
      newUsers24h: 2,
      newUsers7d: 4,
      successfulLogins7d: 1,
      failedLogins7d: 208,
      failedLoginIps7d: 2,
    });
  });

  it('requires a verified allowlisted session on the overview route', async () => {
    // Node's strip-types runner does not resolve the extensionless imports used
    // by the Cloudflare bundle; this hook adds .ts only for local modules.
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier.startsWith('.') && !extname(specifier)) {
          return nextResolve(`${specifier}.ts`, context);
        }
        return nextResolve(specifier, context);
      },
    });
    const { default: adminRoute } = await import('../src/routes/admin.ts');
    const sqlite = new DatabaseSync(':memory:');
    openDatabases.push(sqlite);
    for (const migration of ['0001_init.sql', '0002_status_column.sql']) {
      sqlite.exec(readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
    }
    const now = Date.now();
    const insert = sqlite.prepare(`INSERT INTO users
      (id, email, password_hash, password_salt, password_iterations, email_verified,
       token_version, session_version, created_at, updated_at)
      VALUES (?, ?, 'hash', 'salt', 100000, ?, 0, 0, ?, ?)`);
    insert.run('admin', 'admin@example.com', 1, now, now);
    insert.run('member', 'member@example.com', 1, now, now);
    const d1 = {
      prepare(sql: string) {
        const statement = sqlite.prepare(sql);
        return {
          bind(...values: (string | number | null)[]) {
            return {
              async first() {
                const row = statement.get(...values);
                return row ? { ...row } : null;
              },
            };
          },
        };
      },
    } as unknown as D1Database;
    const secret = 'overview-test-secret-long-enough';
    const env = { DB: d1, JWT_SECRET: secret, ADMIN_EMAILS: 'admin@example.com' };
    const request = (token?: string) => adminRoute.request('/overview', {
      headers: token ? { Cookie: `session=${token}` } : {},
    }, env as never);
    assert.equal((await request()).status, 401);
    assert.equal((await request(await signSessionToken('member', true, 0, secret))).status, 403);
    assert.equal((await request(await signSessionToken('admin', false, 0, secret))).status, 403);
    const response = await request(await signSessionToken('admin', true, 0, secret));
    assert.equal(response.status, 200);
    const data = await response.json() as { overview: { totalUsers: number; verifiedUsers: number } };
    assert.deepEqual({ totalUsers: data.overview.totalUsers, verifiedUsers: data.overview.verifiedUsers },
      { totalUsers: 2, verifiedUsers: 2 });
  });
});
