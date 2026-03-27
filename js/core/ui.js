const modal = document.getElementById("modal");
const modalPanel = document.getElementById("modal-panel");
const modalTitle = document.getElementById("modal-title");
const modalContent = document.getElementById("modal-content");
const modalActions = document.getElementById("modal-actions");

let focusTrapHandler = null;

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

  let first = focusableElements[0];
  let last = focusableElements[focusableElements.length - 1];

  // Remove any existing handler before adding a new one
  if (focusTrapHandler) {
    element.removeEventListener("keydown", focusTrapHandler);
  }

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

function openModal(title, content, actions) {
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
}

function closeModal() {
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  modalPanel.removeAttribute("role");
  modalPanel.removeAttribute("aria-modal");

  // Clean up focus trap handler
  if (focusTrapHandler) {
    modalPanel.removeEventListener("keydown", focusTrapHandler);
    focusTrapHandler = null;
  }
}

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
  // Safer sanitization: build via DOM instead of raw innerHTML
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