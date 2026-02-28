import {
  STORES,
  getAll,
  add,
  del,
  put,
  getById,
  localDayKey,
  runTransaction,
} from "../core/db.js";
import { showAlert, showConfirm } from "../core/ui.js";

function formatMoney(amount) {
  return (amount ?? 0).toFixed(2);
}

export async function renderSales(filter = "") {
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
      <td>${sale.id ?? ""}</td>
      <td>${displayDate}</td>
      <td>${(sale.items || [])
        .map((i) => `${i.name} (x${i.qty})`)
        .join(", ")}</td>
      <td>৳${formatMoney(sale.total)}</td>
      <td>
        <button class="danger-btn delete-sale" data-id="${sale.id}">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll(".delete-sale").forEach((btn) => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id, 10);
      showConfirm("Delete this sale record?", async () => {
        const sale = await getById(STORES.SALES, id);
        if (!sale) {
          await renderSales(filter);
          return;
        }

        // Perform deletion atomically
        await runTransaction(
          [STORES.SALES, STORES.PROFITS, STORES.INVENTORY],
          "readwrite",
          async ({ stores }) => {
            const inventory = await getAll(STORES.INVENTORY);
            let profitAdjustment = 0;
            const subtotal = sale.subtotal ?? sale.total;
            const discountRatio =
              subtotal > 0 ? (sale.total ?? subtotal) / subtotal : 1;

            for (const item of sale.items) {
              const inv = inventory.find((i) => i.id === item.id);
              const buyingPrice = inv ? (inv.buyingPrice ?? 0) : 0;
              const grossMargin = ((item.price ?? 0) - buyingPrice) * item.qty;
              profitAdjustment += grossMargin * discountRatio;
              if (inv) {
                inv.stock += item.qty;
                stores[STORES.INVENTORY].put(inv);
              }
            }

            const todayKey = localDayKey(new Date(sale.date));
            const profitReq = stores[STORES.PROFITS].get(todayKey);
            const profitRecord = await new Promise((resolve, reject) => {
              profitReq.onsuccess = () => resolve(profitReq.result);
              profitReq.onerror = () => reject(profitReq.error);
            });
            if (profitRecord) {
              profitRecord.amount = Math.max(
                0,
                profitRecord.amount - profitAdjustment,
              );
              stores[STORES.PROFITS].put(profitRecord);
            }

            stores[STORES.SALES].delete(id);
          },
        );

        await renderSales(filter);
      });
    };
  });
}

function initSalesExport() {
  const exportBtn = document.getElementById("export-sales");
  exportBtn.onclick = async () => {
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
  const importBtn = document.getElementById("import-sales-btn");
  importBtn.onclick = async () => {
    const file = importInput.files[0];
    if (!file) {
      showAlert("Import Error", "Please select a JSON file first.");
      return;
    }
    const text = await file.text();
    const data = JSON.parse(text);
    for (const sale of data) {
      delete sale.id;
      await add(STORES.SALES, sale);
    }
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