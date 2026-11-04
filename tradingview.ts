// tradingview.ts - TradingView Free API Wrapper
// Uses TradingView's free scanner and search APIs with robust fallback and caching

interface TVRawQuote {
  s: string;
  d: (number | string | null)[];
}

export interface StockQuote {
  ticker: string; // e.g. "NASDAQ:NVDA"
  symbol: string; // e.g. "NVDA"
  name: string;   // e.g. "NVIDIA Corporation"
  exchange: string;
  market: string;
  close: number;
  change: number;      // % change
  changeAbs: number;   // absolute change
  open: number;
  high: number;
  low: number;
  volume: number;
  currency: string;
  lastUpdated: string;
}

export interface SearchResult {
  symbol: string;
  description: string;
  exchange: string;
  type: string;
  fullTicker: string; // "EXCHANGE:SYMBOL"
  currency: string;
}

const MARKET_MAP: Record<string, string> = {
  // India
  NSE: "india",
  BSE: "india",
  MCX: "india",
  // Crypto
  BINANCE: "crypto",
  COINBASE: "crypto",
  BYBIT: "crypto",
  BITFINEX: "crypto",
  KRAKEN: "crypto",
  KUCOIN: "crypto",
  // America
  NASDAQ: "america",
  NYSE: "america",
  AMEX: "america",
  ARCA: "america",
  BATS: "america",
  OTC: "america",
  CBOE: "america",
  // Forex
  FX: "forex",
  OANDA: "forex",
  FOREXCOM: "forex",
};

export function getMarketForExchange(exchange: string): string {
  const ex = (exchange || "").toUpperCase();
  return MARKET_MAP[ex] || "america";
}

// In-memory quote cache with 4-second TTL
const quoteCache = new Map<string, { quote: StockQuote; timestamp: number }>();
const CACHE_TTL_MS = 4000;

export async function searchSymbols(query: string): Promise<SearchResult[]> {
  if (!query || query.trim().length === 0) return [];
  const q = encodeURIComponent(query.trim());
  const url = `https://symbol-search.tradingview.com/symbol_search/v3/?text=${q}&hl=1&lang=en&sort_by_country=IN`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: "https://www.tradingview.com",
        Referer: "https://www.tradingview.com/",
      },
    });

    if (!res.ok) {
      console.warn(`TradingView search returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    const list: SearchResult[] = [];

    if (Array.isArray(data.symbols)) {
      // Prioritize Indian stocks on NSE/BSE
      const indianOnly = data.symbols.filter(
        (item: any) => item.exchange === "NSE" || item.exchange === "BSE" || item.currency_code === "INR"
      );
      const candidates = indianOnly.length > 0 ? indianOnly : data.symbols;

      for (const item of candidates) {
        const cleanSymbol = (item.symbol || "").replace(/<[^>]+>/g, "").trim();
        const cleanDesc = (item.description || item.symbol || "").replace(/<[^>]+>/g, "").trim();
        const exchange = (item.exchange || "NSE").trim();
        if (!cleanSymbol) continue;

        const fullTicker = exchange ? `${exchange}:${cleanSymbol}` : `NSE:${cleanSymbol}`;

        list.push({
          symbol: cleanSymbol,
          description: cleanDesc,
          exchange,
          type: item.type || "stock",
          fullTicker,
          currency: item.currency_code || "INR",
        });

        if (list.length >= 12) break; // Snappy top matches
      }
    }

    return list;
  } catch (err) {
    console.error("Error searching TradingView symbols:", err);
    return [];
  }
}

export async function getQuotesForTickers(tickers: string[]): Promise<Map<string, StockQuote>> {
  const result = new Map<string, StockQuote>();
  const toFetch: string[] = [];
  const now = Date.now();

  for (const ticker of tickers) {
    const cached = quoteCache.get(ticker);
    if (cached && now - cached.timestamp < CACHE_TTL_MS) {
      result.set(ticker, cached.quote);
    } else {
      toFetch.push(ticker);
    }
  }

  if (toFetch.length === 0) return result;

  // Group tickers by market region (e.g. america, india, crypto)
  const marketGroups = new Map<string, string[]>();
  for (const ticker of toFetch) {
    const parts = ticker.split(":");
    const exchange = parts.length > 1 ? parts[0] : "";
    const market = getMarketForExchange(exchange);
    if (!marketGroups.has(market)) {
      marketGroups.set(market, []);
    }
    marketGroups.get(market)!.push(ticker);
  }

  // Fetch batches in parallel
  const promises = Array.from(marketGroups.entries()).map(async ([market, marketTickers]) => {
    try {
      const res = await fetch(`https://scanner.tradingview.com/${market}/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        body: JSON.stringify({
          symbols: { tickers: marketTickers },
          columns: [
            "close",
            "change",
            "change_abs",
            "name",
            "description",
            "open",
            "high",
            "low",
            "volume",
            "currency",
          ],
        }),
      });

      if (!res.ok) {
        console.warn(`TradingView scanner (${market}) returned HTTP ${res.status}`);
        return;
      }

      const json = await res.json();
      if (Array.isArray(json.data)) {
        for (const row of json.data as TVRawQuote[]) {
          const t = row.s;
          const d = row.d;
          if (!d) continue;

          const close = typeof d[0] === "number" ? d[0] : 0;
          const change = typeof d[1] === "number" ? d[1] : 0;
          const changeAbs = typeof d[2] === "number" ? d[2] : 0;
          const name = typeof d[3] === "string" ? d[3] : t.split(":")[1] || t;
          const desc = typeof d[4] === "string" ? d[4] : name;
          const open = typeof d[5] === "number" ? d[5] : close;
          const high = typeof d[6] === "number" ? d[6] : close;
          const low = typeof d[7] === "number" ? d[7] : close;
          const volume = typeof d[8] === "number" ? d[8] : 0;
          const currency = typeof d[9] === "string" ? d[9] : "USD";

          const parts = t.split(":");
          const exchange = parts.length > 1 ? parts[0] : "";
          const symbol = parts.length > 1 ? parts[1] : parts[0];

          const quote: StockQuote = {
            ticker: t,
            symbol,
            name: desc || name,
            exchange,
            market,
            close,
            change,
            changeAbs,
            open,
            high,
            low,
            volume,
            currency,
            lastUpdated: new Date().toISOString(),
          };

          quoteCache.set(t, { quote, timestamp: now });
          result.set(t, quote);
        }
      }
    } catch (err) {
      console.error(`Error querying TradingView for market ${market}:`, err);
    }
  });

  await Promise.all(promises);

  // For any ticker that wasn't found in its primary market, attempt a fallback to global
  const missing = toFetch.filter((t) => !result.has(t));
  if (missing.length > 0) {
    try {
      const res = await fetch("https://scanner.tradingview.com/global/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbols: { tickers: missing },
          columns: ["close", "change", "change_abs", "name", "description", "open", "high", "low", "volume", "currency"],
        }),
      });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json.data)) {
          for (const row of json.data as TVRawQuote[]) {
            const t = row.s;
            const d = row.d;
            if (!d) continue;
            const quote: StockQuote = {
              ticker: t,
              symbol: t.split(":")[1] || t,
              name: typeof d[4] === "string" ? d[4] : (typeof d[3] === "string" ? d[3] : t),
              exchange: t.split(":")[0] || "",
              market: "global",
              close: typeof d[0] === "number" ? d[0] : 0,
              change: typeof d[1] === "number" ? d[1] : 0,
              changeAbs: typeof d[2] === "number" ? d[2] : 0,
              open: typeof d[5] === "number" ? d[5] : 0,
              high: typeof d[6] === "number" ? d[6] : 0,
              low: typeof d[7] === "number" ? d[7] : 0,
              volume: typeof d[8] === "number" ? d[8] : 0,
              currency: typeof d[9] === "string" ? d[9] : "USD",
              lastUpdated: new Date().toISOString(),
            };
            quoteCache.set(t, { quote, timestamp: now });
            result.set(t, quote);
          }
        }
      }
    } catch (_err) {
      // ignore
    }
  }

  return result;
}

export interface TopIndianStock {
  rank: number;
  ticker: string;
  symbol: string;
  name: string;
  close: number;
  change: number;
  currency: string;
}

export async function getTopPerformingIndianStocks(limit = 5): Promise<TopIndianStock[]> {
  try {
    const res = await fetch("https://scanner.tradingview.com/india/scan", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        filter: [
          { left: "volume", operation: "greater", right: 100000 },
          { left: "close", operation: "greater", right: 10 },
          { left: "exchange", operation: "equal", right: "NSE" },
          { left: "type", operation: "equal", right: "stock" },
        ],
        sort: { sortBy: "change", sortOrder: "desc" },
        columns: ["name", "description", "close", "change", "change_abs", "volume", "currency"],
        range: [0, limit],
      }),
    });

    if (!res.ok) {
      console.warn(`TradingView India scanner returned HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!Array.isArray(data.data)) return [];

    return data.data.map((item: any, idx: number) => ({
      rank: idx + 1,
      ticker: item.s,
      symbol: item.d[0] || item.s.replace("NSE:", ""),
      name: item.d[1] || item.d[0],
      close: typeof item.d[2] === "number" ? item.d[2] : 0,
      change: typeof item.d[3] === "number" ? item.d[3] : 0,
      currency: "INR",
    }));
  } catch (err) {
    console.error("Error fetching top Indian stocks from TradingView:", err);
    return [];
  }
}

