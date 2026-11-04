// storage.ts - Immortal & Atomic JSON Database Engine
// All model portfolios strictly feature Indian stocks (NSE/BSE)

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
        { ticker: "NSE:SBIN", symbol: "SBIN", name: "State Bank of India", exchange: "NSE", currency: "INR", entryPrice: 979, addedAt: now },
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
        { ticker: "NSE:RELIANCE", symbol: "RELIANCE", name: "Reliance Industries", exchange: "NSE", currency: "INR", entryPrice: 1311, addedAt: now },
        { ticker: "NSE:BHARTIARTL", symbol: "BHARTIARTL", name: "Bharti Airtel", exchange: "NSE", currency: "INR", entryPrice: 2067, addedAt: now },
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
        { ticker: "NSE:ITC", symbol: "ITC", name: "ITC Limited", exchange: "NSE", currency: "INR", entryPrice: 280, addedAt: now },
        { ticker: "NSE:TATASTEEL", symbol: "TATASTEEL", name: "Tata Steel", exchange: "NSE", currency: "INR", entryPrice: 179, addedAt: now },
      ],
    },
    {
      id: "usr_lucas",
      name: "Lucas Silva",
      avatar: "🎯",
      color: "#F59E0B",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:AXISBANK", symbol: "AXISBANK", name: "Axis Bank", exchange: "NSE", currency: "INR", entryPrice: 1232, addedAt: now },
        { ticker: "NSE:TATASTEEL", symbol: "TATASTEEL", name: "Tata Steel", exchange: "NSE", currency: "INR", entryPrice: 179, addedAt: now },
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
        { ticker: "NSE:LT", symbol: "LT", name: "Larsen & Toubro", exchange: "NSE", currency: "INR", entryPrice: 3944, addedAt: now },
        { ticker: "NSE:MARUTI", symbol: "MARUTI", name: "Maruti Suzuki", exchange: "NSE", currency: "INR", entryPrice: 11995, addedAt: now },
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
      id: "usr_elena",
      name: "Elena Rostova",
      avatar: "🦅",
      color: "#38BDF8",
      createdAt: now,
      isLocked: true,
      portfolio: [
        { ticker: "NSE:KOTAKBANK", symbol: "KOTAKBANK", name: "Kotak Mahindra Bank", exchange: "NSE", currency: "INR", entryPrice: 459, addedAt: now },
        { ticker: "NSE:WIPRO", symbol: "WIPRO", name: "Wipro Limited", exchange: "NSE", currency: "INR", entryPrice: 194, addedAt: now },
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
        { ticker: "NSE:SUNPHARMA", symbol: "SUNPHARMA", name: "Sun Pharma", exchange: "NSE", currency: "INR", entryPrice: 1773, addedAt: now },
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

export async function loadState(): Promise<AppState> {
  if (memoryStateCache) {
    return memoryStateCache;
  }

  // 1. Try reading the primary database file
  try {
    const text = await Deno.readTextFile(DB_PATH);
    const data = JSON.parse(text) as AppState;
    if (data && Array.isArray(data.users)) {
      memoryStateCache = data;
      return data;
    }
  } catch (_err) {
    // Primary failed or doesn't exist yet, try backup file
  }

  // 2. Try reading the backup file
  try {
    const backupText = await Deno.readTextFile(DB_BACKUP_PATH);
    const backupData = JSON.parse(backupText) as AppState;
    if (backupData && Array.isArray(backupData.users)) {
      console.log("[RESTORE] Recovered database state from backup file!");
      memoryStateCache = backupData;
      await saveState(backupData);
      return backupData;
    }
  } catch (_err) {
    // Backup failed or doesn't exist
  }

  // 3. First time startup: create initial state and save atomically
  const initialState = getDefaultState();
  memoryStateCache = initialState;
  await saveState(initialState);
  return initialState;
}

export async function saveState(state: AppState): Promise<void> {
  state.lastUpdated = new Date().toISOString();
  memoryStateCache = state;

  try {
    await Deno.mkdir("./data", { recursive: true });
    const jsonString = JSON.stringify(state, null, 2);

    // Write temporary file
    await Deno.writeTextFile(DB_TEMP_PATH, jsonString);

    // Write backup file for fail-safe recovery
    await Deno.writeTextFile(DB_BACKUP_PATH, jsonString);

    // Atomic rename replaces the target file in one indestructible operation
    await Deno.rename(DB_TEMP_PATH, DB_PATH);
  } catch (err) {
    console.error("Critical error saving state atomically:", err);
    try {
      await Deno.writeTextFile(DB_PATH, JSON.stringify(state, null, 2));
    } catch (_fallbackErr) {
      // ignore
    }
  }
}
