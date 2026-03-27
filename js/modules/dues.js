import { STORES, getAll, addWithoutId, put, del, getById } from "../core/db.js";
import { showAlert, showConfirm, showEdit } from "../core/ui.js";

function normalizeDue(due) {
  due.amount = parseFloat(due.amount) || 0;
  due.customer = (due.customer || "").trim();
  due.phone = (due.phone || "").trim();
  due.address = (due.address || "").trim();

  if (due.borrowedDate) {
    due.borrowedDate = new Date(due.borrowedDate).toISOString();
  }
  if (due.date) {
    due.date = new Date(due.date).toISOString();
  }
  if (!due.status) due.status = "Pending";
  return due;
}

export async function renderDues(filter = "") {
  const tableBody = document.getElementById("dues-table-body");
  tableBody.innerHTML = "";

  const dues = await getAll(STORES.DUES);

  const filtered = dues.filter(
    (d) =>
      (d.customer || "").toLowerCase().includes(filter.toLowerCase()) ||
      (d.amount?.toString() || "").includes(filter) ||
      (d.status || "").toLowerCase().includes(filter.toLowerCase()) ||
      (d.phone || "").toLowerCase().includes(filter.toLowerCase()) ||
      (d.address || "").toLowerCase().includes(filter.toLowerCase()),
  );

  filtered.forEach((due) => {
    let dateStr = "";
    if (due.borrowedDate) {
      const parsed = new Date(due.borrowedDate);
      dateStr = isNaN(parsed) ? "" : parsed.toLocaleDateString();
    } else if (due.date) {
      const parsed = new Date(due.date);
      dateStr = isNaN(parsed) ? "" : parsed.toLocaleDateString();
    }

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${due.id}</td>
      <td>${due.customer || ""}</td>
      <td>৳${(due.amount ?? 0).toFixed(2)}</td>
      <td>${due.phone || ""}</td>
      <td>${due.address || ""}</td>
      <td>${dateStr}</td>
      <td>${due.status || "Pending"}</td>
      <td>
        <button class="secondary-btn edit-due" data-id="${due.id}">Edit</button>
        <button class="danger-btn delete-due" data-id="${due.id}">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  document.querySelectorAll(".edit-due").forEach((btn) => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id, 10);
      const due = await getById(STORES.DUES, id);
      if (!due) return;

      const borrowedDateValue =
        due.borrowedDate ? new Date(due.borrowedDate).toISOString().slice(0, 10)
        : due.date ? new Date(due.date).toISOString().slice(0, 10)
        : "";

      const html = `
        <div class="form-group">
          <label for="edit-due-name">Customer Name</label>
          <input type="text" id="edit-due-name" value="${due.customer || ""}" />
        </div>
        <div class="form-group">
          <label for="edit-due-amount">Amount</label>
          <input type="number" step="0.01" id="edit-due-amount" value="${(due.amount ?? 0).toFixed(2)}" />
        </div>
        <div class="form-group">
          <label for="edit-due-phone">Phone</label>
          <input type="tel" id="edit-due-phone" value="${due.phone || ""}" />
        </div>
        <div class="form-group">
          <label for="edit-due-address">Address</label>
          <input type="text" id="edit-due-address" value="${due.address || ""}" />
        </div>
        <div class="form-group">
          <label for="edit-due-borrowed-date">Borrowed Date</label>
          <input type="date" id="edit-due-borrowed-date" value="${borrowedDateValue}" />
        </div>
        <div class="form-group">
          <label for="edit-due-status">Status</label>
          <select id="edit-due-status">
            <option value="Pending" ${due.status === "Pending" ? "selected" : ""}>Pending</option>
            <option value="Paid" ${due.status === "Paid" ? "selected" : ""}>Paid</option>
          </select>
        </div>
      `;

      showEdit(html, "Edit Due", async () => {
        due.customer = document.getElementById("edit-due-name").value.trim();
        due.amount = parseFloat(
          document.getElementById("edit-due-amount").value,
        );
        due.phone = document.getElementById("edit-due-phone").value.trim();
        due.address = document.getElementById("edit-due-address").value.trim();
        const bd = document.getElementById("edit-due-borrowed-date").value;
        due.borrowedDate = bd ? new Date(bd).toISOString() : "";
        due.status = document.getElementById("edit-due-status").value;
        await put(STORES.DUES, due);
        await renderDues(filter);
      });
    };
  });

  document.querySelectorAll(".delete-due").forEach((btn) => {
    btn.onclick = async () => {
      const id = parseInt(btn.dataset.id, 10);
      showConfirm("Delete this due?", async () => {
        await del(STORES.DUES, id);
        await renderDues(filter);
      });
    };
  });
}

export function initDueForm() {
  const form = document.getElementById("dues-form");
  form.onsubmit = async (e) => {
    e.preventDefault();
    const customer = document.getElementById("dues-name").value.trim();
    const amountInput = parseFloat(
      document.getElementById("dues-amount").value,
    );
    const phone = document.getElementById("dues-phone").value.trim();
    const address = document.getElementById("dues-address").value.trim();
    const borrowedDateInput =
      document.getElementById("dues-borrowed-date").value;
    const newDue = {
      customer,
      amount: amountInput,
      phone,
      address,
      borrowedDate:
        borrowedDateInput ? new Date(borrowedDateInput).toISOString() : "",
      status: "Pending",
    };
    await addWithoutId(STORES.DUES, newDue);
    form.reset();
    await renderDues();
  };
}

export function initDuesSearch() {
  const searchInput = document.getElementById("search-dues");
  searchInput.addEventListener("input", async () => {
    await renderDues(searchInput.value);
  });
}

export function initDuesImportExport() {
  const exportBtn = document.getElementById("export-dues");
  exportBtn.onclick = async () => {
    const data = await getAll(STORES.DUES);
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dues.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const importInput = document.getElementById("import-dues");
  const importBtn = document.getElementById("import-dues-btn");
  importBtn.onclick = async () => {
    const file = importInput.files[0];
    if (!file) {
      showAlert("Import Error", "Please select a JSON file first.");
      return;
    }
    const text = await file.text();
    const data = JSON.parse(text);
    for (const due of data) {
      const normalized = normalizeDue(due);
      await put(STORES.DUES, normalized);
    }
    await renderDues();
  };
}

export async function initDues() {
  await renderDues();
  initDueForm();
  initDuesSearch();
  initDuesImportExport();
}
