import { DurableObject } from "cloudflare:workers";
import type { Collection, Db, MongoClient } from "mongodb";
import type { Env } from "../env";
import type {
  AuthEventDocument,
  AuthEventRecord,
  NewAuthEventInput,
  NewUserInput,
  UserDocument,
  UserRecord,
  UserUpdateInput,
} from "../schema";

const DATABASE_NAME = "contentpro";
// One retry after tearing down a dead connection -- covers Atlas-side connection
// recycling / transient network blips (spec 4.2) without looping forever. Only
// the first cold connection (or a reconnect after a genuine failure) pays this
// cost -- getDb() returns the cached db immediately on every subsequent call
// on a warm DO instance, so this doesn't double up on the hot path.
const MAX_ATTEMPTS = 2;

// See routes/auth.ts -- RPC preserves Error.message but not custom props, so
// duplicate-key is signalled by throwing an Error with this exact message.
const DUPLICATE_EMAIL_ERROR = "DUPLICATE_EMAIL";

// Atomic rate-limit state, stored under `rl:<key>` in DO storage. Unlike KV,
// the DO serializes all calls and gates storage ops, so get-then-put here is
// truly atomic (no interleaving, no stale/edge-cached reads) -- which KV can't
// provide, and which brute-force throttling (login) actually requires.
const RATE_LIMIT_STORAGE_PREFIX = "rl:";
// DO storage has NO TTL, so `rl:` keys would otherwise accumulate one-per
// distinct email/IP forever. A periodic alarm sweeps expired entries; the
// interval is coarse because these keys are tiny and short-lived.
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1h

interface StoredRateLimit {
  lastSentAt: number; // epoch seconds
  windowStart: number; // epoch seconds
  count: number;
  expiresAt: number; // epoch seconds -- windowStart + windowSeconds, used by the cleanup alarm
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds?: number;
}

function toUserRecord(doc: UserDocument): UserRecord {
  const { _id, ...rest } = doc;
  return { ...rest, _id: _id ? _id.toHexString() : "" };
}

/**
 * Only network/topology/pool/timeout failures are worth tearing down the warm
 * connection and retrying. Logical server errors (duplicate key E11000,
 * validation, etc.) are deterministic -- retrying just wastes a reconnect and
 * loses the original error, so let them propagate immediately.
 */
function isTransientMongoError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name ?? "";
  return /Network|ServerSelection|PoolCleared|Topology|NotConnected|Timeout/i.test(name);
}

function isDuplicateKeyError(err: unknown): boolean {
  return !!err && typeof err === "object" && (err as { code?: number }).code === 11000;
}

/**
 * Wraps a single warm MongoClient connection so every Mongo access in the
 * Worker is routed through one place (spec section 4.2) instead of paying a
 * fresh TCP/TLS handshake per request. v1 sharding decision: a single global
 * DO instance (idFromName("global-mongo-connection")) handles all Mongo
 * access for the whole app -- see the spec for the accepted trade-off and the
 * documented future hash(userId) % N sharding path if it's ever needed.
 *
 * Every method here accepts/returns plain, JSON/RPC-safe values (string ids,
 * not ObjectId instances) because Workers RPC's structured-clone-based wire
 * format is not guaranteed to round-trip driver-specific classes like
 * ObjectId correctly -- converting at this boundary keeps every caller
 * outside this file free of that concern entirely.
 */
export class MongoConnectionDO extends DurableObject<Env> {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private indexesEnsured = false;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  // `mongodb`'s bson dependency runs a top-level random-value initializer
  // (ObjectId's per-process unique bytes) the moment the module is evaluated
  // -- Workers disallows generating random values at global scope, so a
  // static top-level `import ... from "mongodb"` throws "Disallowed
  // operation called within global scope" the instant the Worker boots.
  // Dynamic import() defers module evaluation to first call, which always
  // happens inside a request (or DO method invocation), never at module load.
  private async loadMongo() {
    return import("mongodb");
  }

  // Named connectToMongo (not `connect`) -- DurableObject's base class already
  // declares a `connect(socket: Socket)` method for TCP-socket-backed DOs, and
  // overriding it with an incompatible signature is a compile error.
  private async connectToMongo(): Promise<Db> {
    const { MongoClient } = await this.loadMongo();
    // Minimize handshake chattiness against the Workers subrequest-per-
    // invocation budget: no background topology/heartbeat monitoring, no
    // connection pooling beyond one socket, short server-selection timeout
    // instead of the driver's default (which retries selection internally,
    // each retry costing more subrequests).
    const client = new MongoClient(this.env.MONGODB_URI, {
      maxPoolSize: 1,
      minPoolSize: 0,
      monitorCommands: false,
      serverSelectionTimeoutMS: 8000,
      heartbeatFrequencyMS: 300000,
    } as import("mongodb").MongoClientOptions);
    await client.connect();
    this.client = client;
    this.db = client.db(DATABASE_NAME);
    return this.db;
  }

  private async oid(id: string) {
    const { ObjectId } = await this.loadMongo();
    return new ObjectId(id);
  }

  private async teardown(): Promise<void> {
    try {
      await this.client?.close();
    } catch (err) {
      console.error("Error closing stale Mongo connection", err);
    }
    this.client = null;
    this.db = null;
  }

  private async getDb(): Promise<Db> {
    if (this.db) return this.db;
    const db = await this.connectToMongo();
    if (!this.indexesEnsured) {
      // Unique email lookup for auth. Designs are browser-only now, so there
      // is no designs collection to index.
      await db.collection("users").createIndex({ email: 1 }, { unique: true });
      this.indexesEnsured = true;
    }
    return db;
  }

  private async withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const db = await this.getDb();
        return await fn(db);
      } catch (err) {
        // Logical errors (duplicate key, validation) are deterministic -- don't
        // tear down the warm connection or retry, just surface them.
        if (!isTransientMongoError(err)) throw err;
        lastErr = err;
        console.error(`Mongo operation failed (attempt ${attempt}/${MAX_ATTEMPTS})`, err);
        await this.teardown();
      }
    }
    throw lastErr;
  }

  private users(db: Db): Collection<UserDocument> {
    return db.collection<UserDocument>("users");
  }

  // ---------------------------------------------------------------------
  // users
  // ---------------------------------------------------------------------

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.withDb(async (db) => {
      const doc = await this.users(db).findOne({ email: email.toLowerCase() });
      return doc ? toUserRecord(doc) : null;
    });
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    // A malformed id (not a 24-hex ObjectId) must be a clean miss, not a 500.
    let _id: Awaited<ReturnType<MongoConnectionDO["oid"]>>;
    try {
      _id = await this.oid(id);
    } catch {
      return null;
    }
    return this.withDb(async (db) => {
      const doc = await this.users(db).findOne({ _id });
      return doc ? toUserRecord(doc) : null;
    });
  }

  async insertUser(user: NewUserInput): Promise<string> {
    return this.withDb(async (db) => {
      try {
        const result = await this.users(db).insertOne(user);
        return result.insertedId.toHexString();
      } catch (err) {
        // Map the unique-email-index violation to a stable sentinel the signup
        // route can turn into a 409 (see routes/auth.ts).
        if (isDuplicateKeyError(err)) throw new Error(DUPLICATE_EMAIL_ERROR);
        throw err;
      }
    });
  }

  async updateUser(id: string, update: UserUpdateInput): Promise<void> {
    const _id = await this.oid(id);
    await this.withDb(async (db) => {
      await this.users(db).updateOne({ _id }, { $set: update });
    });
  }

  // ---------------------------------------------------------------------
  // admin: user listing + deletion
  // ---------------------------------------------------------------------

  async listAllUsers(): Promise<UserRecord[]> {
    return this.withDb(async (db) => {
      const docs = await this.users(db).find({}).sort({ createdAt: -1 }).toArray();
      return docs.map(toUserRecord);
    });
  }

  async deleteUserById(id: string): Promise<boolean> {
    const _id = await this.oid(id);
    return this.withDb(async (db) => {
      const result = await this.users(db).deleteOne({ _id });
      return result.deletedCount === 1;
    });
  }

  // ---------------------------------------------------------------------
  // auth_events (best-effort audit trail; read-only via the admin API)
  // ---------------------------------------------------------------------

  async insertAuthEvent(event: NewAuthEventInput): Promise<void> {
    await this.withDb(async (db) => {
      await db.collection<AuthEventDocument>("auth_events").insertOne(event);
    });
  }

  async listAuthEvents(limit: number): Promise<AuthEventRecord[]> {
    return this.withDb(async (db) => {
      const docs = await db
        .collection<AuthEventDocument>("auth_events")
        .find({})
        .sort({ ts: -1 })
        .limit(limit)
        .toArray();
      return docs.map(({ _id, ...rest }) => rest);
    });
  }

  // ---------------------------------------------------------------------
  // atomic rate limiting (security-critical throttles: login/signup/reset)
  //
  // Mirrors the window/cooldown logic in middleware/rate-limit.ts, but backed
  // by DO storage so the get -> compute -> put is atomic. Anti-spam flows
  // (resend-verification / forgot-password) stay on the KV helper -- their
  // 60s cooldown tolerates KV's best-effort eventual consistency, and keeping
  // them off the DO avoids funnelling non-critical traffic through it.
  // ---------------------------------------------------------------------

  async rateLimit(
    key: string,
    maxAttempts: number,
    windowSeconds: number,
    cooldownSeconds = 0,
  ): Promise<RateLimitDecision> {
    const storageKey = `${RATE_LIMIT_STORAGE_PREFIX}${key}`;
    const now = Math.floor(Date.now() / 1000);
    const existing = (await this.ctx.storage.get<StoredRateLimit>(storageKey)) ?? null;

    if (existing && cooldownSeconds > 0 && now - existing.lastSentAt < cooldownSeconds) {
      return { allowed: false, retryAfterSeconds: cooldownSeconds - (now - existing.lastSentAt) };
    }

    let next: StoredRateLimit;
    if (existing && now - existing.windowStart < windowSeconds) {
      if (existing.count >= maxAttempts) {
        return { allowed: false, retryAfterSeconds: existing.windowStart + windowSeconds - now };
      }
      next = {
        lastSentAt: now,
        windowStart: existing.windowStart,
        count: existing.count + 1,
        expiresAt: existing.windowStart + windowSeconds,
      };
    } else {
      next = { lastSentAt: now, windowStart: now, count: 1, expiresAt: now + windowSeconds };
    }

    await this.ctx.storage.put(storageKey, next);
    await this.ensureCleanupAlarm();
    return { allowed: true };
  }

  async resetRateLimit(key: string): Promise<void> {
    await this.ctx.storage.delete(`${RATE_LIMIT_STORAGE_PREFIX}${key}`);
  }

  private async ensureCleanupAlarm(): Promise<void> {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + RATE_LIMIT_CLEANUP_INTERVAL_MS);
    }
  }

  // Sweeps expired `rl:` entries so DO storage doesn't grow unboundedly, and
  // reschedules itself while any live entries remain.
  async alarm(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    const entries = await this.ctx.storage.list<StoredRateLimit>({
      prefix: RATE_LIMIT_STORAGE_PREFIX,
    });
    let remaining = 0;
    for (const [storageKey, state] of entries) {
      if (state.expiresAt <= now) {
        await this.ctx.storage.delete(storageKey);
      } else {
        remaining++;
      }
    }
    if (remaining > 0) {
      await this.ctx.storage.setAlarm(Date.now() + RATE_LIMIT_CLEANUP_INTERVAL_MS);
    }
  }
}
