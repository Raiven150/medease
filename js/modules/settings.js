import {
  STORES,
  getById,
  put,
  exportAllData,
  importAllData,
} from "../core/db.js";
import { showAlert, showConfirm } from "../core/ui.js";

// ---------------------------------------------------------------------------
// Defaults — used on first launch or if a field is missing from the DB record
// ---------------------------------------------------------------------------
export const SETTINGS_DEFAULTS = {
  id: 1,
  storeName: "MedEase Pharmacy",
  currencySymbol: "৳",
  lowStockThreshold: 50,
  storeAddress: "",
  storePhone: "",
};

let cachedSettings = null;

// ---------------------------------------------------------------------------
// loadSettings — called once at app startup in app.js before other modules.
// Reads from IndexedDB and merges with defaults so missing fields are safe.
// ---------------------------------------------------------------------------
export async function loadSettings() {
  try {
    const record = await getById(STORES.SETTINGS, 1);
    cachedSettings =
      record ? { ...SETTINGS_DEFAULTS, ...record } : { ...SETTINGS_DEFAULTS };
  } catch (err) {
    console.warn("loadSettings error — using defaults:", err);
    cachedSettings = { ...SETTINGS_DEFAULTS };
  }
  return cachedSettings;
}

// ---------------------------------------------------------------------------
// getSettings — synchronous, returns the cached settings object.
// Safe to call anywhere after loadSettings() has resolved.
// Falls back to defaults if called before loadSettings() for any reason.
// ---------------------------------------------------------------------------
export function getSettings() {
  return cachedSettings ?? { ...SETTINGS_DEFAULTS };
}

// ---------------------------------------------------------------------------
// saveSettings — persists the record to IndexedDB and refreshes the cache.
// ---------------------------------------------------------------------------
async function saveSettings(data) {
  const record = { ...SETTINGS_DEFAULTS, ...data, id: 1 };
  await put(STORES.SETTINGS, record);
  cachedSettings = record;
}

// ---------------------------------------------------------------------------
// renderSettings — populates the form fields with current values.
// Also updates the sidebar logo and browser title live.
// ---------------------------------------------------------------------------
export function renderSettings() {
  const s = getSettings();
  const el = (id) => document.getElementById(id);

  const storeName = el("settings-store-name");
  const currencySymbol = el("settings-currency-symbol");
  const lowStock = el("settings-low-stock-threshold");
  const storeAddress = el("settings-store-address");
  const storePhone = el("settings-store-phone");

  if (storeName) storeName.value = s.storeName;
  if (currencySymbol) currencySymbol.value = s.currencySymbol;
  if (lowStock) lowStock.value = s.lowStockThreshold;
  if (storeAddress) storeAddress.value = s.storeAddress;
  if (storePhone) storePhone.value = s.storePhone;

  // Reflect store name in sidebar logo and browser/app title
  const logo = document.querySelector(".sidebar .logo");
  if (logo) logo.textContent = s.storeName;
  document.title = s.storeName;
}

// ---------------------------------------------------------------------------
// Backup helpers
// ---------------------------------------------------------------------------
function buildBackupFilename() {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `medease-backup-${y}${mo}${d}-${h}${mi}${s}.json`;
}

async function handleBackup() {
  try {
    const backup = await exportAllData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildBackupFilename();
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Backup failed:", err);
    showAlert(
      "Backup Failed",
      "An error occurred while creating the backup. Please try again.",
    );
  }
}

async function handleRestore(file) {
  if (!file) {
    showAlert("Restore Error", "Please select a backup file first.");
    return;
  }

  // Wrap the actual restore work in a Promise so the caller can await it,
  // including the user's confirmation step inside the modal.
  return new Promise((resolve) => {
    showConfirm(
      "Restoring will replace ALL current data — suppliers, inventory, dues, sales, profits and settings — with the contents of the backup file. This cannot be undone. Continue?",
      async () => {
        try {
          const text = await file.text();
          const backup = JSON.parse(text);

          if (!backup?.data) {
            showAlert(
              "Restore Failed",
              "The selected file is not a valid MedEase backup.",
            );
            resolve();
            return;
          }

          await importAllData(backup);

          // Reload the page so all modules reinitialise with the restored data
          showAlert(
            "Restore Complete",
            "All data has been restored successfully. The app will now reload.",
          );

          // Brief delay so the alert renders before reload
          setTimeout(() => window.location.reload(), 1800);
        } catch (err) {
          console.error("Restore failed:", err);
          showAlert(
            "Restore Failed",
            "An error occurred while restoring the backup. The file may be corrupt or invalid.",
          );
        }
        resolve();
      },
    );
  });
}

// ---------------------------------------------------------------------------
// initSettings — wires up the settings form and backup/restore buttons.
// ---------------------------------------------------------------------------
export async function initSettings() {
  renderSettings();

  // ── Settings form ────────────────────────────────────────────────────────
  const form = document.getElementById("settings-form");
  if (form) {
    form.onsubmit = async (e) => {
      e.preventDefault();

      const storeName = document
        .getElementById("settings-store-name")
        .value.trim();
      const currencySymbol = document
        .getElementById("settings-currency-symbol")
        .value.trim();
      const lowStockRaw = parseInt(
        document.getElementById("settings-low-stock-threshold").value,
        10,
      );
      const storeAddress = document
        .getElementById("settings-store-address")
        .value.trim();
      const storePhone = document
        .getElementById("settings-store-phone")
        .value.trim();

      if (!storeName) {
        showAlert("Validation Error", "Store name is required.");
        return;
      }
      if (!currencySymbol) {
        showAlert("Validation Error", "Currency symbol is required.");
        return;
      }
      if (isNaN(lowStockRaw) || lowStockRaw < 1) {
        showAlert(
          "Validation Error",
          "Low stock threshold must be at least 1.",
        );
        return;
      }

      await saveSettings({
        storeName,
        currencySymbol,
        lowStockThreshold: lowStockRaw,
        storeAddress,
        storePhone,
      });

      renderSettings();
      showAlert(
        "Settings Saved",
        "Your settings have been saved successfully.",
      );
    };
  }

  // ── Backup button ─────────────────────────────────────────────────────────
  const backupBtn = document.getElementById("backup-btn");
  if (backupBtn) backupBtn.onclick = handleBackup;

  // ── Restore button + file input ───────────────────────────────────────────
  const restoreInput = document.getElementById("restore-input");
  const restoreBtn = document.getElementById("restore-btn");
  if (restoreBtn && restoreInput) {
    restoreBtn.onclick = async () => {
      const file = restoreInput.files[0];

      // Fixed: await the full restore flow (including the confirm modal) before
      // resetting the file input. Previously .then() fired immediately after
      // showConfirm opened, clearing the filename before the user even confirmed.
      await handleRestore(file);
      restoreInput.value = "";
    };
  }
}
