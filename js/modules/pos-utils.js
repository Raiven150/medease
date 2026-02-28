import { STORES, getAll } from "../core/db.js";

let inventoryCache = [];

export async function populatePosSearch() {
  const searchInput = document.getElementById("pos-item-search");
  const suggestionList = document.getElementById("pos-suggestions");
  inventoryCache = await getAll(STORES.INVENTORY);
  suggestionList.innerHTML = "";
  inventoryCache.forEach((item) => {
    const opt = document.createElement("option");
    opt.value = item.name || "";
    suggestionList.appendChild(opt);
  });
}

export function getInventoryCache() {
  return inventoryCache;
}

export async function refreshInventoryCache() {
  inventoryCache = await getAll(STORES.INVENTORY);
  return inventoryCache;
}