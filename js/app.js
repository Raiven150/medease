import {
  loadSettings,
  initSettings,
  renderSettings,
} from "./modules/settings.js";
import { initDashboard, renderDashboard } from "./modules/dashboard.js";
import { initSuppliers } from "./modules/suppliers.js";
import { initInventory } from "./modules/inventory.js";
import { initDues } from "./modules/dues.js";
import { initSales } from "./modules/sales.js";
import { initPOS } from "./modules/pos.js";
import { showAlert } from "./core/ui.js";

// ---------------------------------------------------------------------------
// Per-module initialisation with isolated error handling.
// A failure in one module never prevents the rest of the app from loading.
// ---------------------------------------------------------------------------
async function tryInit(name, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`[${name}] initialisation failed:`, err);
    showAlert(
      `${name} Error`,
      `The ${name} module failed to load. Other sections are still available. Please reload if the problem persists.`,
    );
  }
}

// ---------------------------------------------------------------------------
// Hash-based routing
// ---------------------------------------------------------------------------
const VALID_TARGETS = new Set([
  "dashboard",
  "suppliers",
  "inventory",
  "dues",
  "pos",
  "sales",
  "settings",
]);

function getHashTarget() {
  const hash = window.location.hash.replace("#", "").trim();
  return VALID_TARGETS.has(hash) ? hash : "dashboard";
}

function activateSection(targetId, navButtons) {
  navButtons.forEach((b) => b.classList.remove("active"));
  document
    .querySelectorAll(".module-section")
    .forEach((s) => s.classList.remove("active"));

  const targetSection = document.getElementById(targetId);
  if (targetSection) targetSection.classList.add("active");

  const matchingBtn = [...navButtons].find(
    (b) => b.getAttribute("data-target") === targetId,
  );
  if (matchingBtn) matchingBtn.classList.add("active");
}

// ---------------------------------------------------------------------------
// App entry point
// ---------------------------------------------------------------------------
async function initApp() {
  // Settings MUST load first — every other module calls getSettings()
  // synchronously during its own init to read currency symbol, thresholds etc.
  await loadSettings();

  // Initialise all modules independently so one failure never blocks others
  await tryInit("Dashboard", initDashboard);
  await tryInit("Suppliers", initSuppliers);
  await tryInit("Inventory", initInventory);
  await tryInit("Dues", initDues);
  await tryInit("Sales", initSales);
  await tryInit("POS", initPOS);
  await tryInit("Settings", initSettings);

  // Wire up navigation
  const navButtons = document.querySelectorAll(".nav-btn");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const targetId = btn.getAttribute("data-target");

      // Push hash so back/forward buttons work and section survives refresh
      window.location.hash = targetId;

      // Re-render live data when switching to these sections
      if (targetId === "dashboard") {
        try {
          await renderDashboard();
        } catch (err) {
          console.warn("Dashboard re-render on nav failed:", err);
        }
      }

      if (targetId === "settings") {
        try {
          renderSettings();
        } catch (err) {
          console.warn("Settings re-render on nav failed:", err);
        }
      }
    });
  });

  // Restore section from hash on load and react to back/forward navigation
  function handleHashChange() {
    activateSection(getHashTarget(), navButtons);
  }

  window.addEventListener("hashchange", handleHashChange);
  handleHashChange();
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
