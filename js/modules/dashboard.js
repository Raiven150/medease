import {
  STORES,
  getAll,
  getById,
  del,
  localDayKey,
  parseDayKeyToLocalDate,
} from "../core/db.js";

function formatMoney(amount) {
  return (amount ?? 0).toFixed(2);
}

/**
 * Compute number of sales that occurred today.
 */
async function computeSalesToday() {
  try {
    const sales = await getAll(STORES.SALES);
    const todayKey = localDayKey(new Date());
    const count = sales.filter((s) => {
      if (!s.date) return false;
      const key = localDayKey(new Date(s.date));
      return key === todayKey;
    }).length;
    return count;
  } catch (err) {
    console.warn("computeSalesToday error:", err);
    return 0;
  }
}

/**
 * Compute total stock value using buyingPrice * stock for each inventory item.
 */
async function computeStockValue() {
  try {
    const inventory = await getAll(STORES.INVENTORY);
    let total = 0;
    for (const item of inventory) {
      const stock = Number(item.stock) || 0;
      const buying = Number(item.buyingPrice) || 0;
      total += stock * buying;
    }
    return total;
  } catch (err) {
    console.warn("computeStockValue error:", err);
    return 0;
  }
}

/**
 * Compute number of suppliers (exclude deleted ones).
 */
async function computeSuppliersCount() {
  try {
    const suppliers = await getAll(STORES.SUPPLIERS);
    const count = suppliers.filter((s) => !s.deleted).length;
    return count;
  } catch (err) {
    console.warn("computeSuppliersCount error:", err);
    return 0;
  }
}

/**
 * Compute total outstanding dues (sum of amounts for non-Paid dues).
 */
async function computeDuesTotal() {
  try {
    const dues = await getAll(STORES.DUES);
    let total = 0;
    for (const d of dues) {
      const status = (d.status || "").toLowerCase();
      const amount = Number(d.amount) || 0;
      if (status !== "paid") {
        total += amount;
      }
    }
    return total;
  } catch (err) {
    console.warn("computeDuesTotal error:", err);
    return 0;
  }
}

export async function renderDashboard() {
  const now = new Date();
  const todayKey = localDayKey(now);
  const monthAgo = new Date();
  monthAgo.setDate(now.getDate() - 30);

  let todayProfit = 0;
  let monthlyProfit = 0;

  const todayRecord = await getById(STORES.PROFITS, todayKey);
  if (todayRecord) {
    todayProfit = todayRecord.amount ?? 0;
  }

  const profits = await getAll(STORES.PROFITS);
  for (const p of profits) {
    const pd = parseDayKeyToLocalDate(p.day);
    if (pd >= monthAgo && pd <= now) {
      monthlyProfit += p.amount ?? 0;
    }
  }

  // New: compute and render other dashboard tiles
  const [salesToday, stockValue, suppliersCount, duesTotal] = await Promise.all(
    [
      computeSalesToday(),
      computeStockValue(),
      computeSuppliersCount(),
      computeDuesTotal(),
    ],
  );

  // Update DOM elements (defensive guards in case elements are missing)
  const elSales = document.getElementById("dash-sales");
  if (elSales) elSales.textContent = `${salesToday}`;

  const elStockValue = document.getElementById("dash-stock-value");
  if (elStockValue) elStockValue.textContent = `৳${formatMoney(stockValue)}`;

  const elSuppliers = document.getElementById("dash-suppliers");
  if (elSuppliers) elSuppliers.textContent = `${suppliersCount}`;

  const elDues = document.getElementById("dash-dues");
  if (elDues) elDues.textContent = `৳${formatMoney(duesTotal)}`;

  document.getElementById("dashboard-today-profit").textContent =
    `৳${formatMoney(todayProfit)}`;
  document.getElementById("dashboard-monthly-profit").textContent =
    `৳${formatMoney(monthlyProfit)}`;
  document.getElementById("dashboard-datetime").textContent =
    now.toLocaleString();
}

async function clearMonthlyProfits() {
  const profits = await getAll(STORES.PROFITS);
  const now = new Date();
  const monthAgo = new Date();
  monthAgo.setDate(now.getDate() - 30);

  for (const p of profits) {
    const pd = parseDayKeyToLocalDate(p.day);
    if (pd >= monthAgo && pd <= now) {
      await del(STORES.PROFITS, p.day);
    }
  }
  await renderDashboard();
}

async function clearTodayProfit() {
  const todayKey = localDayKey(new Date());
  await del(STORES.PROFITS, todayKey);
  await renderDashboard();
}

export async function initDashboard() {
  await renderDashboard();
  setInterval(() => {
    document.getElementById("dashboard-datetime").textContent =
      new Date().toLocaleString();
  }, 60000);

  document.getElementById("clear-profit-monthly").onclick = async () => {
    await clearMonthlyProfits();
  };

  document.getElementById("clear-profit-today").onclick = async () => {
    await clearTodayProfit();
  };

  document.getElementById("dashboard-refresh").onclick = async () => {
    await renderDashboard();
  };
}
