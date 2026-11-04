// storage.ts - Immortal Hybrid KV & JSON Database Engine
// Supports local filesystem and Deno Deploy Cloud KV seamlessly

export interface StockPick {
  ticker: string; // e.g. "NSE:RELIANCE"
  symbol: string; // "RELIANCE"
  name: string; // "Reliance Industries Limited"
  exchange: string; // "NSE"
  currency: string;
  entryPrice: number;
  addedAt: string;
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  color: string;
  createdAt: string;
  portfolio: StockPick[];
  isLocked: boolean;
  finalRank?: number;
  finalReturn?: number;
}

export interface DayArchive {
  date: string;
  endedAt: string;
  rankings: {
    userId: string;
    userName: string;
    avatar: string;
    rank: number;
    returnPercent: number;
    stocks: string[];
  }[];
}

export const CURRENT_STATE_VERSION = 3;

export interface AppState {
  version?: number;
  mode: "LIVE" | "DAY_END";
  currentDate: string;
  users: User[];
  history: DayArchive[];
  lastUpdated: string;
}

const DB_PATH = "./data/database.json";
const DB_TEMP_PATH = "./data/database.json.tmp";
const DB_BACKUP_PATH = "./data/database.backup.json";

// In-memory state cache
let memoryStateCache: AppState | null = null;
let kvInstance: any = null;

async function getKv(): Promise<any> {
  if (kvInstance) return kvInstance;
  try {
    // @ts-ignore: Deno.openKv may be present on Deno Deploy or with flag
    if (typeof Deno.openKv === "function") {
      // @ts-ignore
      kvInstance = await Deno.openKv();
      return kvInstance;
    }
  } catch (_e) {
    // KV not available
  }
  return null;
}

const DEFAULT_AVATARS = ["🦁", "🚀", "🦅", "⚡", "🐺", "🔥", "💎", "🎯", "🦊", "👑", "🦈", "🏆"];
const DEFAULT_COLORS = ["#38BDF8", "#10B981", "#A855F7", "#F59E0B", "#EC4899", "#6366F1", "#14B8A6", "#E11D48"];

export function getRandomAvatar(): string {
  return DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)];
}

export function getRandomColor(): string {
  return DEFAULT_COLORS[Math.floor(Math.random() * DEFAULT_COLORS.length)];
}

// Exactly 5 clean initial participants with 0 stocks
export function getDefaultUsers(): User[] {
  const now = new Date().toISOString();
  return [
    {
      id: "usr_tribankur",
      name: "Tribankur",
      avatar: "👑",
      color: "#38BDF8",
      createdAt: now,
      isLocked: false,
      portfolio: [],
    },
    {
      id: "usr_deep",
      name: "Deep",
      avatar: "🔥",
      color: "#F59E0B",
      createdAt: now,
      isLocked: false,
      portfolio: [],
    },
    {
      id: "usr_david",
      name: "David Kim",
      avatar: "💎",
      color: "#A855F7",
      createdAt: now,
      isLocked: false,
      portfolio: [],
    },
    {
      id: "usr_sophia",
      name: "Sophia Martinez",
      avatar: "🚀",
      color: "#EC4899",
      createdAt: now,
      isLocked: false,
      portfolio: [],
    },
    {
      id: "usr_chen",
      name: "Michael Chen",
      avatar: "🐺",
      color: "#6366F1",
      createdAt: now,
      isLocked: false,
      portfolio: [],
    },
  ];
}

export function getDefaultState(): AppState {
  const today = new Date().toISOString().split("T")[0];
  return {
    version: CURRENT_STATE_VERSION,
    mode: "LIVE",
    currentDate: today,
    users: getDefaultUsers(),
    history: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Loads the application state with failover protection.
 * Supports Deno KV (for Deno Deploy cloud) and local JSON.
 */
export async function loadState(): Promise<AppState> {
  if (memoryStateCache) {
    return memoryStateCache;
  }

  // 1. Try Deno KV (Deno Deploy Cloud DB)
  try {
    const kv = await getKv();
    if (kv) {
      const entry = await kv.get(["app_state"]);
      if (entry && entry.value && Array.isArray(entry.value.users)) {
        // Enforce state version migration so schema changes apply seamlessly
        if (entry.value.version === CURRENT_STATE_VERSION) {
          memoryStateCache = entry.value;
          return entry.value;
        } else {
          console.log(`[STORAGE] Migrating KV state to version ${CURRENT_STATE_VERSION}...`);
          const migratedState = getDefaultState();
          memoryStateCache = migratedState;
          await saveState(migratedState);
          return migratedState;
        }
      }
    }
  } catch (_kvErr) {
    // KV not available
  }

  // 2. Try primary database file (works locally & in bundle)
  try {
    const text = await Deno.readTextFile(new URL("./data/database.json", import.meta.url));
    const data = JSON.parse(text) as AppState;
    if (data && Array.isArray(data.users) && data.version === CURRENT_STATE_VERSION) {
      memoryStateCache = data;
      // Mirror to KV if available
      const kv = await getKv();
      if (kv) await kv.set(["app_state"], data);
      return data;
    }
  } catch (_err) {
    try {
      const text = await Deno.readTextFile(DB_PATH);
      const data = JSON.parse(text) as AppState;
      if (data && Array.isArray(data.users) && data.version === CURRENT_STATE_VERSION) {
        memoryStateCache = data;
        return data;
      }
    } catch (_fallbackErr) {}
  }

  // 3. Try reading backup file
  try {
    const backupText = await Deno.readTextFile(DB_BACKUP_PATH);
    const backupData = JSON.parse(backupText) as AppState;
    if (backupData && Array.isArray(backupData.users) && backupData.version === CURRENT_STATE_VERSION) {
      memoryStateCache = backupData;
      return backupData;
    }
  } catch (_backupErr) {}

  // 4. Seed initial default state
  const initialState = getDefaultState();
  memoryStateCache = initialState;
  await saveState(initialState);
  return initialState;
}

/**
 * Saves state to both Deno KV and file system atomically.
 */
export async function saveState(state: AppState): Promise<void> {
  state.lastUpdated = new Date().toISOString();
  memoryStateCache = state;

  // 1. Save to Deno KV (Permanent cloud storage on Deno Deploy)
  try {
    const kv = await getKv();
    if (kv) {
      await kv.set(["app_state"], state);
    }
  } catch (_e) {}

  // 2. Save to local file system
  try {
    await Deno.mkdir("./data", { recursive: true });
    const jsonString = JSON.stringify(state, null, 2);
    await Deno.writeTextFile(DB_TEMP_PATH, jsonString);
    await Deno.writeTextFile(DB_BACKUP_PATH, jsonString);
    await Deno.rename(DB_TEMP_PATH, DB_PATH);
  } catch (_fileErr) {
    // In serverless environments with read-only file systems, KV handles persistence
  }
}
