// app.js - TV & Desktop Real-Time TradingView Leaderboard Frontend

let appState = null;
let currentSelectedUserId = null;
let currentEditingStocks = [];
let searchDebounceTimer = null;
let syncInterval = null;
let isTvMode = false;

// DOM Elements
const tickerTapeTrack = document.getElementById("ticker-tape-track");
const statusPill = document.getElementById("status-pill");
const statusText = document.getElementById("status-text");
const headerDate = document.getElementById("header-date");
const podiumSection = document.getElementById("podium-section");
const podiumStage = document.getElementById("podium-stage");
const podiumHeadingText = document.getElementById("podium-heading-text");
const podiumSubtext = document.getElementById("podium-subtext");
const leaderboardList = document.getElementById("leaderboard-list");
const liveSyncIndicator = document.getElementById("live-sync-indicator");

// Modals
const modalAddUser = document.getElementById("modal-add-user");
const modalPickStocks = document.getElementById("modal-pick-stocks");
const modalDaySettings = document.getElementById("modal-day-settings");
const floatingExitTvBtn = document.getElementById("floating-exit-tv-btn");

// Inputs & Buttons
const btnOpenAddUser = document.getElementById("btn-open-add-user");
const btnOpenPickStocks = document.getElementById("btn-open-pick-stocks");
const btnToggleDayEnd = document.getElementById("btn-toggle-day-end");
const btnToggleTv = document.getElementById("btn-toggle-tv");
const btnSaveNewUser = document.getElementById("btn-save-new-user");
const newUserNameInput = document.getElementById("new-user-name");
const pickUserSelect = document.getElementById("pick-user-select");
const stockSearchInput = document.getElementById("stock-search-input");
const searchDropdown = document.getElementById("search-dropdown");
const selectedStocksContainer = document.getElementById("selected-stocks-container");
const selectedCountBadge = document.getElementById("selected-count");
const btnSavePortfolio = document.getElementById("btn-save-portfolio");
const btnConfirmEndDay = document.getElementById("btn-confirm-end-day");
const btnStartFreshDay = document.getElementById("btn-start-fresh-day");
const btnClearAllPicks = document.getElementById("btn-clear-all-picks");

// 1. Initial Load & Sync Loop
async function fetchState() {
  try {
    const res = await fetch("/api/state");
    if (!res.ok) throw new Error("Network response not ok");
    const data = await res.json();
    appState = data;

    // Fail-safe persistence: cache users and portfolios into browser localStorage
    if (data.users && data.users.length > 0) {
      try {
        localStorage.setItem("ALPHA_DAILY_IMMORTAL_USERS", JSON.stringify(data.users));
      } catch (_e) {}
    }

    renderAll();
    liveSyncIndicator.textContent = "Synced " + new Date().toLocaleTimeString();
  } catch (err) {
    console.error("Error fetching state:", err);
    liveSyncIndicator.textContent = "Reconnecting...";
  }
}

// 2. Render Functions
function renderAll() {
  if (!appState) return;

  // Header date and mode status
  headerDate.textContent = appState.currentDate || new Date().toISOString().split("T")[0];

  if (appState.mode === "DAY_END") {
    statusPill.className = "status-badge day-end";
    statusText.textContent = "DAY END";
    if (podiumHeadingText) podiumHeadingText.textContent = "Winners Podium";
    const btnText = document.getElementById("btn-day-end-text");
    if (btnText) btnText.textContent = "Session";
  } else {
    statusPill.className = "status-badge live";
    statusText.textContent = "LIVE";
    if (podiumHeadingText) podiumHeadingText.textContent = "Podium";
    const btnText = document.getElementById("btn-day-end-text");
    if (btnText) btnText.textContent = "Day's End";
  }

  renderTickerTape();
  renderPodium();
  renderLeaderboard();
  populateUserDropdown();
}

// Live Wall-Clock Time (Minimal)
function updateLiveClock() {
  const now = new Date();
  const timeString = now.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  const topClockEl = document.getElementById("top-live-clock");
  if (topClockEl) topClockEl.textContent = timeString;
}
updateLiveClock();
setInterval(updateLiveClock, 1000);

function renderTickerTape() {
  if (!appState.tickerTape || appState.tickerTape.length === 0) return;

  // Ticker Tape ONLY displays the Top 5 Performing Indian stocks from TradingView
  // Triplicate array for smooth continuous marquee scroll across 1080p/4K TVs
  const items = [...appState.tickerTape, ...appState.tickerTape, ...appState.tickerTape];
  tickerTapeTrack.innerHTML = items
    .map((item, idx) => {
      const isPos = item.change >= 0;
      const sign = isPos ? "+" : "";
      const cls = isPos ? "positive" : "negative";
      const arrow = isPos ? "▲" : "▼";
      const rankNum = item.rank || ((idx % 5) + 1);
      return `
        <div class="ticker-item" title="${item.name} (${item.ticker})">
          <span class="ticker-rank-tag">#${rankNum} NSE</span>
          <span class="ticker-symbol">${item.symbol}</span>
          <span class="ticker-price">₹${item.close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span class="ticker-change ${cls}">${arrow} ${sign}${item.change.toFixed(2)}%</span>
        </div>
      `;
    })
    .join("");
}

function renderPodium() {
  const lb = appState.leaderboard || [];
  if (lb.length === 0) {
    podiumStage.innerHTML = `<p style="color: var(--text-muted); padding: 0.8rem; text-align: center; grid-column: span 3;">No participants yet. Add users to start the leaderboard!</p>`;
    return;
  }

  // Identify top 3 users
  const first = lb[0] || null;
  const second = lb[1] || null;
  const third = lb[2] || null;

  function renderCompactCard(user, rankClass, rankNum, medalIcon, medalTitle) {
    if (!user) {
      return `
        <div class="podium-compact-card ${rankClass}" style="opacity: 0.4;">
          <div class="podium-card-medal">${medalIcon}</div>
          <div class="podium-card-avatar">?</div>
          <div class="podium-card-details">
            <span class="podium-card-name">Open Slot #${rankNum}</span>
          </div>
        </div>
      `;
    }

    const isPos = user.portfolioReturn >= 0;
    const sign = isPos ? "+" : "";
    const retClass = isPos ? "positive" : "negative";
    const arrow = isPos ? "▲" : "▼";

    const stockTags = user.stocks
      .slice(0, 2)
      .map(
        (s) => `
        <span class="podium-stock-tag" title="${s.name}">
          ${s.symbol} <span style="color: ${s.changePercent >= 0 ? '#34d399' : '#f87171'}">${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(1)}%</span>
        </span>
      `
      )
      .join("");

    return `
      <div class="podium-compact-card ${rankClass}" tabindex="0" onclick="openPickStocksModal('${user.id}')" title="${medalTitle}: ${user.name}">
        <div class="podium-card-medal">${medalIcon}</div>
        <div class="podium-card-avatar" style="border-color: ${user.color || 'var(--border-highlight)'};">
          ${user.avatar || '👤'}
        </div>
        <div class="podium-card-details">
          <div class="podium-card-name">${user.name}</div>
          <div class="podium-card-stocks">
            ${stockTags || '<span style="font-size: 0.65rem; color: var(--text-muted);">No picks</span>'}
          </div>
        </div>
        <div class="podium-card-return ${retClass}">
          <span>${arrow}</span>
          <span>${sign}${user.portfolioReturn.toFixed(2)}%</span>
        </div>
      </div>
    `;
  }

  // Classic trio arrangement: 2nd on Left, 1st in Center, 3rd on Right
  podiumStage.innerHTML = `
    ${renderCompactCard(second, "rank-2-card", "2", "🥈", "2nd Place Silver")}
    ${renderCompactCard(first, "rank-1-card", "1", "👑", "1st Place Gold Champion")}
    ${renderCompactCard(third, "rank-3-card", "3", "🥉", "3rd Place Bronze")}
  `;
}

function renderLeaderboard() {
  const lb = appState.leaderboard || [];

  if (lb.length === 0) {
    leaderboardList.innerHTML = `
      <div class="empty-state">
        <p style="font-size: 1.1rem; font-weight: 600; margin-bottom: 0.35rem;">No active participants</p>
        <p style="font-size: 0.85rem; margin-bottom: 1rem;">Click "+ Add User" above to begin.</p>
        <button class="btn btn-primary" onclick="openAddUserModal()">+ Add First User</button>
      </div>
    `;
    return;
  }

  leaderboardList.innerHTML = lb
    .map((user) => {
      const isPos = user.portfolioReturn >= 0;
      const sign = isPos ? "+" : "";
      const retClass = isPos ? "positive" : "negative";
      const arrow = isPos ? "▲" : "▼";

      let rankClass = "";
      if (user.rank === 1) rankClass = "rank-1-row";
      else if (user.rank === 2) rankClass = "rank-2-row";
      else if (user.rank === 3) rankClass = "rank-3-row";

      const stocksHtml =
        user.stocks.length > 0
          ? user.stocks
              .slice(0, 3)
              .map((s) => {
                const sPos = s.changePercent >= 0;
                const sSign = sPos ? "+" : "";
                const sClass = sPos ? "positive" : "negative";
                return `
              <div class="stock-tag" title="${s.name} (${s.exchange})">
                <span class="stock-tag-sym">${s.symbol}</span>
                <span class="stock-tag-change ${sClass}">${sSign}${s.changePercent.toFixed(1)}%</span>
              </div>
            `;
              })
              .join("")
          : `<span style="font-size: 0.72rem; color: var(--text-muted); font-style: italic;">No picks yet</span>`;

      return `
        <div class="leaderboard-row ${rankClass}" tabindex="0" onclick="openPickStocksModal('${user.id}')" title="Click to view/edit stocks for ${user.name}">
          <!-- Left: Rank + Avatar + Name -->
          <div class="row-left-group">
            <div class="rank-badge">#${user.rank}</div>
            <div class="user-avatar-circle" style="border-color: ${user.color || 'transparent'};">
              ${user.avatar || '👤'}
            </div>
            <span class="user-row-name" title="${user.name}">${user.name}</span>
          </div>

          <!-- Middle: Stock Pills -->
          <div class="row-stocks-group">
            ${stocksHtml}
          </div>

          <!-- Right: Return % + Actions -->
          <div class="row-right-group">
            <div class="return-big ${retClass}">
              <span>${arrow}</span>
              <span>${sign}${user.portfolioReturn.toFixed(2)}%</span>
            </div>
            <button class="row-actions-btn" onclick="event.stopPropagation(); openPickStocksModal('${user.id}')" title="Edit Stocks">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9"></path>
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
              </svg>
            </button>
            <button class="row-actions-btn" onclick="event.stopPropagation(); deleteUser('${user.id}', '${user.name}')" title="Delete User">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
      `;
    })
    .join("");
}

function populateUserDropdown() {
  if (!appState || !appState.users) return;
  pickUserSelect.innerHTML = appState.users
    .map(
      (u) => `
      <option value="${u.id}" ${u.id === currentSelectedUserId ? "selected" : ""}>
        ${u.avatar} ${u.name} (${u.portfolio?.length || 0} stocks)
      </option>
    `
    )
    .join("");
}

// 3. User Creation (No passwords, instant)
function openAddUserModal() {
  newUserNameInput.value = "";
  modalAddUser.classList.add("active");
  setTimeout(() => newUserNameInput.focus(), 100);
}

document.querySelectorAll("#avatar-choices .avatar-choice").forEach((el) => {
  el.addEventListener("click", () => {
    document.querySelectorAll("#avatar-choices .avatar-choice").forEach((c) => c.classList.remove("selected"));
    el.classList.add("selected");
  });
});

async function saveNewUser() {
  const name = newUserNameInput.value.trim();
  if (!name) {
    alert("Please enter a participant name");
    return;
  }

  const selectedAvatarEl = document.querySelector("#avatar-choices .avatar-choice.selected");
  const avatar = selectedAvatarEl ? selectedAvatarEl.getAttribute("data-avatar") : "🦁";

  try {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, avatar }),
    });

    if (!res.ok) throw new Error("Failed to create user");
    const data = await res.json();

    closeAllModals();
    await fetchState();

    // Immediately prompt to pick stocks for the new user!
    if (data.user && data.user.id) {
      openPickStocksModal(data.user.id);
    }
  } catch (err) {
    alert("Error creating user: " + err.message);
  }
}

async function deleteUser(userId, userName) {
  if (!confirm(`Are you sure you want to remove participant "${userName}"?`)) return;
  try {
    await fetch(`/api/users/${userId}`, { method: "DELETE" });
    await fetchState();
  } catch (err) {
    alert("Error deleting user: " + err.message);
  }
}

// 4. Day's Start: Stock Selection Workflow
function openPickStocksModal(userId) {
  if (!appState || !appState.users || appState.users.length === 0) {
    openAddUserModal();
    return;
  }

  currentSelectedUserId = userId || (appState.users[0] && appState.users[0].id);
  pickUserSelect.value = currentSelectedUserId;

  const user = appState.users.find((u) => u.id === currentSelectedUserId);
  currentEditingStocks = user && user.portfolio ? [...user.portfolio.map((s) => s.ticker)] : [];

  renderSelectedStocksInModal();
  stockSearchInput.value = "";
  searchDropdown.style.display = "none";
  modalPickStocks.classList.add("active");
}

pickUserSelect.addEventListener("change", (e) => {
  currentSelectedUserId = e.target.value;
  const user = appState.users.find((u) => u.id === currentSelectedUserId);
  currentEditingStocks = user && user.portfolio ? [...user.portfolio.map((s) => s.ticker)] : [];
  renderSelectedStocksInModal();
});

function renderSelectedStocksInModal() {
  selectedCountBadge.textContent = currentEditingStocks.length;

  if (currentEditingStocks.length === 0) {
    selectedStocksContainer.innerHTML = `
      <p style="font-size: 0.85rem; color: var(--text-muted); font-style: italic; padding: 0.5rem 0;">
        No stocks added yet. Search above or pick popular presets.
      </p>
    `;
    return;
  }

  selectedStocksContainer.innerHTML = currentEditingStocks
    .map((ticker, idx) => {
      const parts = ticker.split(":");
      const exchange = parts.length > 1 ? parts[0] : "";
      const sym = parts.length > 1 ? parts[1] : parts[0];

      return `
      <div class="selected-stock-card">
        <div>
          <strong style="color: #fff; font-size: 0.95rem;">${sym}</strong>
          <span style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 0.4rem;">${exchange}</span>
        </div>
        <button class="remove-stock-btn" onclick="removeStockByIndex(${idx})" title="Remove stock">✕</button>
      </div>
    `;
    })
    .join("");
}

window.removeStockByIndex = function (idx) {
  currentEditingStocks.splice(idx, 1);
  renderSelectedStocksInModal();
};

function addTickerToSelection(ticker) {
  if (!currentEditingStocks.includes(ticker)) {
    currentEditingStocks.push(ticker);
    renderSelectedStocksInModal();
  }
  stockSearchInput.value = "";
  searchDropdown.style.display = "none";
}

// TradingView Live Symbol Search
stockSearchInput.addEventListener("input", (e) => {
  clearTimeout(searchDebounceTimer);
  const q = e.target.value.trim();
  if (!q) {
    searchDropdown.style.display = "none";
    return;
  }

  searchDebounceTimer = setTimeout(async () => {
    try {
      searchDropdown.innerHTML = `<div style="padding: 0.75rem; color: var(--text-secondary);">Searching TradingView...</div>`;
      searchDropdown.style.display = "flex";

      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const results = await res.json();

      if (!results || results.length === 0) {
        searchDropdown.innerHTML = `<div style="padding: 0.75rem; color: var(--text-muted);">No symbols found on TradingView</div>`;
        return;
      }

      searchDropdown.innerHTML = results
        .map(
          (r) => `
        <div class="search-item" onclick="addTickerToSelection('${r.fullTicker}')">
          <div class="search-item-info">
            <span class="search-item-sym">
              <span>${r.symbol}</span>
              <span class="search-item-tag">${r.exchange}</span>
              <span class="search-item-tag">${r.currency}</span>
            </span>
            <span class="search-item-desc">${r.description}</span>
          </div>
          <span style="color: var(--cyan); font-weight: bold;">+ Add</span>
        </div>
      `
        )
        .join("");
    } catch (err) {
      console.error(err);
      searchDropdown.style.display = "none";
    }
  }, 250);
});

// Quick preset chips
document.querySelectorAll(".preset-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const ticker = chip.getAttribute("data-ticker");
    if (ticker) addTickerToSelection(ticker);
  });
});

// Save user's portfolio
async function savePortfolio() {
  if (!currentSelectedUserId) return;
  try {
    const res = await fetch("/api/portfolio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentSelectedUserId,
        tickers: currentEditingStocks,
        isLocked: true,
      }),
    });

    if (!res.ok) throw new Error("Failed to save portfolio");
    closeAllModals();
    await fetchState();
  } catch (err) {
    alert("Error updating portfolio: " + err.message);
  }
}

// 5. Day's End, Podium & Confetti Celebration
function triggerConfetti() {
  if (typeof confetti === "function") {
    // 3-burst celebratory fireworks confetti
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ["#ffd700", "#10b981", "#38bdf8"],
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ["#ffd700", "#10b981", "#38bdf8"],
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }
}

async function toggleDayEnd() {
  if (!appState) return;

  if (appState.mode === "LIVE") {
    // Prompt confirmation or switch to Day End
    modalDaySettings.classList.add("active");
  } else {
    // Already in DAY_END, show session modal
    modalDaySettings.classList.add("active");
  }
}

async function executeEndDay() {
  try {
    const res = await fetch("/api/day/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "DAY_END" }),
    });
    if (res.ok) {
      closeAllModals();
      await fetchState();
      triggerConfetti();
    }
  } catch (err) {
    alert(err.message);
  }
}

async function executeStartFreshDay() {
  try {
    const res = await fetch("/api/day/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      closeAllModals();
      await fetchState();
    }
  } catch (err) {
    alert(err.message);
  }
}

// 6. TV Mode & Fullscreen Handling
function enterTvMode() {
  isTvMode = true;
  document.body.classList.add("tv-mode");
  btnToggleTv.innerHTML = `<span>Exit TV</span>`;

  // Request browser fullscreen if possible
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
}

function exitTvMode() {
  isTvMode = false;
  document.body.classList.remove("tv-mode");
  btnToggleTv.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
      <polyline points="17 2 12 7 7 2"></polyline>
    </svg>
    <span>📺 TV Mode</span>
  `;

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

function toggleTvMode() {
  if (isTvMode) {
    exitTvMode();
  } else {
    enterTvMode();
  }
}

// 7. Modal Exit & Keyboard Shortcuts
function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach((m) => m.classList.remove("active"));
  searchDropdown.style.display = "none";
}

document.querySelectorAll("[data-close-modal]").forEach((el) => {
  el.addEventListener("click", closeAllModals);
});

// Close modal on outside backdrop click
document.querySelectorAll(".modal-overlay").forEach((m) => {
  m.addEventListener("click", (e) => {
    if (e.target === m) closeAllModals();
  });
});

// =========================================================
// TV REMOTE 2D SPATIAL D-PAD NAVIGATION ENGINE
// Compatible with: Samsung Tizen, LG webOS, Android TV, Fire TV, PC D-pad
// Keys: ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Enter/OK, Return/Back/ESC
// =========================================================

function getNavigableElements() {
  const activeModal = document.querySelector(".modal-overlay.active");
  const root = activeModal ? activeModal.querySelector(".modal-box") : document;
  if (!root) return [];

  const selector = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex="0"]',
    '.podium-compact-card',
    '.leaderboard-row',
    '.preset-chip',
    '.avatar-choice',
    '.modal-close-btn',
    '#floating-exit-tv-btn'
  ].join(', ');

  const elements = Array.from(root.querySelectorAll(selector));

  return elements.filter((el) => {
    // Only elements that are visible and rendered on screen
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
}

function navigateDirection(dir) {
  const elements = getNavigableElements();
  if (elements.length === 0) return;

  const current = document.activeElement;

  // If currently not on any element or on body, focus the first logical interactive button
  if (!current || !elements.includes(current)) {
    const defaultTarget = document.getElementById("btn-open-pick-stocks") || elements[0];
    setTvFocus(defaultTarget);
    return;
  }

  const curRect = current.getBoundingClientRect();
  const curCenter = {
    x: curRect.left + curRect.width / 2,
    y: curRect.top + curRect.height / 2,
  };

  let bestElement = null;
  let lowestScore = Infinity;

  for (const cand of elements) {
    if (cand === current) continue;
    const candRect = cand.getBoundingClientRect();
    const candCenter = {
      x: candRect.left + candRect.width / 2,
      y: candRect.top + candRect.height / 2,
    };

    const dx = candCenter.x - curCenter.x;
    const dy = candCenter.y - curCenter.y;

    let isMatch = false;
    let mainDist = 0;
    let crossDist = 0;

    switch (dir) {
      case "up":
        if (dy < -6) {
          isMatch = true;
          mainDist = -dy;
          crossDist = Math.abs(dx);
        }
        break;
      case "down":
        if (dy > 6) {
          isMatch = true;
          mainDist = dy;
          crossDist = Math.abs(dx);
        }
        break;
      case "left":
        if (dx < -6) {
          isMatch = true;
          mainDist = -dx;
          crossDist = Math.abs(dy);
        }
        break;
      case "right":
        if (dx > 6) {
          isMatch = true;
          mainDist = dx;
          crossDist = Math.abs(dy);
        }
        break;
    }

    if (isMatch) {
      // 2D spatial heuristic: penalize cross-axis distance so it prefers items directly inline
      const score = mainDist + crossDist * 2.2;
      if (score < lowestScore) {
        lowestScore = score;
        bestElement = cand;
      }
    }
  }

  if (bestElement) {
    setTvFocus(bestElement);
  }
}

function setTvFocus(element) {
  if (!element) return;
  document.querySelectorAll(".tv-nav-focus").forEach((el) => el.classList.remove("tv-nav-focus"));
  element.focus();
  element.classList.add("tv-nav-focus");
  element.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
}

// Global TV Remote Keyboard & D-Pad Handler
window.addEventListener("keydown", (e) => {
  const key = e.key;
  const keyCode = e.keyCode || e.which;

  // 1. Back / Return / Exit (Tizen: 10009, webOS: 461, Standard ESC: 27)
  if (key === "Escape" || keyCode === 10009 || keyCode === 461) {
    const activeModal = document.querySelector(".modal-overlay.active");
    if (activeModal) {
      closeAllModals();
      e.preventDefault();
      return;
    } else if (isTvMode) {
      exitTvMode();
      e.preventDefault();
      return;
    }
  }

  // 2. TV Remote D-Pad Arrows (Up, Down, Left, Right)
  if (key === "ArrowUp" || keyCode === 38) {
    navigateDirection("up");
    e.preventDefault();
    return;
  }
  if (key === "ArrowDown" || keyCode === 40) {
    navigateDirection("down");
    e.preventDefault();
    return;
  }
  if (key === "ArrowLeft" || keyCode === 37) {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
    // Allow typing cursor movement inside text inputs unless at bounds
    if (activeTag !== "input" && activeTag !== "textarea") {
      navigateDirection("left");
      e.preventDefault();
      return;
    }
  }
  if (key === "ArrowRight" || keyCode === 39) {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
    if (activeTag !== "input" && activeTag !== "textarea") {
      navigateDirection("right");
      e.preventDefault();
      return;
    }
  }

  // 3. TV Remote Enter / OK Button (KeyCode 13)
  if (key === "Enter" || keyCode === 13) {
    const active = document.activeElement;
    if (
      active &&
      (active.classList.contains("leaderboard-row") ||
        active.classList.contains("podium-compact-card") ||
        active.classList.contains("preset-chip") ||
        active.classList.contains("avatar-choice"))
    ) {
      active.click();
      e.preventDefault();
      return;
    }
  }

  // 4. Quick Hotkeys ('F' or 'T' for TV Mode toggle)
  const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
  if (activeTag !== "input" && activeTag !== "select" && activeTag !== "textarea") {
    if (key === "f" || key === "F" || key === "t" || key === "T") {
      toggleTvMode();
    }
  }
});

// Handle browser fullscreen state change
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && isTvMode) {
    exitTvMode();
  }
});

// Event Listeners
btnOpenAddUser.addEventListener("click", openAddUserModal);
btnOpenPickStocks.addEventListener("click", () => openPickStocksModal());
btnToggleDayEnd.addEventListener("click", toggleDayEnd);
btnToggleTv.addEventListener("click", toggleTvMode);
floatingExitTvBtn.addEventListener("click", exitTvMode);
btnSaveNewUser.addEventListener("click", saveNewUser);
btnSavePortfolio.addEventListener("click", savePortfolio);
btnConfirmEndDay.addEventListener("click", executeEndDay);
btnStartFreshDay.addEventListener("click", executeStartFreshDay);

// Auto-sync polling every 5 seconds for live TradingView updates
fetchState().then(() => {
  // Set initial TV focus to the primary action button
  setTimeout(() => {
    const initialTarget = document.getElementById("btn-open-pick-stocks");
    if (initialTarget) setTvFocus(initialTarget);
  }, 300);
});
syncInterval = setInterval(fetchState, 5000);
