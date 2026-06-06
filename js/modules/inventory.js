import { STORES, getAll, add, put, del, getById } from "../core/db.js";
import { showAlert, showConfirm, showEdit, escapeHtml } from "../core/ui.js";
import { populatePosSearch } from "./pos-utils.js";
import { getSettings } from "./settings.js";

function normalizeInventoryItem(item) {
  item.stock = parseInt(item.stock, 10) || 0;
  item.buyingPrice = parseFloat(item.buyingPrice) || 0;
  item.sellingPrice = parseFloat(item.sellingPrice) || 0;
  item.supplierId = parseInt(item.supplierId, 10);
  return item;
}

export async function renderInventory(filter = "") {
  const { currencySymbol: c } = getSettings();
  const tableBody = document.getElementById("inventory-table-body");
  tableBody.innerHTML = "";

  (await getAll(STORES.INVENTORY))
    .filter(
      (t) =>
        (t.name || "").toLowerCase().includes(filter.toLowerCase()) ||
        (t.supplierName || "").toLowerCase().includes(filter.toLowerCase()) ||
        (t.stock?.toString() || "").includes(filter) ||
        (t.batchNumber || "").toLowerCase().includes(filter.toLowerCase()) ||
        (t.expiryDate || "").toLowerCase().includes(filter.toLowerCase()),
    )
    .forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.supplierName)}</td>
        <td>${escapeHtml(item.stock ?? 0)}</td>
        <td>${c}${escapeHtml((item.buyingPrice ?? 0).toFixed(2))}</td>
        <td>${c}${escapeHtml((item.sellingPrice ?? 0).toFixed(2))}</td>
        <td>${escapeHtml(item.batchNumber)}</td>
        <td>${escapeHtml(item.expiryDate)}</td>
        <td>
          <button class="secondary-btn edit-inventory"  data-id="${escapeHtml(item.id)}">Edit</button>
          <button class="danger-btn   delete-inventory" data-id="${escapeHtml(item.id)}">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

  document.querySelectorAll(".edit-inventory").forEach((btn) => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id, 10);
      const inv = await getById(STORES.INVENTORY, id);
      if (!inv) return;

      // Fetch suppliers BEFORE showEdit so the dropdown is ready to inject
      // the moment the modal DOM exists — no fragile post-render query needed
      const suppliers = (await getAll(STORES.SUPPLIERS)).filter(
        (s) => !s.deleted,
      );
      const supplierOptions = suppliers
        .map(
          (s) =>
            `<option value="${escapeHtml(s.id)}" ${s.id === inv.supplierId ? "selected" : ""}>${escapeHtml(s.companyName)}</option>`,
        )
        .join("");

      const html = `
        <div class="form-group">
          <label for="edit-inv-name">Item Name</label>
          <input type="text" id="edit-inv-name" value="${escapeHtml(inv.name)}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-supplier">Manufacturer</label>
          <select id="edit-inv-supplier">${supplierOptions}</select>
        </div>
        <div class="form-group">
          <label for="edit-inv-stock">Stock</label>
          <input type="number" id="edit-inv-stock" value="${escapeHtml(inv.stock ?? 0)}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-buying">Buying Price</label>
          <input type="number" step="0.01" id="edit-inv-buying" value="${escapeHtml(inv.buyingPrice ?? 0)}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-selling">Selling Price</label>
          <input type="number" step="0.01" id="edit-inv-selling" value="${escapeHtml(inv.sellingPrice ?? 0)}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-batch">Batch Number</label>
          <input type="text" id="edit-inv-batch" value="${escapeHtml(inv.batchNumber)}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-expiry">Expiry Date</label>
          <input type="date" id="edit-inv-expiry" value="${escapeHtml(inv.expiryDate)}" />
        </div>
      `;

      showEdit(html, "Edit Inventory Item", async () => {
        inv.name = document.getElementById("edit-inv-name").value.trim();
        const supplierId = parseInt(
          document.getElementById("edit-inv-supplier").value,
          10,
        );
        const supplier = suppliers.find((s) => s.id === supplierId);
        inv.supplierId = supplierId;
        inv.supplierName = supplier ? supplier.companyName : "";
        inv.stock =
          parseInt(document.getElementById("edit-inv-stock").value, 10) || 0;
        inv.buyingPrice =
          parseFloat(document.getElementById("edit-inv-buying").value) || 0;
        inv.sellingPrice =
          parseFloat(document.getElementById("edit-inv-selling").value) || 0;
        inv.batchNumber = document
          .getElementById("edit-inv-batch")
          .value.trim();
        inv.expiryDate = document.getElementById("edit-inv-expiry").value;
        await put(STORES.INVENTORY, inv);
        await renderInventory(filter);
        await renderStockInfo();
        await populatePosSearch();
      });
    };
  });

  document.querySelectorAll(".delete-inventory").forEach((btn) => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id, 10);
      showConfirm("Delete this item?", async () => {
        await del(STORES.INVENTORY, id);
        await renderInventory(filter);
        await renderStockInfo();
        await populatePosSearch();
      });
    };
  });
}

export async function populateSupplierDropdown() {
  const dropdown = document.getElementById("inv-supplier");
  if (!dropdown) return;
  dropdown.innerHTML = "";
  (await getAll(STORES.SUPPLIERS))
    .filter((s) => !s.deleted)
    .forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s.id;
      opt.textContent = s.companyName;
      dropdown.appendChild(opt);
    });
}

export function initInventoryForm() {
  const form = document.getElementById("inventory-form");
  populateSupplierDropdown();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("inv-name").value.trim();
    const stock = parseInt(document.getElementById("inv-stock").value, 10) || 0;
    const buyingPrice =
      parseFloat(document.getElementById("inv-buying-price").value) || 0;
    const sellingPrice =
      parseFloat(document.getElementById("inv-selling-price").value) || 0;

    if (!name) {
      showAlert("Validation Error", "Item name is required.");
      return;
    }
    if (sellingPrice <= 0) {
      showAlert("Validation Error", "Selling price must be greater than zero.");
      return;
    }

    const supplierId = parseInt(
      document.getElementById("inv-supplier").value,
      10,
    );
    const supplier = (await getAll(STORES.SUPPLIERS)).find(
      (s) => s.id === supplierId && !s.deleted,
    );
    const supplierName = supplier ? supplier.companyName : "";
    const batchNumber = document
      .getElementById("inv-batch-number")
      .value.trim();
    const expiryDate = document.getElementById("inv-expiry-date").value;

    await add(STORES.INVENTORY, {
      name,
      supplierId,
      supplierName,
      stock,
      buyingPrice,
      sellingPrice,
      batchNumber,
      expiryDate,
    });
    form.reset();
    await renderInventory();
    await renderStockInfo();
    await populatePosSearch();
  };
}

export function initInventorySearch() {
  const searchInput = document.getElementById("search-inventory");
  searchInput.addEventListener("input", async () => {
    await renderInventory(searchInput.value);
  });
}

export function initInventoryImportExport() {
  document.getElementById("export-inventory").onclick = async () => {
    const data = await getAll(STORES.INVENTORY);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importInput = document.getElementById("import-inventory");
  document.getElementById("import-inventory-btn").onclick = async () => {
    const file = importInput.files[0];
    if (!file) {
      showAlert("Import Error", "Please select a JSON file first.");
      return;
    }
    const data = JSON.parse(await file.text());
    for (const item of data) {
      await put(STORES.INVENTORY, normalizeInventoryItem(item));
    }
    importInput.value = "";
    await renderInventory();
    await renderStockInfo();
    await populatePosSearch();
  };
}

export async function renderStockInfo() {
  const expiringBody = document.getElementById("stock-expiring-body");
  const lowBody = document.getElementById("stock-low-body");
  if (!expiringBody || !lowBody) return;

  expiringBody.innerHTML = "";
  lowBody.innerHTML = "";

  // Low-stock threshold from settings — no longer hardcoded at 50
  const { lowStockThreshold } = getSettings();

  const inventory = await getAll(STORES.INVENTORY);
  const now = new Date();
  const cutoff = new Date();
  cutoff.setDate(now.getDate() + 30);

  inventory
    .filter((item) => {
      if (!item.expiryDate) return false;
      const exp = new Date(item.expiryDate);
      return exp <= cutoff && exp >= now;
    })
    .forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.supplierName)}</td>
        <td>${escapeHtml(item.batchNumber)}</td>
        <td>${escapeHtml(item.expiryDate)}</td>
      `;
      expiringBody.appendChild(row);
    });

  inventory
    .filter((item) => (item.stock ?? 0) < lowStockThreshold)
    .forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(item.id)}</td>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.supplierName)}</td>
        <td>${escapeHtml(item.stock ?? 0)}</td>
      `;
      lowBody.appendChild(row);
    });
}

export async function initInventory() {
  await renderInventory();
  initInventoryForm();
  initInventorySearch();
  initInventoryImportExport();
  await renderStockInfo();
  await populatePosSearch();
}
