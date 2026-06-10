let focusTrapHandler = null;
let escapeHandler = null;
let lastFocusedElement = null;

const getModal = () => document.getElementById("modal");
const getModalPanel = () => document.getElementById("modal-panel");
const getModalTitle = () => document.getElementById("modal-title");
const getModalContent = () => document.getElementById("modal-content");
const getModalActions = () => document.getElementById("modal-actions");

// ---------------------------------------------------------------------------
// Shared HTML escape utility — imported by every module that builds
// innerHTML from user-supplied data to prevent stored XSS.
// ---------------------------------------------------------------------------
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Focus trap
// ---------------------------------------------------------------------------
function trapFocus(element) {
  const focusableSelectors = [
    "button",
    "a[href]",
    "input",
    "select",
    "textarea",
    "[tabindex]:not([tabindex='-1'])",
  ];
  const focusableElements = element.querySelectorAll(
    focusableSelectors.join(","),
  );
  if (focusableElements.length === 0) return;

  const first = focusableElements[0];
  const last = focusableElements[focusableElements.length - 1];

  if (focusTrapHandler)
    element.removeEventListener("keydown", focusTrapHandler);

  focusTrapHandler = (e) => {
    if (e.key === "Tab") {
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  element.addEventListener("keydown", focusTrapHandler);
  first.focus();
}

// ---------------------------------------------------------------------------
// Open / close modal
// ---------------------------------------------------------------------------
function openModal(title, content, actions) {
  lastFocusedElement = document.activeElement;

  getModalTitle().textContent = title;
  getModalContent().innerHTML = "";
  getModalContent().appendChild(content);
  getModalActions().innerHTML = "";
  actions.forEach((action) => getModalActions().appendChild(action));

  getModal().style.display = "flex";
  getModal().setAttribute("aria-hidden", "false");
  getModalPanel().setAttribute("role", "dialog");
  getModalPanel().setAttribute("aria-modal", "true");
  trapFocus(getModalPanel());

  if (escapeHandler) document.removeEventListener("keydown", escapeHandler);
  escapeHandler = (e) => {
    if (e.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", escapeHandler);
}

function closeModal() {
  getModal().style.display = "none";
  getModal().setAttribute("aria-hidden", "true");
  getModalPanel().removeAttribute("role");
  getModalPanel().removeAttribute("aria-modal");

  if (focusTrapHandler) {
    getModalPanel().removeEventListener("keydown", focusTrapHandler);
    focusTrapHandler = null;
  }
  if (escapeHandler) {
    document.removeEventListener("keydown", escapeHandler);
    escapeHandler = null;
  }

  if (lastFocusedElement?.focus) lastFocusedElement.focus();
  lastFocusedElement = null;
}

// Backdrop click — only close when the dark overlay itself is clicked
document.addEventListener("DOMContentLoaded", () => {
  getModal().addEventListener("click", (e) => {
    if (e.target === getModal()) closeModal();
  });
});

// ---------------------------------------------------------------------------
// Public modal API
// ---------------------------------------------------------------------------
export function showAlert(title, message) {
  const content = document.createElement("div");
  const p = document.createElement("p");
  p.textContent = message;
  content.appendChild(p);

  const okBtn = document.createElement("button");
  okBtn.textContent = "OK";
  okBtn.className = "primary-btn";
  okBtn.onclick = closeModal;

  openModal(title, content, [okBtn]);
}

export function showConfirm(message, onConfirm) {
  const content = document.createElement("div");
  const p = document.createElement("p");
  p.textContent = message;
  content.appendChild(p);

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "secondary-btn";
  cancelBtn.onclick = closeModal;

  const okBtn = document.createElement("button");
  okBtn.textContent = "OK";
  okBtn.className = "primary-btn";
  okBtn.onclick = async () => {
    closeModal();
    await onConfirm();
  };

  openModal("Confirm", content, [cancelBtn, okBtn]);
}

export function showEdit(htmlContent, title, onSave) {
  const template = document.createElement("div");
  template.innerHTML = htmlContent
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/javascript:/gi, "");

  const content = document.createElement("div");
  Array.from(template.childNodes).forEach((node) => content.appendChild(node));

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "secondary-btn";
  cancelBtn.onclick = closeModal;

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  saveBtn.className = "primary-btn";
  saveBtn.onclick = async () => {
    closeModal();
    await onSave();
  };

  openModal(title, content, [cancelBtn, saveBtn]);
}

// ---------------------------------------------------------------------------
// Receipt overlay
// Kept separate from the modal so @media print can target it cleanly
// without the modal backdrop or any other UI appearing on paper.
// ---------------------------------------------------------------------------
export function showReceipt(htmlContent) {
  const overlay = document.getElementById("receipt-overlay");
  const content = document.getElementById("receipt-content");
  if (!overlay || !content) return;

  content.innerHTML = htmlContent;
  overlay.style.display = "flex";

  document.getElementById("receipt-print-btn").onclick = () => {
    window.print();
  };

  document.getElementById("receipt-close-btn").onclick = () => {
    overlay.style.display = "none";
    content.innerHTML = "";
  };
}
