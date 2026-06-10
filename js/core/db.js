export const STORES = {
  ADMINS: "admins",
  DUES: "dues",
  SALES: "sales",
  SUPPLIERS: "suppliers",
  INVENTORY: "inventory",
  PROFITS: "profits",
  SETTINGS: "settings",
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  // Version 3: added SETTINGS store
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("MedEaseDB", 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Standard stores — numeric autoIncrement id
      const standardStores = [
        STORES.ADMINS,
        STORES.DUES,
        STORES.SALES,
        STORES.SUPPLIERS,
        STORES.INVENTORY,
      ];
      standardStores.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id", autoIncrement: true });
        }
      });

      // PROFITS uses a string day key as primary key e.g. "2025-01-09"
      if (db.objectStoreNames.contains(STORES.PROFITS)) {
        const tx = event.target.transaction;
        const existingStore = tx.objectStore(STORES.PROFITS);
        if (existingStore.keyPath !== "day") {
          db.deleteObjectStore(STORES.PROFITS);
          db.createObjectStore(STORES.PROFITS, { keyPath: "day" });
        }
      } else {
        db.createObjectStore(STORES.PROFITS, { keyPath: "day" });
      }

      // SETTINGS: single record, always id: 1
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(new Error("Database upgrade blocked by open connections."));
  });
  return dbPromise;
}

export async function getAll(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getById(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function add(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.add(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function addWithoutId(storeName, value) {
  const { id, ...rest } = value;
  return add(storeName, rest);
}

export async function put(storeName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function del(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function runTransaction(storeNames, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    const stores = {};
    storeNames.forEach((name) => {
      stores[name] = tx.objectStore(name);
    });

    let callbackResult;
    try {
      callbackResult = callback({ stores, tx });
    } catch (err) {
      tx.abort();
      reject(err);
      return;
    }

    tx.oncomplete = () => resolve(callbackResult);
    tx.onerror = () => reject(tx.error || new Error("Transaction failed"));
    tx.onabort = () => reject(new Error("Transaction aborted"));
  });
}

// ---------------------------------------------------------------------------
// Backup & Restore
// ---------------------------------------------------------------------------

// Stores included in every backup — ADMINS excluded intentionally:
// credentials belong to the device, not a transferable file.
const BACKUP_STORES = [
  STORES.SUPPLIERS,
  STORES.INVENTORY,
  STORES.DUES,
  STORES.SALES,
  STORES.PROFITS,
  STORES.SETTINGS,
];

export async function exportAllData() {
  const entries = await Promise.all(
    BACKUP_STORES.map(async (name) => [name, await getAll(name)]),
  );
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: Object.fromEntries(entries),
  };
}

export async function importAllData(backup) {
  if (!backup?.data) {
    throw new Error("Invalid backup file — missing data field.");
  }
  const { data } = backup;

  // Single atomic transaction — clears every store then re-adds all records.
  // IDB processes requests within a transaction in order so clear() always
  // completes before the add() calls that follow it.
  await runTransaction(BACKUP_STORES, "readwrite", ({ stores }) => {
    for (const storeName of BACKUP_STORES) {
      stores[storeName].clear();
    }
    for (const storeName of BACKUP_STORES) {
      const records = data[storeName] || [];
      for (const record of records) {
        stores[storeName].add(record);
      }
    }
  });
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

// Zero-padded so keys sort correctly as strings — e.g. "2025-01-09"
export function localDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDayKeyToLocalDate(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}
