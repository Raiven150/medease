import {
  STORES,
  getAll,
  getById,
  del,
  localDayKey,
  parseDayKeyToLocalDate,
} from "../core/db.js";
import { showAlert } from "../core/ui.js";
import { getSettings } from "./settings.js";

let clockInterval = null;

function formatMoney(amount) {
  return (amount ?? 0).toFixed(2);
}

// ---------------------------------------------------------------------------
// Tile helpers
// ---------------------------------------------------------------------------

// Sets a currency tile to its value, or "—" if the value is null
// (meaning the computation failed — honest rather than showing ৳0.00)
function setMoneyTile(id, value, currencySymbol) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent =
    value === null ? "—" : `${currencySymbol}${formatMoney(value)}`;
  el.title = value === null ? "Could not load data — please refresh." : "";
}

// Sets a plain count tile, or "—" on failure
function setCountTile(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value === null ? "—" : `${value}`;
  el.title = value === null ? "Could not load data — please refresh." : "";
}

// ---------------------------------------------------------------------------
// Individual computations — return null on failure so tiles show "—"
// instead of a misleading ৳0.00 figure.
// ---------------------------------------------------------------------------
async function computeSalesToday() {
  try {
    const sales = await getAll(STORES.SALES);
    const todayKey = localDayKey(new Date());
    let total = 0;
    for (const s of sales) {
      if (!s.date) continue;
      if (localDayKey(new Date(s.date)) === todayKey) {
        total += Number(s.total) || 0;
      }
    }
    return total;
  } catch (err) {
    console.error("computeSalesToday failed:", err);
    return null;
  }
}

async function computeStockValue() {
  try {
    const inventory = await getAll(STORES.INVENTORY);
    let total = 0;
    for (const item of inventory) {
      total += (Number(item.stock) || 0) * (Number(item.buyingPrice) || 0);
    }
    return total;
  } catch (err) {
    console.error("computeStockValue failed:", err);
    return null;
  }
}

async function computeSuppliersCount() {
  try {
    const suppliers = await getAll(STORES.SUPPLIERS);
    return suppliers.filter((s) => !s.deleted).length;
  } catch (err) {
    console.error("computeSuppliersCount failed:", err);
    return null;
  }
}

async function computeDuesTotal() {
  try {
    const dues = await getAll(STORES.DUES);
    let total = 0;
    for (const d of dues) {
      if ((d.status || "").toLowerCase() !== "paid") {
        total += Number(d.amount) || 0;
      }
    }
    return total;
  } catch (err) {
    console.error("computeDuesTotal failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// renderDashboard
// ---------------------------------------------------------------------------
export async function renderDashboard() {
  try {
    const { currencySymbol: c } = getSettings();
    const now = new Date();
    const todayKey = localDayKey(now);
    const monthAgo = new Date();
    monthAgo.setDate(now.getDate() - 30);

    let todayProfit = null;
    let monthlyProfit = null;

    try {
      const todayRecord = await getById(STORES.PROFITS, todayKey);
      todayProfit = todayRecord ? (todayRecord.amount ?? 0) : 0;

      const profits = await getAll(STORES.PROFITS);
      monthlyProfit = 0;
      for (const p of profits) {
        const pd = parseDayKeyToLocalDate(p.day);
        if (pd >= monthAgo && pd <= now) monthlyProfit += p.amount ?? 0;
      }
    } catch (err) {
      console.error("renderDashboard: profit read failed:", err);
      // todayProfit and monthlyProfit stay null — tiles will show "—"
    }

    const [salesToday, stockValue, suppliersCount, duesTotal] =
      await Promise.all([
        computeSalesToday(),
        computeStockValue(),
        computeSuppliersCount(),
        computeDuesTotal(),
      ]);

    setMoneyTile("dash-sales", salesToday, c);
    setMoneyTile("dash-stock-value", stockValue, c);
    setCountTile("dash-suppliers", suppliersCount);
    setMoneyTile("dash-dues", duesTotal, c);
    setMoneyTile("dashboard-today-profit", todayProfit, c);
    setMoneyTile("dashboard-monthly-profit", monthlyProfit, c);

    const datetimeEl = document.getElementById("dashboard-datetime");
    if (datetimeEl) datetimeEl.textContent = now.toLocaleString();
  } catch (err) {
    console.error("renderDashboard failed:", err);
    showAlert(
      "Dashboard Error",
      "Some dashboard data could not be loaded. Please click Refresh to try again.",
    );
  }
}

// ---------------------------------------------------------------------------
// Clear helpers — both wrapped in try/catch with user-facing error alerts
// ---------------------------------------------------------------------------
async function clearMonthlyProfits() {
  try {
    const profits = await getAll(STORES.PROFITS);
    const now = new Date();
    const monthAgo = new Date();
    monthAgo.setDate(now.getDate() - 30);
    for (const p of profits) {
      const pd = parseDayKeyToLocalDate(p.day);
      if (pd >= monthAgo && pd <= now) await del(STORES.PROFITS, p.day);
    }
    await renderDashboard();
  } catch (err) {
    console.error("clearMonthlyProfits failed:", err);
    showAlert("Error", "Could not clear monthly profits. Please try again.");
  }
}

async function clearTodayProfit() {
  try {
    await del(STORES.PROFITS, localDayKey(new Date()));
    await renderDashboard();
  } catch (err) {
    console.error("clearTodayProfit failed:", err);
    showAlert("Error", "Could not clear today's profit. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// initDashboard
// ---------------------------------------------------------------------------
export async function initDashboard() {
  await renderDashboard();

  // Guard against interval stacking if initDashboard is ever called again
  if (clockInterval !== null) clearInterval(clockInterval);
  clockInterval = setInterval(() => {
    const el = document.getElementById("dashboard-datetime");
    if (el) el.textContent = new Date().toLocaleString();
  }, 1000);

  const refreshBtn = document.getElementById("dashboard-refresh");
  const clearToday = document.getElementById("clear-profit-today");
  const clearMonthly = document.getElementById("clear-profit-monthly");

  if (refreshBtn) refreshBtn.onclick = renderDashboard;
  if (clearToday) clearToday.onclick = clearTodayProfit;
  if (clearMonthly) clearMonthly.onclick = clearMonthlyProfits;
}
