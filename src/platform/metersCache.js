// Offline-readable cache of the meter list + last readings, refreshed from
// Supabase whenever online. The offline write queue (syncQueue.js) alone
// isn't enough for this feature: the confirm screen has to show "last
// reading" and compute usage even with zero signal, so lookups need their
// own cache too, not just queued writes. Separate IndexedDB database from
// syncQueue.js's — different concern, no reason to share a version number
// or upgrade path with it.

const DB_NAME = "treetops-maintenance-meters-cache";
const DB_VERSION = 1;
const STORE_NAME = "meters";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("qr_code", "qr_code", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Called with the current `is_current` meters for the active site, fetched
// fresh from Supabase — replaces the whole cache rather than merging, so a
// meter that stopped being current (e.g. superseded in a later import)
// can't linger and resolve a scan to a stale row.
export async function replaceMetersCache(meters) {
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    for (const meter of meters) store.put(meter);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function findMeterByQrCode(qrCode) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).index("qr_code").get(qrCode);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCachedMeters() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
