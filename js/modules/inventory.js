import { STORES, getAll, add, put, del, getById } from "../core/db.js";
import { showAlert, showConfirm, showEdit } from "../core/ui.js";
import { populatePosSearch } from "./pos-utils.js";

function normalizeInventoryItem(item) {
  item.stock = parseInt(item.stock, 10) || 0;
  item.buyingPrice = parseFloat(item.buyingPrice) || 0;
  item.sellingPrice = parseFloat(item.sellingPrice) || 0;
  item.supplierId = parseInt(item.supplierId, 10);
  return item;
}

export async function renderInventory(filter = "") {
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
        <td>${item.id}</td>
        <td>${item.name || ""}</td>
        <td>${item.supplierName || ""}</td>
        <td>${item.stock ?? 0}</td>
        <td>${(item.buyingPrice ?? 0).toFixed(2)}</td>
        <td>${(item.sellingPrice ?? 0).toFixed(2)}</td>
        <td>${item.batchNumber || ""}</td>
        <td>${item.expiryDate || ""}</td>
        <td>
          <button class="secondary-btn edit-inventory" data-id="${item.id}">Edit</button>
          <button class="danger-btn delete-inventory" data-id="${item.id}">Delete</button>
        </td>
      `;
      tableBody.appendChild(row);
    });

  document.querySelectorAll(".edit-inventory").forEach((btn) => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id, 10);
      const inv = await getById(STORES.INVENTORY, id);
      if (!inv) return;

      const html = `
        <div class="form-group">
          <label for="edit-inv-name">Item Name</label>
          <input type="text" id="edit-inv-name" value="${inv.name || ""}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-supplier">Manufacturer</label>
          <select id="edit-inv-supplier"></select>
        </div>
        <div class="form-group">
          <label for="edit-inv-stock">Stock</label>
          <input type="number" id="edit-inv-stock" value="${inv.stock ?? 0}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-buying">Buying Price</label>
          <input type="number" step="0.01" id="edit-inv-buying" value="${inv.buyingPrice ?? 0}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-selling">Selling Price</label>
          <input type="number" step="0.01" id="edit-inv-selling" value="${inv.sellingPrice ?? 0}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-batch">Batch Number</label>
          <input type="text" id="edit-inv-batch" value="${inv.batchNumber || ""}" />
        </div>
        <div class="form-group">
          <label for="edit-inv-expiry">Expiry Date</label>
          <input type="date" id="edit-inv-expiry" value="${inv.expiryDate || ""}" />
        </div>
      `;

      showEdit(html, "Edit Inventory Item", async () => {
        inv.name = document.getElementById("edit-inv-name").value.trim();
        const supplierSelect = document.getElementById("edit-inv-supplier");
        const supplierId = parseInt(supplierSelect.value, 10);
        const supplier = (await getAll(STORES.SUPPLIERS)).find(
          (s) => s.id === supplierId && !s.deleted,
        );
        inv.supplierId = supplierId;
        inv.supplierName = supplier ? supplier.companyName : "";
        inv.stock = parseInt(document.getElementById("edit-inv-stock").value, 10) || 0;
        inv.buyingPrice = parseFloat(document.getElementById("edit-inv-buying").value) || 0;
        inv.sellingPrice = parseFloat(document.getElementById("edit-inv-selling").value) || 0;
        inv.batchNumber = document.getElementById("edit-inv-batch").value.trim();
        inv.expiryDate = document.getElementById("edit-inv-expiry").value;
        await put(STORES.INVENTORY, inv);
        await renderInventory(filter);
        await renderStockInfo();
        await populatePosSearch();
      });

      const supplierDropdown = document.getElementById("edit-inv-supplier");
      (await getAll(STORES.SUPPLIERS))
        .filter((s) => !s.deleted)
        .forEach((s) => {
          const opt = document.createElement("option");
          opt.value = s.id;
          opt.textContent = s.companyName;
          if (s.id === inv.supplierId) opt.selected = true;
          supplierDropdown.appendChild(opt);
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
  if (dropdown) {
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
}

export function initInventoryForm() {
  const form = document.getElementById("inventory-form");
  populateSupplierDropdown();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("inv-name").value.trim();
    const supplierId = parseInt(document.getElementById("inv-supplier").value, 10);
    const supplier = (await getAll(STORES.SUPPLIERS)).find(
      (s) => s.id === supplierId && !s.deleted,
    );
    const supplierName = supplier ? supplier.companyName : "";
    const stock = parseInt(document.getElementById("inv-stock").value, 10) || 0;
    const buyingPrice = parseFloat(document.getElementById("inv-buying-price").value) || 0;
    const sellingPrice = parseFloat(document.getElementById("inv-selling-price").value) || 0;
    const batchNumber = document.getElementById("inv-batch-number").value.trim();
    const expiryDate = document.getElementById("inv-expiry-date").value;

    const newItem = {
      name,
      supplierId,
      supplierName,
      stock,
      buyingPrice,
      sellingPrice,
      batchNumber,
      expiryDate,
    };
    await add(STORES.INVENTORY, newItem);
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
    const text = await file.text();
    const data = JSON.parse(text);
    for (const item of data) {
      const normalized = normalizeInventoryItem(item);
      await put(STORES.INVENTORY, normalized);
    }
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
        <td>${item.id}</td>
        <td>${item.name || ""}</td>
        <td>${item.supplierName || ""}</td>
        <td>${item.batchNumber || ""}</td>
        <td>${item.expiryDate || ""}</td>
      `;
      expiringBody.appendChild(row);
    });

  inventory
    .filter((item) => (item.stock ?? 0) < 50)
    .forEach((item) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.id}</td>
        <td>${item.name || ""}</td>
        <td>${item.supplierName || ""}</td>
        <td>${item.stock ?? 0}</td>
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
