const modal = document.getElementById("modal");
const modalPanel = document.getElementById("modal-panel");
const modalTitle = document.getElementById("modal-title");
const modalContent = document.getElementById("modal-content");
const modalActions = document.getElementById("modal-actions");

let focusTrapHandler = null;
let escapeHandler = null;
let lastFocusedElement = null;

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

  modalTitle.textContent = title;
  modalContent.innerHTML = "";
  modalContent.appendChild(content);
  modalActions.innerHTML = "";
  actions.forEach((action) => modalActions.appendChild(action));

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  modalPanel.setAttribute("role", "dialog");
  modalPanel.setAttribute("aria-modal", "true");
  trapFocus(modalPanel);

  // Escape key closes the modal
  if (escapeHandler) document.removeEventListener("keydown", escapeHandler);
  escapeHandler = (e) => {
    if (e.key === "Escape") closeModal();
  };
  document.addEventListener("keydown", escapeHandler);
}

function closeModal() {
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  modalPanel.removeAttribute("role");
  modalPanel.removeAttribute("aria-modal");

  if (focusTrapHandler) {
    modalPanel.removeEventListener("keydown", focusTrapHandler);
    focusTrapHandler = null;
  }
  if (escapeHandler) {
    document.removeEventListener("keydown", escapeHandler);
    escapeHandler = null;
  }

  // Restore focus to the element that triggered the modal
  if (lastFocusedElement?.focus) lastFocusedElement.focus();
  lastFocusedElement = null;
}

// Backdrop click — only close when the dark overlay itself is clicked
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
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
