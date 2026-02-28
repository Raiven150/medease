export const STORES = {
  ADMINS: "admins",
  DUES: "dues",
  MEDICINES: "medicines",
  SALES: "sales",
  SALE_ITEMS: "sale_items",
  SUPPLIERS: "suppliers",
  INVENTORY: "inventory",
  PROFITS: "profits",
};

let dbPromise = null;

export function openDB() {
  if (dbPromise) return dbPromise;
  // bumped DB version to 2 to fix PROFITS store schema
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open("MedEaseDB", 2);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create or ensure all stores except PROFITS use numeric id keyPath
      Object.values(STORES).forEach((store) => {
        if (store === STORES.PROFITS) return;
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: "id", autoIncrement: true });
        }
      });

      // Ensure PROFITS store uses day as the primary key
      if (db.objectStoreNames.contains(STORES.PROFITS)) {
        try {
          db.deleteObjectStore(STORES.PROFITS);
        } catch (err) {
          // ignore if deletion fails
        }
      }
      if (!db.objectStoreNames.contains(STORES.PROFITS)) {
        db.createObjectStore(STORES.PROFITS, { keyPath: "day" });
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

export function localDayKey(date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function parseDayKeyToLocalDate(dayKey) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}
