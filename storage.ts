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

export interface AppState {
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

// 100% Indian Stocks (NSE Bluechips)
export function getDefaultUsers(): User[] {
  const now = new Date().toISOString();
  return [
    {
      id: "usr_tribankur",
      name: "Tribankur",
      avatar: "👑",
      color: "#38BDF8",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:HINDZINC", symbol: "HINDZINC", name: "Hindustan Zinc", exchange: "NSE", currency: "INR", entryPrice: 550, addedAt: now },
        { ticker: "NSE:PINELABS", symbol: "PINELABS", name: "Pine Labs", exchange: "NSE", currency: "INR", entryPrice: 157, addedAt: now },
      ],
    },
    {
      id: "usr_deep",
      name: "Deep",
      avatar: "🔥",
      color: "#F59E0B",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:SAIL", symbol: "SAIL", name: "Steel Authority", exchange: "NSE", currency: "INR", entryPrice: 170, addedAt: now },
        { ticker: "NSE:TITAN", symbol: "TITAN", name: "Titan Company", exchange: "NSE", currency: "INR", entryPrice: 4754, addedAt: now },
      ],
    },
    {
      id: "usr_david",
      name: "David Kim",
      avatar: "💎",
      color: "#A855F7",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:BAJFINANCE", symbol: "BAJFINANCE", name: "Bajaj Finance", exchange: "NSE", currency: "INR", entryPrice: 994, addedAt: now },
        { ticker: "NSE:TITAN", symbol: "TITAN", name: "Titan Company", exchange: "NSE", currency: "INR", entryPrice: 4754, addedAt: now },
      ],
    },
    {
      id: "usr_alex",
      name: "Alex Vance",
      avatar: "⚡",
      color: "#38BDF8",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:HDFCBANK", symbol: "HDFCBANK", name: "HDFC Bank", exchange: "NSE", currency: "INR", entryPrice: 736, addedAt: now },
        { ticker: "NSE:ICICIBANK", symbol: "ICICIBANK", name: "ICICI Bank", exchange: "NSE", currency: "INR", entryPrice: 1424, addedAt: now },
      ],
    },
    {
      id: "usr_sam",
      name: "Sam Altman",
      avatar: "🚀",
      color: "#10B981",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:SBIN", symbol: "SBIN", name: "State Bank of India", exchange: "NSE", currency: "INR", entryPrice: 979, addedAt: now },
        { ticker: "NSE:RELIANCE", symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", currency: "INR", entryPrice: 1311, addedAt: now },
      ],
    },
    {
      id: "usr_sophia",
      name: "Sophia Martinez",
      avatar: "🔥",
      color: "#EC4899",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:BHARTIARTL", symbol: "BHARTIARTL", name: "Bharti Airtel", exchange: "NSE", currency: "INR", entryPrice: 2067, addedAt: now },
        { ticker: "NSE:ITC", symbol: "ITC", name: "ITC Limited", exchange: "NSE", currency: "INR", entryPrice: 280, addedAt: now },
      ],
    },
    {
      id: "usr_chen",
      name: "Michael Chen",
      avatar: "🐺",
      color: "#6366F1",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:TATASTEEL", symbol: "TATASTEEL", name: "Tata Steel", exchange: "NSE", currency: "INR", entryPrice: 179, addedAt: now },
        { ticker: "NSE:LT", symbol: "LT", name: "Larsen & Toubro", exchange: "NSE", currency: "INR", entryPrice: 3944, addedAt: now },
      ],
    },
    {
      id: "usr_priya",
      name: "Priya Patel",
      avatar: "👑",
      color: "#14B8A6",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:HDFCBANK", symbol: "HDFCBANK", name: "HDFC Bank", exchange: "NSE", currency: "INR", entryPrice: 736, addedAt: now },
        { ticker: "NSE:RELIANCE", symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", currency: "INR", entryPrice: 1311, addedAt: now },
      ],
    },
    {
      id: "usr_rohan",
      name: "Rohan Sharma",
      avatar: "🦁",
      color: "#F59E0B",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:RELIANCE", symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", currency: "INR", entryPrice: 1311, addedAt: now },
        { ticker: "NSE:INFY", symbol: "INFY", name: "Infosys Limited", exchange: "NSE", currency: "INR", entryPrice: 1128, addedAt: now },
      ],
    },
    {
      id: "usr_liam",
      name: "Liam O'Connor",
      avatar: "🦈",
      color: "#E11D48",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:TCS", symbol: "TCS", name: "Tata Consultancy", exchange: "NSE", currency: "INR", entryPrice: 2436, addedAt: now },
        { ticker: "NSE:MARUTI", symbol: "MARUTI", name: "Maruti Suzuki", exchange: "NSE", currency: "INR", entryPrice: 11995, addedAt: now },
      ],
    },
  ];
}

function getDefaultState(): AppState {
  const today = new Date().toISOString().split("T")[0];
  return {
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
        memoryStateCache = entry.value;
        return entry.value;
      }
    }
  } catch (_kvErr) {
    // KV not available
  }

  // 2. Try primary database file (works locally & in bundle)
  try {
    const text = await Deno.readTextFile(new URL("./data/database.json", import.meta.url));
    const data = JSON.parse(text) as AppState;
    if (data && Array.isArray(data.users)) {
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
      if (data && Array.isArray(data.users)) {
        memoryStateCache = data;
        return data;
      }
    } catch (_fallbackErr) {}
  }

  // 3. Try reading backup file
  try {
    const backupText = await Deno.readTextFile(DB_BACKUP_PATH);
    const backupData = JSON.parse(backupText) as AppState;
    if (backupData && Array.isArray(backupData.users)) {
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
