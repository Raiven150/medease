import {
  STORES,
  getAll,
  getById,
  localDayKey,
  runTransaction,
} from "../core/db.js";
import { showAlert, showReceipt, escapeHtml } from "../core/ui.js";
import { renderSales } from "./sales.js";
import { renderDashboard } from "./dashboard.js";
import { renderStockInfo, renderInventory } from "./inventory.js";
import {
  populatePosSearch,
  getInventoryCache,
  refreshInventoryCache,
} from "./pos-utils.js";
import { getSettings } from "./settings.js";

let cart = [];

// ---------------------------------------------------------------------------
// Receipt generation
// ---------------------------------------------------------------------------
function generateReceiptNumber(date) {
  const d = new Date(date);
  const yy = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yy}${mo}${dd}-${hh}${mm}${ss}`;
}

function buildReceiptHTML(saleRecord, subtotal, discountAmount, grandTotal) {
  const {
    storeName,
    storeAddress,
    storePhone,
    currencySymbol: c,
  } = getSettings();
  const receiptNo = generateReceiptNumber(saleRecord.date);
  const dateStr = new Date(saleRecord.date).toLocaleString();
  const hasDiscount = discountAmount > 0;

  const itemRows = (saleRecord.items || [])
    .map((item) => {
      const lineTotal = (item.qty * item.price).toFixed(2);
      return `
      <tr>
        <td class="receipt-item-name">${escapeHtml(item.name)}</td>
        <td class="receipt-item-qty">${escapeHtml(item.qty)}</td>
        <td class="receipt-item-price">${c}${escapeHtml(item.price.toFixed(2))}</td>
        <td class="receipt-item-total">${c}${escapeHtml(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const discountRow =
    hasDiscount ?
      `
    <tr class="receipt-summary-row">
      <td colspan="2">Discount</td>
      <td colspan="2" class="receipt-amount">- ${c}${escapeHtml(discountAmount.toFixed(2))}</td>
    </tr>`
    : "";

  const addressLine =
    storeAddress ?
      `<p class="receipt-store-address">${escapeHtml(storeAddress)}</p>`
    : "";
  const phoneLine =
    storePhone ?
      `<p class="receipt-store-phone">Tel: ${escapeHtml(storePhone)}</p>`
    : "";

  return `
    <div class="receipt-header">
      <h2 class="receipt-store-name">${escapeHtml(storeName)}</h2>
      ${addressLine}
      ${phoneLine}
    </div>

    <div class="receipt-meta">
      <div class="receipt-meta-row">
        <span>Receipt No.</span>
        <span>${escapeHtml(receiptNo)}</span>
      </div>
      <div class="receipt-meta-row">
        <span>Date</span>
        <span>${escapeHtml(dateStr)}</span>
      </div>
    </div>

    <table class="receipt-items-table">
      <thead>
        <tr>
          <th class="receipt-item-name">Item</th>
          <th class="receipt-item-qty">Qty</th>
          <th class="receipt-item-price">Price</th>
          <th class="receipt-item-total">Total</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>

    <table class="receipt-totals-table">
      <tbody>
        <tr class="receipt-summary-row">
          <td colspan="2">Subtotal</td>
          <td colspan="2" class="receipt-amount">${c}${escapeHtml(subtotal.toFixed(2))}</td>
        </tr>
        ${discountRow}
        <tr class="receipt-grand-total-row">
          <td colspan="2">Grand Total</td>
          <td colspan="2" class="receipt-amount">${c}${escapeHtml(grandTotal.toFixed(2))}</td>
        </tr>
      </tbody>
    </table>

    <div class="receipt-footer">
      <p>Thank you for your purchase!</p>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Currency span helpers
// ---------------------------------------------------------------------------
function updateCurrencySpans() {
  const { currencySymbol: c } = getSettings();
  [
    "pos-currency-subtotal",
    "pos-currency-discount",
    "pos-currency-total",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = c;
  });
}

// ---------------------------------------------------------------------------
// Cart
// ---------------------------------------------------------------------------
function computeTotals() {
  let subtotal = 0;
  cart.forEach((item) => {
    subtotal += item.qty * item.price;
  });

  const discountInputEl = document.getElementById("pos-discount");
  if (!discountInputEl) return;

  let discountPercent = parseFloat(discountInputEl.value);
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
  const { currencySymbol: c } = getSettings();
  const tableBody = document.getElementById("pos-cart-body");
  tableBody.innerHTML = "";

  cart.forEach((item, index) => {
    const total = item.qty * item.price;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(item.name)}</td>
      <td>${escapeHtml(item.qty)}</td>
      <td>${c}${escapeHtml(item.price.toFixed(2))}</td>
      <td>${c}${escapeHtml(total.toFixed(2))}</td>
      <td>
        <button class="danger-btn remove-cart-item"
                data-index="${escapeHtml(index)}">Remove</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  computeTotals();

  document.querySelectorAll(".remove-cart-item").forEach((btn) => {
    btn.onclick = () => {
      cart.splice(parseInt(btn.dataset.index, 10), 1);
      renderCart();
    };
  });
}

// ---------------------------------------------------------------------------
// POS init
// ---------------------------------------------------------------------------
export async function initPOS() {
  const addBtn = document.getElementById("pos-add-to-cart");
  const checkoutBtn = document.getElementById("pos-checkout");
  const discountInput = document.getElementById("pos-discount");

  // Set currency spans on init so they're correct before any interaction
  updateCurrencySpans();

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

    let inventoryCache = getInventoryCache();
    if (!inventoryCache || inventoryCache.length === 0) {
      inventoryCache = await refreshInventoryCache();
    }

    const item =
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

    // Prefetch profit record and build all updated records BEFORE opening
    // the transaction so the callback stays fully synchronous — prevents
    // IDB auto-commit race that could skip stock deductions or profit updates.
    const todayKey = localDayKey(new Date());
    const existingProfitRecord = await getById(STORES.PROFITS, todayKey);
    const updatedProfitRecord =
      existingProfitRecord ?
        {
          ...existingProfitRecord,
          amount: existingProfitRecord.amount + profit,
        }
      : { day: todayKey, amount: profit };

    const updatedInventory = cart
      .map((cartItem) => {
        const inv = inventory.find((i) => i.id === cartItem.id);
        if (!inv) return null;
        return { ...inv, stock: Math.max(0, inv.stock - cartItem.qty) };
      })
      .filter(Boolean);

    // Fully synchronous transaction callback — no awaits inside
    await runTransaction(
      [STORES.SALES, STORES.PROFITS, STORES.INVENTORY],
      "readwrite",
      ({ stores }) => {
        stores[STORES.SALES].add(saleRecord);
        stores[STORES.PROFITS].put(updatedProfitRecord);
        for (const inv of updatedInventory) {
          stores[STORES.INVENTORY].put(inv);
        }
      },
    );

    await refreshInventoryCache();

    // Snapshot cart data for receipt before clearing state
    const completedSale = { ...saleRecord };
    const completedSubtotal = subtotal;
    const completedDiscount = discountAmount;
    const completedTotal = grandTotal;

    // Reset POS state
    cart = [];
    renderCart();
    updateCurrencySpans();
    document.getElementById("pos-discount").value = 0;
    document.getElementById("pos-item-search").value = "";
    computeTotals();

    // Refresh all dependent views in parallel
    await Promise.all([
      renderSales(),
      renderDashboard(),
      renderStockInfo(),
      populatePosSearch(),
      renderInventory(),
    ]);

    // Show receipt — replaces the old plain showAlert("Sale Completed")
    showReceipt(
      buildReceiptHTML(
        completedSale,
        completedSubtotal,
        completedDiscount,
        completedTotal,
      ),
    );
  };
}
