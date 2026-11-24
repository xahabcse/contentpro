import { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { extname } from 'node:path';
import { afterEach, before, describe, it } from 'node:test';

// Node's strip-types runner does not resolve the extensionless imports used by
// the Cloudflare bundle; this hook adds .ts only for local modules.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !extname(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

type SqlValue = string | number | bigint | null | Uint8Array;

const MIGRATIONS = new URL('../migrations/', import.meta.url);
const openDatabases: DatabaseSync[] = [];

afterEach(() => {
  for (const db of openDatabases.splice(0)) db.close();
});

function toSql(value: unknown): SqlValue {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number' || typeof value === 'string' || typeof value === 'bigint' || value instanceof Uint8Array) return value;
  return String(value);
}

// D1 stand-in on an in-memory SQLite built from the real migrations.
function localD1() {
  const sqlite = new DatabaseSync(':memory:');
  openDatabases.push(sqlite);
  for (const file of readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    sqlite.exec(readFileSync(new URL(file, MIGRATIONS), 'utf8'));
  }
  const statement = (sql: string, params: SqlValue[] = []): unknown => ({
    bind: (...values: unknown[]) => statement(sql, values.map(toSql)),
    first: async (column?: string) => {
      const row = sqlite.prepare(sql).get(...params) as Record<string, unknown> | undefined;
      if (!row) return null;
      return column ? row[column] : { ...row };
    },
    all: async () => ({ results: (sqlite.prepare(sql).all(...params) as Record<string, unknown>[]).map((row) => ({ ...row })), success: true, meta: {} }),
    run: async () => {
      const result = sqlite.prepare(sql).run(...params);
      return { results: [], success: true, meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
    },
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: { run: () => Promise<unknown> }[]) => Promise.all(statements.map((s) => s.run())),
  };
  const insert = sqlite.prepare(
    `INSERT INTO users (id, email, password_hash, password_salt, password_iterations, email_verified, created_at, updated_at)
     VALUES (?, ?, 'h', 's', 100000, ?, 1, 1)`,
  );
  insert.run('owner', 'owner@example.com', 1);
  insert.run('pending', 'pending@example.com', 0);
  insert.run('member', 'member@example.com', 1);
  return db as unknown as D1Database;
}

let createGatewayApp: typeof import('../src/admin-gateway.ts').createGatewayApp;
let createPublicApp: typeof import('../src/app.ts').createPublicApp;

before(async () => {
  ({ createGatewayApp } = await import('../src/admin-gateway.ts'));
  ({ createPublicApp } = await import('../src/app.ts'));
});

function env() {
  // owner and pending are both allowlisted; only owner has a verified mailbox.
  return { DB: localD1(), ADMIN_EMAILS: 'owner@example.com, pending@example.com', JWT_SECRET: 'test-secret' };
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;

async function viaGateway(path: string, actor?: string) {
  const headers: Record<string, string> = actor === undefined ? {} : { 'X-Admin-Actor': actor };
  return createGatewayApp().request(path, { headers }, env(), ctx);
}

describe('AdminGateway', () => {
  it('runs an admin route as the named actor without a session cookie', async () => {
    const res = await viaGateway('/api/admin/overview', 'Owner@Example.com');

    assert.equal(res.status, 200);
  });

  it('reports the actor as admin on /me', async () => {
    const res = await viaGateway('/api/admin/me', 'owner@example.com');

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { isAdmin: true });
  });

  it('refuses a request that names no actor', async () => {
    const res = await viaGateway('/api/admin/overview');

    assert.equal(res.status, 403);
  });

  it('refuses an actor with no Cardstock account', async () => {
    const res = await viaGateway('/api/admin/overview', 'stranger@example.com');

    assert.equal(res.status, 403);
  });

  it('refuses an allowlisted account whose mailbox is not verified', async () => {
    const res = await viaGateway('/api/admin/overview', 'pending@example.com');

    assert.equal(res.status, 403);
  });

  it('refuses a verified account that is not on ADMIN_EMAILS', async () => {
    const res = await viaGateway('/api/admin/overview', 'member@example.com');

    assert.equal(res.status, 403);
  });
});

describe('Cleanup', () => {
  type Images = { removed: string[]; fail: boolean };

  function cleanupEnv(images: Images) {
    const bucket = {
      delete: async (keys: string | string[]) => {
        if (images.fail) throw new Error('R2 down');
        images.removed.push(...(Array.isArray(keys) ? keys : [keys]));
      },
    };
    return { ...env(), PROFILE_IMAGES: bucket };
  }

  async function asAdmin(e: ReturnType<typeof cleanupEnv>, method: string, path: string, body?: unknown) {
    const headers: Record<string, string> = { 'X-Admin-Actor': 'owner@example.com' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    return createGatewayApp().request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, e, ctx);
  }

  it('keeps a deleted account with status 404: off the admin list, unable to sign in, and listed in Cleanup', async () => {
    const e = cleanupEnv({ removed: [], fail: false });
    const { findUserById, findUserByEmail } = await import('../src/lib/db.ts');

    assert.equal((await asAdmin(e, 'DELETE', '/api/admin/users/member')).status, 200);

    const users = (await (await asAdmin(e, 'GET', '/api/admin/users')).json()) as { users: { id: string }[] };
    assert.equal(users.users.some((user) => user.id === 'member'), false);
    assert.equal(await findUserById(e.DB, 'member'), null);
    assert.equal(await findUserByEmail(e.DB, 'member@example.com'), null);
    assert.deepEqual(await (await asAdmin(e, 'GET', '/api/admin/cleanup/summary')).json(), { kinds: { user: 1 }, groups: { people: 1 } });
    const items = (await (await asAdmin(e, 'GET', '/api/admin/cleanup/items?group=people')).json()) as { items: { kind: string; id: string; detail: string }[]; total: number };
    assert.equal(items.total, 1);
    assert.deepEqual([items.items[0].kind, items.items[0].id, items.items[0].detail], ['user', 'member', 'Account · member@example.com']);
  });

  it('restores an account, whose old sessions stay ended', async () => {
    const e = cleanupEnv({ removed: [], fail: false });
    const { findUserById } = await import('../src/lib/db.ts');
    await asAdmin(e, 'DELETE', '/api/admin/users/member');

    assert.equal((await asAdmin(e, 'POST', '/api/admin/cleanup/user/member/restore')).status, 200);
    const back = await findUserById(e.DB, 'member');
    assert.equal(back?.email, 'member@example.com');
    assert.equal(back?.sessionVersion, 1);
    assert.equal((await asAdmin(e, 'POST', '/api/admin/cleanup/user/member/restore')).status, 404);
  });

  it('deletes an account for good with its profile images, and keeps it when R2 refuses', async () => {
    const images = { removed: [] as string[], fail: true };
    const e = cleanupEnv(images);
    await asAdmin(e, 'DELETE', '/api/admin/users/member');

    const refused = (await (await asAdmin(e, 'POST', '/api/admin/cleanup/purge', { group: 'people' })).json()) as { removed: { user: number }; kept: string[] };
    assert.deepEqual(refused.removed, { user: 0 });
    assert.equal(refused.kept.length, 1);

    images.fail = false;
    const done = (await (await asAdmin(e, 'POST', '/api/admin/cleanup/user/member/purge')).json()) as { removed: { user: number }; kept: string[] };
    assert.deepEqual(done, { removed: { user: 1 }, kept: [] });
    assert.equal(images.removed.length, 2);
    assert.ok(images.removed.every((key) => key.includes('member')));
    assert.deepEqual(await (await asAdmin(e, 'GET', '/api/admin/cleanup/summary')).json(), { kinds: { user: 0 }, groups: { people: 0 } });
  });

  it('still refuses to delete an admin account', async () => {
    const e = cleanupEnv({ removed: [], fail: false });

    assert.equal((await asAdmin(e, 'DELETE', '/api/admin/users/owner')).status, 400);
  });

  it('counts security-log rows past 7, 14 and 30 days and clears only the older ones', async () => {
    const e = cleanupEnv({ removed: [], fail: false });
    const day = 24 * 60 * 60 * 1000;
    for (const days of [40, 20, 10, 1]) {
      await e.DB.prepare("INSERT INTO auth_events (ts, type) VALUES (?, 'login')").bind(Date.now() - days * day).run();
    }

    const before = (await (await asAdmin(e, 'GET', '/api/admin/cleanup/logs')).json()) as { logs: { auth: { olderThan: Record<string, number> } } };
    assert.deepEqual(before.logs.auth.olderThan, { 7: 3, 14: 2, 30: 1 });
    assert.equal((await asAdmin(e, 'POST', '/api/admin/cleanup/logs/auth/purge', { days: 9 })).status, 400);
    assert.deepEqual(await (await asAdmin(e, 'POST', '/api/admin/cleanup/logs/auth/purge', { days: 14 })).json(), { removed: 2, more: false });
  });

  it('is not on the public app', async () => {
    const res = await createPublicApp().request('/api/admin/cleanup/summary', { headers: { 'X-Admin-Actor': 'owner@example.com' } }, env(), ctx);

    assert.equal(res.status, 404);
  });
});

describe('public app', () => {
  it('has no /api/admin: the admin is reachable only through the gateway', async () => {
    const app = createPublicApp();

    for (const path of ['/api/admin/me', '/api/admin/overview', '/api/admin/users', '/api/admin/logs']) {
      const res = await app.request(path, { headers: { 'X-Admin-Actor': 'owner@example.com' } }, env(), ctx);
      assert.equal(res.status, 404, path);
    }

    const removal = await app.request('/api/admin/users/member', { method: 'DELETE', headers: { 'X-Admin-Actor': 'owner@example.com' } }, env(), ctx);
    assert.equal(removal.status, 404);
  });

  it('still serves the rest of the API', async () => {
    const app = createPublicApp();

    const health = await app.request('/', {}, env(), ctx);
    const profile = await app.request('/api/profile', {}, env(), ctx);

    assert.equal(health.status, 200);
    assert.equal(profile.status, 401);
  });
});
