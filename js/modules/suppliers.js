import { STORES, getAll, addWithoutId, put, getById } from "../core/db.js";
import { showAlert, showConfirm, showEdit } from "../core/ui.js";
import { populateSupplierDropdown } from "./inventory.js";

export async function renderSuppliers(filter = "") {
  const tableBody = document.getElementById("supplier-table-body");
  tableBody.innerHTML = "";
  (await getAll(STORES.SUPPLIERS))
    .filter((s) => !s.deleted)
    .filter(
      (s) =>
        (s.companyName || "").toLowerCase().includes(filter.toLowerCase()) ||
        (s.supplierName || "").toLowerCase().includes(filter.toLowerCase()) ||
        (s.contact || "").toLowerCase().includes(filter.toLowerCase()),
    )
    .forEach((s) => {
      const row = document.createElement("tr");
      row.innerHTML = `
      <td>${s.id}</td>
      <td>${s.companyName || ""}</td>
      <td>${s.supplierName || ""}</td>
      <td>${s.contact || ""}</td>
      <td>
        <button class="secondary-btn edit-supplier" data-id="${s.id}">Edit</button>
        <button class="danger-btn delete-supplier" data-id="${s.id}">Delete</button>
      </td>
    `;
      tableBody.appendChild(row);
    });

  document.querySelectorAll(".edit-supplier").forEach((btn) => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id, 10);
      const supplier = await getById(STORES.SUPPLIERS, id);
      if (!supplier) return;
      const html = `
        <div class="form-group">
          <label for="edit-company-name">Company Name</label>
          <input type="text" id="edit-company-name" value="${supplier.companyName || ""}" />
        </div>
        <div class="form-group">
          <label for="edit-supplier-name">Supplier Name</label>
          <input type="text" id="edit-supplier-name" value="${supplier.supplierName || ""}" />
        </div>
        <div class="form-group">
          <label for="edit-contact">Contact</label>
          <input type="text" id="edit-contact" value="${supplier.contact || ""}" />
        </div>
      `;
      showEdit(html, "Edit Supplier", async () => {
        supplier.companyName = document
          .getElementById("edit-company-name")
          .value.trim();
        supplier.supplierName = document
          .getElementById("edit-supplier-name")
          .value.trim();
        supplier.contact = document.getElementById("edit-contact").value.trim();
        await put(STORES.SUPPLIERS, supplier);
        await renderSuppliers(filter);
        await populateSupplierDropdown();
      });
    };
  });

  document.querySelectorAll(".delete-supplier").forEach((btn) => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id, 10);
      showConfirm("Delete this supplier?", async () => {
        const supplier = await getById(STORES.SUPPLIERS, id);
        if (!supplier) return;
        await put(STORES.SUPPLIERS, { ...supplier, deleted: true });
        await renderSuppliers(filter);
        await populateSupplierDropdown();
      });
    };
  });
}

export function initSupplierForm() {
  const form = document.getElementById("supplier-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const companyName = document
      .getElementById("sup-company-name")
      .value.trim();
    const supplierName = document
      .getElementById("sup-supplier-name")
      .value.trim();
    const contact = document.getElementById("sup-contact").value.trim();
    const newSupplier = { companyName, supplierName, contact };
    await addWithoutId(STORES.SUPPLIERS, newSupplier);
    form.reset();
    await renderSuppliers();
    await populateSupplierDropdown();
  };
}

export function initSupplierSearch() {
  const searchInput = document.getElementById("search-suppliers");
  searchInput.addEventListener("input", async () => {
    await renderSuppliers(searchInput.value);
  });
}

export function initSupplierImportExport() {
  document.getElementById("export-suppliers").onclick = async () => {
    const data = await getAll(STORES.SUPPLIERS);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "suppliers.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importInput = document.getElementById("import-suppliers");
  document.getElementById("import-suppliers-btn").onclick = async () => {
    const file = importInput.files[0];
    if (!file) {
      showAlert("Import Error", "Please select a JSON file first.");
      return;
    }
    const text = await file.text();
    const data = JSON.parse(text);
    for (const supplier of data) {
      await addWithoutId(STORES.SUPPLIERS, supplier);
    }
    await renderSuppliers();
    await populateSupplierDropdown();
  };
}

export async function initSuppliers() {
  await renderSuppliers();
  initSupplierForm();
  initSupplierSearch();
  initSupplierImportExport();
}