import { DurableObject } from "cloudflare:workers";
import { MongoClient, ObjectId, type Collection, type Db } from "mongodb";
import type { Env } from "../env";
import type {
  DesignDocument,
  DesignFileType,
  DesignRecord,
  DesignUpdateInput,
  NewDesignInput,
  NewUserInput,
  UserDocument,
  UserRecord,
  UserUpdateInput,
} from "../schema";

const DATABASE_NAME = "contentpro";
// One retry after tearing down a dead connection -- covers Atlas-side connection
// recycling / transient network blips (spec 4.2) without looping forever.
const MAX_ATTEMPTS = 2;

function toUserRecord(doc: UserDocument): UserRecord {
  const { _id, ...rest } = doc;
  return { ...rest, _id: _id ? _id.toHexString() : "" };
}

function toDesignRecord(doc: DesignDocument): DesignRecord {
  const { _id, userId, ...rest } = doc;
  return { ...rest, _id: _id ? _id.toHexString() : "", userId: userId.toHexString() };
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

  // Named connectToMongo (not `connect`) -- DurableObject's base class already
  // declares a `connect(socket: Socket)` method for TCP-socket-backed DOs, and
  // overriding it with an incompatible signature is a compile error.
  private async connectToMongo(): Promise<Db> {
    const client = new MongoClient(this.env.MONGODB_URI);
    await client.connect();
    this.client = client;
    this.db = client.db(DATABASE_NAME);
    return this.db;
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
      // Indexes per spec 3.2: unique email lookup, the 5/5 per-type cap query,
      // and the dashboard/gallery listing order.
      await Promise.all([
        db.collection("users").createIndex({ email: 1 }, { unique: true }),
        db.collection("designs").createIndex({ userId: 1, fileType: 1 }),
        db.collection("designs").createIndex({ userId: 1, updatedAt: -1 }),
      ]);
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

  private designsCol(db: Db): Collection<DesignDocument> {
    return db.collection<DesignDocument>("designs");
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
    return this.withDb(async (db) => {
      const doc = await this.users(db).findOne({ _id: new ObjectId(id) });
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
    await this.withDb(async (db) => {
      await this.users(db).updateOne({ _id: new ObjectId(id) }, { $set: update });
    });
  }

  // ---------------------------------------------------------------------
  // designs
  // ---------------------------------------------------------------------

  async findDesign(id: string): Promise<DesignRecord | null> {
    return this.withDb(async (db) => {
      const doc = await this.designsCol(db).findOne({ _id: new ObjectId(id) });
      return doc ? toDesignRecord(doc) : null;
    });
  }

  async listDesignsForUser(userId: string): Promise<DesignRecord[]> {
    return this.withDb(async (db) => {
      const docs = await this.designsCol(db)
        .find({ userId: new ObjectId(userId) })
        .sort({ updatedAt: -1 })
        .toArray();
      return docs.map(toDesignRecord);
    });
  }

  async insertDesign(design: NewDesignInput): Promise<string> {
    return this.withDb(async (db) => {
      const { userId, ...rest } = design;
      const result = await this.designsCol(db).insertOne({
        ...rest,
        userId: new ObjectId(userId),
      });
      return result.insertedId.toHexString();
    });
  }

  async updateDesign(id: string, update: DesignUpdateInput): Promise<void> {
    await this.withDb(async (db) => {
      await this.designsCol(db).updateOne({ _id: new ObjectId(id) }, { $set: update });
    });
  }

  async deleteDesign(id: string): Promise<void> {
    await this.withDb(async (db) => {
      await this.designsCol(db).deleteOne({ _id: new ObjectId(id) });
    });
  }

  async countDesignsByType(userId: string, fileType: DesignFileType): Promise<number> {
    return this.withDb(async (db) => {
      return this.designsCol(db).countDocuments({ userId: new ObjectId(userId), fileType });
    });
  }
}
