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
let adminRoutes: typeof import('../src/routes/admin.ts').default;
let Hono: typeof import('hono').Hono;

before(async () => {
  ({ createGatewayApp } = await import('../src/admin-gateway.ts'));
  ({ default: adminRoutes } = await import('../src/routes/admin.ts'));
  ({ Hono } = await import('hono'));
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

describe('public /api/admin', () => {
  it('ignores X-Admin-Actor: without a session cookie it is still 401', async () => {
    const app = new Hono().route('/api/admin', adminRoutes);
    const res = await app.request('/api/admin/overview', { headers: { 'X-Admin-Actor': 'owner@example.com' } }, env(), ctx);

    assert.equal(res.status, 401);
  });
});
