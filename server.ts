// server.ts - Deno High-Performance TradingView Leaderboard Server
import {
  loadState,
  saveState,
  getRandomAvatar,
  getRandomColor,
  AppState,
  User,
  StockPick,
} from "./storage.ts";
import {
  searchSymbols,
  getQuotesForTickers,
  getTopPerformingIndianStocks,
  StockQuote,
  TopIndianStock,
} from "./tradingview.ts";

const PORT = Number(Deno.env.get("PORT")) || 3000;

// Benchmark indices / prominent assets for the TV Ticker Tape
const TICKER_TAPE_SYMBOLS = [
  "AMEX:SPY",
  "NASDAQ:QQQ",
  "NASDAQ:NVDA",
  "NASDAQ:AAPL",
  "NASDAQ:TSLA",
  "BINANCE:BTCUSDT",
  "BINANCE:ETHUSDT",
  "NSE:RELIANCE",
];

// Helper to calculate a user's portfolio return
export interface UserLeaderboardItem {
  id: string;
  name: string;
  avatar: string;
  color: string;
  isLocked: boolean;
  rank: number;
  portfolioReturn: number; // percentage, e.g. 2.45
  dayPnlValue: number;
  stocks: {
    ticker: string;
    symbol: string;
    name: string;
    exchange: string;
    currency: string;
    entryPrice: number;
    currentPrice: number;
    changePercent: number;
    changeAbs: number;
    high: number;
    low: number;
  }[];
}

async function computeLeaderboard(state: AppState) {
  // Collect all unique tickers from all users' portfolios + ticker tape
  const tickerSet = new Set<string>();
  for (const user of state.users) {
    for (const stock of user.portfolio) {
      if (stock.ticker) tickerSet.add(stock.ticker);
    }
  }
  for (const sym of TICKER_TAPE_SYMBOLS) {
    tickerSet.add(sym);
  }

  // Fetch all live quotes in batched scanner calls
  const quotesMap = await getQuotesForTickers(Array.from(tickerSet));

  // Compute each user's portfolio performance
  const userItems: UserLeaderboardItem[] = state.users.map((user) => {
    if (user.portfolio.length === 0) {
      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        color: user.color,
        isLocked: user.isLocked,
        rank: 999,
        portfolioReturn: 0,
        dayPnlValue: 0,
        stocks: [],
      };
    }

    let totalChangePercent = 0;
    const enrichedStocks = user.portfolio.map((stock) => {
      const q = quotesMap.get(stock.ticker);
      const currentPrice = q ? q.close : stock.entryPrice || 0;
      // Intraday % change from TradingView (or calculated against entry)
      const changePercent = q ? q.change : 0;
      const changeAbs = q ? q.changeAbs : 0;
      totalChangePercent += changePercent;

      return {
        ticker: stock.ticker,
        symbol: stock.symbol,
        name: q?.name || stock.name || stock.symbol,
        exchange: stock.exchange,
        currency: q?.currency || stock.currency || "USD",
        entryPrice: stock.entryPrice || currentPrice,
        currentPrice,
        changePercent,
        changeAbs,
        high: q?.high || currentPrice,
        low: q?.low || currentPrice,
      };
    });

    const avgReturn = enrichedStocks.length > 0 ? totalChangePercent / enrichedStocks.length : 0;

    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      color: user.color,
      isLocked: user.isLocked,
      rank: 1, // temporary, will sort and reassign
      portfolioReturn: parseFloat(avgReturn.toFixed(2)),
      dayPnlValue: 0,
      stocks: enrichedStocks,
    };
  });

  // Sort users descending by portfolio return
  userItems.sort((a, b) => {
    // If one has no stocks, rank lower
    if (a.stocks.length === 0 && b.stocks.length > 0) return 1;
    if (b.stocks.length === 0 && a.stocks.length > 0) return -1;
    return b.portfolioReturn - a.portfolioReturn;
  });

  // Assign ranks
  userItems.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  // Prepare ticker tape items: ONLY Top 5 Performing Indian Stocks from TradingView
  const topIndianStocks = await getTopPerformingIndianStocks(5);
  const tickerTape = topIndianStocks.map((item) => ({
    rank: item.rank,
    ticker: item.ticker,
    symbol: item.symbol,
    name: item.name,
    close: item.close,
    change: item.change,
    currency: "INR",
  }));

  return {
    leaderboard: userItems,
    tickerTape,
  };
}

// MIME Types for static files
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
};

async function handleStaticFile(reqPath: string): Promise<Response> {
  let filePath = reqPath === "/" ? "/index.html" : reqPath;
  const relPath = `./public${filePath}`;

  let file: Uint8Array | null = null;
  try {
    file = await Deno.readFile(relPath);
  } catch (_e1) {
    try {
      file = await Deno.readFile(new URL(relPath, import.meta.url));
    } catch (_e2) {}
  }

  if (file) {
    const ext = filePath.substring(filePath.lastIndexOf("."));
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    return new Response(file as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": contentType },
    });
  }

  // Fallback to index.html for SPA
  try {
    const fallback = await Deno.readFile(new URL("./public/index.html", import.meta.url));
    return new Response(fallback as unknown as BodyInit, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (_fb) {
    try {
      const fallback = await Deno.readFile("./public/index.html");
      return new Response(fallback as unknown as BodyInit, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    } catch (_err) {
      return new Response("Not Found", { status: 404 });
    }
  }
}

async function requestHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const method = req.method;

  // Enable CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // --- API Endpoints ---

  // 1. GET /api/state: Full app state with computed live leaderboard
  if (path === "/api/state" && method === "GET") {
    const state = await loadState();
    const { leaderboard, tickerTape } = await computeLeaderboard(state);

    const responsePayload = {
      mode: state.mode,
      currentDate: state.currentDate,
      lastUpdated: new Date().toISOString(),
      leaderboard,
      users: state.users,
      tickerTape,
      history: state.history,
    };

    return new Response(JSON.stringify(responsePayload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. GET /api/search?q=...: Live TradingView symbol search
  if (path === "/api/search" && method === "GET") {
    const q = url.searchParams.get("q") || "";
    const results = await searchSymbols(q);
    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. GET /api/quotes?symbols=...: Live quotes for arbitrary tickers
  if (path === "/api/quotes" && method === "GET") {
    const symbolsParam = url.searchParams.get("symbols") || "";
    const tickers = symbolsParam.split(",").map((s) => s.trim()).filter(Boolean);
    const quotes = await getQuotesForTickers(tickers);
    const obj = Object.fromEntries(quotes.entries());
    return new Response(JSON.stringify(obj), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. POST /api/users: Create new user (no passwords, instant!)
  if (path === "/api/users" && method === "POST") {
    try {
      const body = await req.json();
      const name = (body.name || "").trim();
      if (!name) {
        return new Response(JSON.stringify({ error: "Name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = await loadState();
      const newUser: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        avatar: body.avatar || getRandomAvatar(),
        color: body.color || getRandomColor(),
        createdAt: new Date().toISOString(),
        portfolio: [],
        isLocked: false,
      };

      state.users.push(newUser);
      await saveState(state);

      return new Response(JSON.stringify({ success: true, user: newUser }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 5. DELETE /api/users/:id: Remove a user
  if (path.startsWith("/api/users/") && method === "DELETE") {
    const userId = path.replace("/api/users/", "");
    const state = await loadState();
    state.users = state.users.filter((u) => u.id !== userId);
    await saveState(state);
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 6. POST /api/portfolio: Update or lock in user's stock picks for today
  if (path === "/api/portfolio" && method === "POST") {
    try {
      const body = await req.json();
      const { userId, tickers, isLocked } = body as {
        userId: string;
        tickers: string[];
        isLocked?: boolean;
      };

      const state = await loadState();
      const user = state.users.find((u) => u.id === userId);
      if (!user) {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch latest prices for these tickers so baseline entry prices are set
      const quotes = await getQuotesForTickers(tickers || []);
      const newPortfolio: StockPick[] = (tickers || []).map((ticker) => {
        const q = quotes.get(ticker);
        const parts = ticker.split(":");
        const exchange = parts.length > 1 ? parts[0] : "";
        const symbol = parts.length > 1 ? parts[1] : parts[0];

        return {
          ticker,
          symbol,
          name: q?.name || symbol,
          exchange: exchange || q?.exchange || "UNKNOWN",
          currency: q?.currency || "USD",
          entryPrice: q?.close || 0,
          addedAt: new Date().toISOString(),
        };
      });

      user.portfolio = newPortfolio;
      if (typeof isLocked === "boolean") {
        user.isLocked = isLocked;
      }
      await saveState(state);

      return new Response(JSON.stringify({ success: true, user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // 7. POST /api/day/toggle: Toggle between LIVE trading and DAY_END results
  if (path === "/api/day/toggle" && method === "POST") {
    const body = await req.json().catch(() => ({}));
    const state = await loadState();

    if (body.mode === "DAY_END" || (body.mode === undefined && state.mode === "LIVE")) {
      state.mode = "DAY_END";
      // Freeze rankings
      const { leaderboard } = await computeLeaderboard(state);
      state.history.unshift({
        date: state.currentDate,
        endedAt: new Date().toISOString(),
        rankings: leaderboard.map((item) => ({
          userId: item.id,
          userName: item.name,
          avatar: item.avatar,
          rank: item.rank,
          returnPercent: item.portfolioReturn,
          stocks: item.stocks.map((s) => s.symbol),
        })),
      });
      // Limit history to 20 days
      if (state.history.length > 20) state.history.pop();
    } else {
      state.mode = "LIVE";
    }

    await saveState(state);
    return new Response(JSON.stringify({ success: true, mode: state.mode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 8. POST /api/day/reset: Start a brand new trading day
  if (path === "/api/day/reset" && method === "POST") {
    const state = await loadState();
    state.mode = "LIVE";
    state.currentDate = new Date().toISOString().split("T")[0];

    // Portfolios REMAIN INTACT FOREVER.
    // Stock picks are never cleared; users keep their chosen portfolios until they decide to modify them.
    for (const u of state.users) {
      u.isLocked = true; // portfolios remain safely locked and active
    }

    await saveState(state);
    console.log(`[DAY RESET] New trading day started: ${state.currentDate}. All ${state.users.length} portfolios preserved intact.`);
    return new Response(JSON.stringify({ success: true, state }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Serve static assets for all other routes
  return handleStaticFile(path);
}

console.log(`=======================================================`);
console.log(`🚀 TradingView Model Portfolio Server Started!`);
console.log(`📍 Local access:      http://localhost:${PORT}`);
console.log(`📺 TV / Network:      http://192.168.1.10:${PORT}`);
console.log(`=======================================================`);

Deno.serve({ port: PORT }, requestHandler);
