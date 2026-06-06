import { STORES, getAll } from "../core/db.js";

let inventoryCache = [];

export async function populatePosSearch() {
  const searchInput = document.getElementById("pos-item-search");
  const suggestionList = document.getElementById("pos-suggestions");
  inventoryCache = await getAll(STORES.INVENTORY);
  suggestionList.innerHTML = "";

  // Only suggest items that are actually in stock so cashiers are never
  // presented with medicines they cannot sell. The stock check at cart-add
  // time remains as a second line of defence.
  inventoryCache
    .filter((item) => (item.stock ?? 0) > 0)
    .forEach((item) => {
      const opt = document.createElement("option");
      opt.value = item.name || "";
      suggestionList.appendChild(opt);
    });
}

// Returns the full cache (including zero-stock items) so pos.js can
// validate quantities against actual stock levels at add-to-cart time.
export function getInventoryCache() {
  return inventoryCache;
}

export async function refreshInventoryCache() {
  inventoryCache = await getAll(STORES.INVENTORY);
  return inventoryCache;
}
