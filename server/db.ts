import mongoose, { Schema, Document, Model } from "mongoose";
import fs from "fs";
import path from "path";

export interface IUser {
  _id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  bodyWeightKg: number;
  targetReps: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkoutSession {
  _id: string;
  userId: string;
  exercise: string;
  reps: number;
  targetReps: number;
  durationSeconds: number;
  calories: number;
  avgScore: number;
  bestScore: number;
  repScores: number[];
  flagsSummary: {
    valgusDetectedCount: number;
    forwardLeanCount: number;
    shallowDepthCount: number;
    optimalDepthCount: number;
  };
  notes?: string;
  createdAt: Date;
}

export interface DbStatus {
  mode: "mongodb_atlas" | "embedded_store";
  connected: boolean;
  uriConfigured: boolean;
  message: string;
  databaseName?: string;
}

let dbStatus: DbStatus = {
  mode: "embedded_store",
  connected: false,
  uriConfigured: false,
  message: "Initializing database...",
};

export function getDbStatus(): DbStatus {
  return dbStatus;
}

// -------------------------------------------------------------
// Fallback Embedded Store (Active when MONGODB_URI is not set or offline)
// -------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "repform_db.json");

interface LocalData {
  users: IUser[];
  sessions: IWorkoutSession[];
}

function loadLocalData(): LocalData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("[EmbeddedDB] Error reading local data:", err);
  }
  return { users: [], sessions: [] };
}

function saveLocalData(data: LocalData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("[EmbeddedDB] Error saving local data:", err);
  }
}

let localData: LocalData = loadLocalData();

function generateId(): string {
  return "emb_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// -------------------------------------------------------------
// Mongoose Schemas (Used when MONGODB_URI is active)
// -------------------------------------------------------------
const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, default: "Athlete" },
    bodyWeightKg: { type: Number, default: 70 },
    targetReps: { type: Number, default: 15 },
  },
  { timestamps: true }
);

const workoutSessionSchema = new Schema<IWorkoutSession>(
  {
    userId: { type: String, required: true, index: true },
    exercise: { type: String, default: "squat" },
    reps: { type: Number, required: true },
    targetReps: { type: Number, default: 15 },
    durationSeconds: { type: Number, default: 0 },
    calories: { type: Number, default: 0 },
    avgScore: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    repScores: { type: [Number], default: [] },
    flagsSummary: {
      valgusDetectedCount: { type: Number, default: 0 },
      forwardLeanCount: { type: Number, default: 0 },
      shallowDepthCount: { type: Number, default: 0 },
      optimalDepthCount: { type: Number, default: 0 },
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

let MongoUserModel: Model<IUser> | null = null;
let MongoSessionModel: Model<IWorkoutSession> | null = null;

try {
  MongoUserModel = mongoose.models.User || mongoose.model<IUser>("User", userSchema);
  MongoSessionModel = mongoose.models.WorkoutSession || mongoose.model<IWorkoutSession>("WorkoutSession", workoutSessionSchema);
} catch (e) {
  console.warn("Mongoose model registration skipped for now:", e);
}

// -------------------------------------------------------------
// Unified Database Interface
// -------------------------------------------------------------
export const User = {
  async findOne(filter: { email?: string; _id?: string }): Promise<IUser | null> {
    if (dbStatus.mode === "mongodb_atlas" && dbStatus.connected && MongoUserModel) {
      const doc = await MongoUserModel.findOne(filter).lean();
      if (!doc) return null;
      return { ...doc, _id: String(doc._id) } as IUser;
    }

    if (filter.email) {
      const norm = filter.email.toLowerCase().trim();
      return localData.users.find((u) => u.email.toLowerCase() === norm) || null;
    }
    if (filter._id) {
      return localData.users.find((u) => u._id === filter._id) || null;
    }
    return null;
  },

  async findById(id: string): Promise<IUser | null> {
    if (dbStatus.mode === "mongodb_atlas" && dbStatus.connected && MongoUserModel) {
      const doc = await MongoUserModel.findById(id).lean();
      if (!doc) return null;
      return { ...doc, _id: String(doc._id) } as IUser;
    }
    return localData.users.find((u) => u._id === id) || null;
  },

  async create(data: {
    email: string;
    passwordHash: string;
    displayName?: string;
    bodyWeightKg?: number;
    targetReps?: number;
  }): Promise<IUser> {
    if (dbStatus.mode === "mongodb_atlas" && dbStatus.connected && MongoUserModel) {
      const doc = await MongoUserModel.create(data);
      return { ...doc.toObject(), _id: String(doc._id) } as IUser;
    }

    const newUser: IUser = {
      _id: generateId(),
      email: data.email.toLowerCase().trim(),
      passwordHash: data.passwordHash,
      displayName: data.displayName || "Athlete",
      bodyWeightKg: data.bodyWeightKg || 70,
      targetReps: data.targetReps || 15,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    localData.users.push(newUser);
    saveLocalData(localData);
    return newUser;
  },

  async findByIdAndUpdate(
    id: string,
    updates: Partial<Pick<IUser, "displayName" | "bodyWeightKg" | "targetReps">>
  ): Promise<IUser | null> {
    if (dbStatus.mode === "mongodb_atlas" && dbStatus.connected && MongoUserModel) {
      const updated = await MongoUserModel.findByIdAndUpdate(id, updates, { new: true }).lean();
      if (!updated) return null;
      return { ...updated, _id: String(updated._id) } as IUser;
    }

    const idx = localData.users.findIndex((u) => u._id === id);
    if (idx === -1) return null;
    localData.users[idx] = {
      ...localData.users[idx],
      ...updates,
      updatedAt: new Date(),
    };
    saveLocalData(localData);
    return localData.users[idx];
  },
};

export const WorkoutSession = {
  async create(data: Omit<IWorkoutSession, "_id" | "createdAt">): Promise<IWorkoutSession> {
    if (dbStatus.mode === "mongodb_atlas" && dbStatus.connected && MongoSessionModel) {
      const doc = await MongoSessionModel.create(data);
      return { ...doc.toObject(), _id: String(doc._id) } as IWorkoutSession;
    }

    const newSession: IWorkoutSession = {
      _id: generateId(),
      ...data,
      createdAt: new Date(),
    };
    localData.sessions.push(newSession);
    saveLocalData(localData);
    return newSession;
  },

  async find(filter: { userId: string }): Promise<{
    sort(order: { createdAt: number }): {
      limit(n: number): Promise<IWorkoutSession[]>;
      exec(): Promise<IWorkoutSession[]>;
    };
    exec(): Promise<IWorkoutSession[]>;
  }> {
    if (dbStatus.mode === "mongodb_atlas" && dbStatus.connected && MongoSessionModel) {
      return {
        sort(order: { createdAt: number }) {
          return {
            async limit(n: number) {
              const docs = await MongoSessionModel!
                .find({ userId: filter.userId })
                .sort(order as any)
                .limit(n)
                .lean();
              return docs.map((d) => ({ ...d, _id: String(d._id) } as IWorkoutSession));
            },
            async exec() {
              const docs = await MongoSessionModel!
                .find({ userId: filter.userId })
                .sort(order as any)
                .lean();
              return docs.map((d) => ({ ...d, _id: String(d._id) } as IWorkoutSession));
            },
          };
        },
        async exec() {
          const docs = await MongoSessionModel!.find({ userId: filter.userId }).lean();
          return docs.map((d) => ({ ...d, _id: String(d._id) } as IWorkoutSession));
        },
      };
    }

    // Embedded store implementation
    const filtered = localData.sessions.filter((s) => s.userId === filter.userId);

    return {
      sort(order: { createdAt: number }) {
        const sorted = [...filtered].sort((a, b) => {
          const tA = new Date(a.createdAt).getTime();
          const tB = new Date(b.createdAt).getTime();
          return order.createdAt === -1 ? tB - tA : tA - tB;
        });

        return {
          async limit(n: number) {
            return sorted.slice(0, n);
          },
          async exec() {
            return sorted;
          },
        };
      },
      async exec() {
        return filtered;
      },
    };
  },

  async findByIdAndDelete(id: string, userId: string): Promise<boolean> {
    if (dbStatus.mode === "mongodb_atlas" && dbStatus.connected && MongoSessionModel) {
      const res = await MongoSessionModel.deleteOne({ _id: id, userId });
      return (res.deletedCount || 0) > 0;
    }

    const initLen = localData.sessions.length;
    localData.sessions = localData.sessions.filter((s) => !(s._id === id && s.userId === userId));
    const deleted = localData.sessions.length < initLen;
    if (deleted) saveLocalData(localData);
    return deleted;
  },

  async countDocuments(filter: { userId: string }): Promise<number> {
    if (dbStatus.mode === "mongodb_atlas" && dbStatus.connected && MongoSessionModel) {
      return MongoSessionModel.countDocuments(filter);
    }
    return localData.sessions.filter((s) => s.userId === filter.userId).length;
  },
};

// -------------------------------------------------------------
// Database Connection Initializer
// -------------------------------------------------------------
export async function initDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI?.trim();

  if (!mongoUri) {
    dbStatus = {
      mode: "embedded_store",
      connected: true,
      uriConfigured: false,
      message: "Running in embedded MongoDB-compatible mode. Set MONGODB_URI in secrets for MongoDB Atlas.",
    };
    console.log(`[Database] ${dbStatus.message}`);
    return;
  }

  dbStatus.uriConfigured = true;
  try {
    console.log("[Database] Connecting to MongoDB at configured URI...");
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    dbStatus = {
      mode: "mongodb_atlas",
      connected: true,
      uriConfigured: true,
      message: "Successfully connected to MongoDB Atlas.",
      databaseName: mongoose.connection.name,
    };
    console.log(`[Database] Connected to MongoDB database: ${mongoose.connection.name}`);
  } catch (err: any) {
    console.warn(`[Database] Could not connect to remote MongoDB (${err.message}). Falling back to embedded store so server remains operational.`);
    dbStatus = {
      mode: "embedded_store",
      connected: true,
      uriConfigured: true,
      message: `Remote MongoDB unavailable (${err.message}). Operating in resilient embedded fallback mode.`,
    };
  }
}
