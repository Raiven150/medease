import {
  STORES,
  getAll,
  add,
  getById,
  localDayKey,
  runTransaction,
} from "../core/db.js";
import { showAlert, showConfirm, escapeHtml } from "../core/ui.js";
import { getSettings } from "./settings.js";

let salesDeleteHandlerAttached = false;

function formatMoney(amount) {
  return (amount ?? 0).toFixed(2);
}

export async function renderSales(filter = "") {
  const { currencySymbol: c } = getSettings();
  const tableBody = document.getElementById("sales-table-body");
  tableBody.innerHTML = "";

  const sales = await getAll(STORES.SALES);

  const filtered = sales.filter((sale) => {
    const displayDate = sale.date ? new Date(sale.date).toLocaleString() : "";
    const dateKey = sale.date ? localDayKey(new Date(sale.date)) : "";
    const dateMatches =
      displayDate.toLowerCase().includes(filter.toLowerCase()) ||
      dateKey.toLowerCase().includes(filter.toLowerCase());
    const itemsMatch = (sale.items || []).some((i) =>
      (i.name || "").toLowerCase().includes(filter.toLowerCase()),
    );
    return dateMatches || itemsMatch;
  });

  filtered.forEach((sale) => {
    const displayDate = sale.date ? new Date(sale.date).toLocaleString() : "";
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(sale.id ?? "")}</td>
      <td>${escapeHtml(displayDate)}</td>
      <td>${escapeHtml(
        (sale.items || []).map((i) => `${i.name} (x${i.qty})`).join(", "),
      )}</td>
      <td>${c}${escapeHtml(formatMoney(sale.total))}</td>
      <td>
        <button class="danger-btn delete-sale"
                data-id="${escapeHtml(sale.id)}">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  // Event delegation — attached only once per app session to avoid
  // duplicate handlers accumulating across re-renders.
  if (!salesDeleteHandlerAttached) {
    const tableBodyEl = document.getElementById("sales-table-body");
    if (tableBodyEl) {
      tableBodyEl.addEventListener("click", async (event) => {
        const btn = event.target.closest(".delete-sale");
        if (!btn) return;

        const id = parseInt(btn.dataset.id, 10);
        if (Number.isNaN(id)) return;

        // Read the live search value at click time — not the stale closure
        // value captured when the handler was first attached.
        const currentFilter =
          document.getElementById("search-sales")?.value ?? "";

        showConfirm("Delete this sale record?", async () => {
          const sale = await getById(STORES.SALES, id);
          if (!sale) {
            await renderSales(currentFilter);
            return;
          }

          // Prefetch everything needed BEFORE the transaction so the
          // callback stays fully synchronous — no IDB auto-commit risk.
          const inventory = await getAll(STORES.INVENTORY);

          let profitAdjustment = 0;
          const subtotal = sale.subtotal ?? sale.total;
          const discountRatio =
            subtotal > 0 ? (sale.total ?? subtotal) / subtotal : 1;

          const updatedInventory = [];
          for (const item of sale.items) {
            const inv = inventory.find((i) => i.id === item.id);
            const buyingPrice = inv ? (inv.buyingPrice ?? 0) : 0;
            profitAdjustment +=
              ((item.price ?? 0) - buyingPrice) * item.qty * discountRatio;
            if (inv) {
              updatedInventory.push({ ...inv, stock: inv.stock + item.qty });
            }
          }

          const saleDayKey = localDayKey(new Date(sale.date));
          const profitRecord = await getById(STORES.PROFITS, saleDayKey);
          const updatedProfitRecord =
            profitRecord ?
              {
                ...profitRecord,
                amount: Math.max(0, profitRecord.amount - profitAdjustment),
              }
            : null;

          // Fully synchronous transaction callback — no awaits inside
          await runTransaction(
            [STORES.SALES, STORES.PROFITS, STORES.INVENTORY],
            "readwrite",
            ({ stores }) => {
              stores[STORES.SALES].delete(id);
              if (updatedProfitRecord) {
                stores[STORES.PROFITS].put(updatedProfitRecord);
              }
              for (const inv of updatedInventory) {
                stores[STORES.INVENTORY].put(inv);
              }
            },
          );

          await renderSales(currentFilter);
        });
      });
      salesDeleteHandlerAttached = true;
    }
  }
}

function initSalesExport() {
  document.getElementById("export-sales").onclick = async () => {
    const data = await getAll(STORES.SALES);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sales.json";
    a.click();
    URL.revokeObjectURL(url);
  };
}

function initSalesImport() {
  const importInput = document.getElementById("import-sales");
  document.getElementById("import-sales-btn").onclick = async () => {
    const file = importInput.files[0];
    if (!file) {
      showAlert("Import Error", "Please select a JSON file first.");
      return;
    }
    const data = JSON.parse(await file.text());
    for (const sale of data) {
      delete sale.id;
      await add(STORES.SALES, sale);
    }
    importInput.value = "";
    await renderSales();
  };
}

function initSalesSearch() {
  const searchInput = document.getElementById("search-sales");
  searchInput.addEventListener("input", async () => {
    await renderSales(searchInput.value);
  });
}

export async function initSales() {
  await renderSales();
  initSalesSearch();
  initSalesExport();
  initSalesImport();
}
