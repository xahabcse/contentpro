import { DurableObject } from "cloudflare:workers";
import type { Collection, Db, MongoClient } from "mongodb";
import type { Env } from "../env";
import type { NewUserInput, UserDocument, UserRecord, UserUpdateInput } from "../schema";

const DATABASE_NAME = "contentpro";
// One retry after tearing down a dead connection -- covers Atlas-side connection
// recycling / transient network blips (spec 4.2) without looping forever. Only
// the first cold connection (or a reconnect after a genuine failure) pays this
// cost -- getDb() returns the cached db immediately on every subsequent call
// on a warm DO instance, so this doesn't double up on the hot path.
const MAX_ATTEMPTS = 2;

function toUserRecord(doc: UserDocument): UserRecord {
  const { _id, ...rest } = doc;
  return { ...rest, _id: _id ? _id.toHexString() : "" };
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
    const _id = await this.oid(id);
    return this.withDb(async (db) => {
      const doc = await this.users(db).findOne({ _id });
      return doc ? toUserRecord(doc) : null;
    });
  }

  async insertUser(user: NewUserInput): Promise<string> {
    return this.withDb(async (db) => {
      const result = await this.users(db).insertOne(user);
      return result.insertedId.toHexString();
    });
  }

  async updateUser(id: string, update: UserUpdateInput): Promise<void> {
    const _id = await this.oid(id);
    await this.withDb(async (db) => {
      await this.users(db).updateOne({ _id }, { $set: update });
    });
  }
}
