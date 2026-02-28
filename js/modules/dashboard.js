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