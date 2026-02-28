import {
  STORES,
  getAll,
  put,
  add,
  localDayKey,
  runTransaction,
} from "../core/db.js";
import { showAlert } from "../core/ui.js";
import { renderSales } from "./sales.js";
import { renderDashboard } from "./dashboard.js";
import { renderStockInfo, renderInventory } from "./inventory.js";
import {
  populatePosSearch,
  getInventoryCache,
  refreshInventoryCache,
} from "./pos-utils.js";

let cart = [];

function computeTotals() {
  let subtotal = 0;
  cart.forEach((item) => {
    subtotal += item.qty * item.price;
  });
  const discountInputEl = document.getElementById("pos-discount");
  if (!discountInputEl) return; // defensive guard
  const discountInput = discountInputEl.value;
  let discountPercent = parseFloat(discountInput);
  if (isNaN(discountPercent) || discountPercent < 0) discountPercent = 0;
  if (discountPercent > 100) discountPercent = 100;
  const discountAmount = subtotal * (discountPercent / 100);
  const grandTotal = subtotal - discountAmount;
  document.getElementById("pos-subtotal").textContent = subtotal.toFixed(2);
  document.getElementById("pos-discount-amount").textContent =
    discountAmount.toFixed(2);
  document.getElementById("pos-grand-total").textContent =
    grandTotal.toFixed(2);
}

function renderCart() {
  const tableBody = document.getElementById("pos-cart-body");
  tableBody.innerHTML = "";
  cart.forEach((item, index) => {
    const total = item.qty * item.price;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.qty}</td>
      <td>৳${item.price.toFixed(2)}</td>
      <td>৳${total.toFixed(2)}</td>
      <td><button class="danger-btn remove-cart-item" data-index="${index}">Remove</button></td>
    `;
    tableBody.appendChild(row);
  });
  computeTotals();
  document.querySelectorAll(".remove-cart-item").forEach((btn) => {
    btn.onclick = () => {
      const idx = parseInt(btn.dataset.index, 10);
      cart.splice(idx, 1);
      renderCart();
    };
  });
}

export async function initPOS() {
  const addBtn = document.getElementById("pos-add-to-cart");
  const checkoutBtn = document.getElementById("pos-checkout");
  const discountInput = document.getElementById("pos-discount");

  discountInput.addEventListener("input", computeTotals);
  discountInput.addEventListener("change", computeTotals);

  addBtn.onclick = async () => {
    const searchInput = document.getElementById("pos-item-search");
    const qty = parseInt(document.getElementById("pos-qty").value, 10);
    const query = searchInput.value.trim().toLowerCase();
    if (isNaN(qty) || qty <= 0) {
      showAlert("Validation Error", "Please enter a valid quantity.");
      return;
    }

    // Ensure cache is populated before use
    let inventoryCache = getInventoryCache();
    if (!inventoryCache || inventoryCache.length === 0) {
      inventoryCache = await refreshInventoryCache();
    }

    // Prefer exact match first, fallback to substring
    let item =
      inventoryCache.find((i) => (i.name || "").toLowerCase() === query) ||
      inventoryCache.find((i) => (i.name || "").toLowerCase().includes(query));
    if (item) {
      const existingQty = cart
        .filter((c) => c.id === item.id)
        .reduce((sum, c) => sum + c.qty, 0);
      if (qty + existingQty > item.stock) {
        showAlert(
          "Stock Error",
          `Only ${item.stock - existingQty} units available.`,
        );
      } else {
        cart.push({
          id: item.id,
          name: item.name || "",
          qty,
          price: item.sellingPrice ?? 0,
        });
        renderCart();
        searchInput.value = "";
        document.getElementById("pos-qty").value = "";
      }
    } else {
      showAlert(
        "Validation Error",
        "Please select a valid medicine from suggestions.",
      );
    }
  };

  checkoutBtn.onclick = async () => {
    if (cart.length === 0) {
      showAlert("Checkout Error", "Cart is empty.");
      return;
    }
    const subtotal = parseFloat(
      document.getElementById("pos-subtotal").textContent,
    );
    const discountAmount = parseFloat(
      document.getElementById("pos-discount-amount").textContent,
    );
    const grandTotal = parseFloat(
      document.getElementById("pos-grand-total").textContent,
    );

    const saleRecord = {
      date: new Date().toISOString(),
      items: cart,
      subtotal,
      discount: discountAmount,
      total: grandTotal,
    };

    // Profit calculation adjusted for discounts
    let profit = 0;
    const inventory = await getAll(STORES.INVENTORY);
    for (const item of cart) {
      const inv = inventory.find((i) => i.id === item.id);
      const buyingPrice = inv ? (inv.buyingPrice ?? 0) : 0;
      const grossMargin = ((item.price ?? 0) - buyingPrice) * item.qty;
      const discountRatio = subtotal > 0 ? grandTotal / subtotal : 1;
      profit += grossMargin * discountRatio;
    }

    await runTransaction(
      [STORES.SALES, STORES.PROFITS, STORES.INVENTORY],
      "readwrite",
      async ({ stores }) => {
        stores[STORES.SALES].add(saleRecord);

        const todayKey = localDayKey(new Date());
        const profitReq = stores[STORES.PROFITS].get(todayKey);
        const profitRecord = await new Promise((resolve, reject) => {
          profitReq.onsuccess = () => resolve(profitReq.result);
          profitReq.onerror = () => reject(profitReq.error);
        });
        if (profitRecord) {
          profitRecord.amount += profit;
          stores[STORES.PROFITS].put(profitRecord);
        } else {
          stores[STORES.PROFITS].add({ day: todayKey, amount: profit });
        }

        for (const item of cart) {
          const inv = inventory.find((i) => i.id === item.id);
          if (inv) {
            inv.stock = Math.max(0, inv.stock - item.qty);
            stores[STORES.INVENTORY].put(inv);
          }
        }
      },
    );

    await refreshInventoryCache();
    cart = [];
    renderCart();
    document.getElementById("pos-discount").value = 0;
    document.getElementById("pos-item-search").value = "";
    computeTotals();
    await renderSales();
    await renderDashboard();
    await renderStockInfo();
    await populatePosSearch();
    await renderInventory();
    showAlert("Sale Completed", `Grand Total: ৳${grandTotal.toFixed(2)}`);
  };
}
