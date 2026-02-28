import { initDashboard } from "./modules/dashboard.js";
import { initSuppliers } from "./modules/suppliers.js";
import { initInventory } from "./modules/inventory.js";
import { initDues } from "./modules/dues.js";
import { initSales } from "./modules/sales.js";
import { initPOS } from "./modules/pos.js";
import { showAlert } from "./core/ui.js";

async function initApp() {
  try {
    await Promise.all([
      initDashboard(),
      initSuppliers(),
      initInventory(),
      initDues(),
      initSales(),
      initPOS(),
    ]);
    // Navigation setup
    const navButtons = document.querySelectorAll(".nav-btn");
    navButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Reset all buttons and sections
        navButtons.forEach((b) => b.classList.remove("active"));
        document
          .querySelectorAll(".module-section")
          .forEach((s) => s.classList.remove("active"));
        // Activate clicked button and target section
        btn.classList.add("active");
        const targetId = btn.getAttribute("data-target");
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
          targetSection.classList.add("active");
        }
      });
    });
  } catch (err) {
    console.error("App initialization failed:", err);
    showAlert(
      "Initialization Error",
      "An error occurred while starting the application. Please reload the page.",
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});
