# Daily Model Portfolio Performance - Live TV Leaderboard 🏆📈

A premium, TV-optimized web application for daily model stock portfolio competitions. Built with real-time data fetched directly from **TradingView's free API**, featuring an automatic live leaderboard, user management without passwords, and day-end podium celebrations.

---

## 🚀 Quick Access

- **On this PC:** [http://localhost:3000](http://localhost:3000)
- **On your Smart TV or Phone (same Wi-Fi):** `http://192.168.1.10:3000`

To start anytime, double-click **`start.bat`** or run:
```bash
deno run --allow-net --allow-read --allow-write server.ts
```

---

## ✨ Features Implemented

### 1. 👤 Easy User Creation (No Passwords)
- Click **"+ Add User"** in the top bar.
- Enter a name, pick an avatar emoji (🦁, 🚀, ⚡, 🐺, 💎, etc.), and click **"Create User"**.
- User profile is saved in `./data/database.json` and persists across sessions and server restarts.

### 2. 🌅 Day's Start: Stock Selection
- Click **"Day's Start: Pick Stocks"**.
- Search any global stock, ETF, or cryptocurrency using the **live TradingView autocomplete search bar** (US stocks like `AAPL`, `NVDA`, `TSLA`; Indian stocks like `RELIANCE`, `TCS`, `INFY`; crypto like `BTCUSDT`, `ETHUSDT`).
- Use **Quick Pick chips** for one-tap selection of market favorites.
- Click **"Lock In Portfolio"** to lock the picks for the day.

### 3. 📊 Live Leaderboard
- Real-time ranking (#1, #2, #3, ...) automatically sorted by daily return percentage.
- Shows individual stock tickers, current prices, and individual percentage changes.
- Live background sync every 5 seconds with a visible heartbeat indicator.
- Scrolling TV Ticker Tape along the top showing major benchmark tickers (`SPY`, `QQQ`, `NVDA`, `BTCUSDT`, `RELIANCE`).

### 4. 🥇 Day's End: 1st, 2nd, and 3rd Podium
- Click **"Day's End: Winners"** to finalize the day.
- Renders an Olympic-style 3D podium:
  - **1st Place:** Gold Champion 👑 with golden aura and laurels.
  - **2nd Place:** Silver Medalist 🥈 with platinum pedestal.
  - **3rd Place:** Bronze Medalist 🥉 with warm bronze pedestal.
- Fires celebration fireworks confetti automatically!
- Full rankings table below for all other participants.
- Easy options to **"Start New Day"** or clear selections for tomorrow's competition.

### 5. 📺 TV & Kiosk Friendly Design + Remote D-Pad Navigation
- **TV Remote Arrow Keys Support:** Full 2D spatial navigation. Use the remote's **Up, Down, Left, and Right** arrows to move smoothly between buttons, podium cards, and leaderboard rows.
- **Enter / OK Button:** Activates any focused option (opens stock selection, toggles settings, etc.).
- **Back / Return / Exit Button:** Closes modals or exits TV mode.
- Deep premium obsidian/slate background (`#07090E` to `#0F1523`) with high-contrast typography readable from 10-20 feet away.
- **Dedicated TV Mode:** Click **"📺 TV Mode"** or press **`F`** / **`T`** to enter fullscreen mode.
- **Properly Placed Exit Buttons:**
  - Floating **"✕ Exit TV Mode (ESC)"** button anchored in the top-right corner.
  - Every modal features top-right **✕** close buttons, **Exit** buttons, and `ESC` key support.
