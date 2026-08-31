// IndexedDB-backed offline queue with a foreground flush, triggered on app
// load and on `online` events (see main.jsx). iOS Safari does not support
// the Background Sync API, so this deliberately does not rely on it.
// No other file should touch IndexedDB directly for queued writes —
// swapping this module's internals is how a future Capacitor build adds
// true background sync without touching calling code.
//
// Generalized (v2) from a jobs-only queue to support any table with a
// client_generated_id column — the meter-reading pilot needed a second
// queue (readings) and duplicating this whole file per table would mean
// two places to fix the next time this module's internals change.
// job_queue's existing data survives the version bump untouched —
// IndexedDB store creation in onupgradeneeded is additive, never
// destructive to stores that already exist.

import { supabase } from "../lib/supabaseClient.js";

const DB_NAME = "treetops-maintenance";
const DB_VERSION = 2;
const STORES = ["job_queue", "reading_queue"];

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "client_generated_id" });
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = callback(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

async function queueWrite(storeName, record) {
  const withId = {
    ...record,
    client_generated_id: record.client_generated_id || crypto.randomUUID(),
    queued_at: new Date().toISOString(),
  };
  await withStore(storeName, "readwrite", (store) => store.put(withId));
  return withId;
}

async function flushStore(storeName, tableName) {
  if (!navigator.onLine) return { flushed: 0, remaining: 0 };

  const db = await openDB();
  const pending = await new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let flushed = 0;
  for (const record of pending) {
    const { client_generated_id, queued_at, ...fields } = record;
    const { error } = await supabase
      .from(tableName)
      .insert({ ...fields, client_generated_id });

    // A unique violation on client_generated_id means a previous flush
    // attempt already created this row server-side (e.g. the insert
    // succeeded but the response was lost) -- treat it as synced rather
    // than retrying forever. Any other error is a genuine failure, so
    // leave the row queued. (Plain insert, not upsert: an upsert here
    // requires satisfying the table's *_update RLS policy too, whose USING
    // clause can never be true for a row that doesn't exist yet -- see
    // the "new row violates row-level security policy" bug this
    // replaced.)
    if (error && error.code !== "23505") {
      console.error(`Failed to flush queued ${tableName} row`, client_generated_id, error);
      continue;
    }

    await withStore(storeName, "readwrite", (store) => store.delete(client_generated_id));
    flushed += 1;
  }

  return { flushed, remaining: pending.length - flushed };
}

async function storeCount(storeName) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function queueJob(jobData) {
  const record = await queueWrite("job_queue", jobData);
  flushQueue();
  return record;
}

export async function flushQueue() {
  return flushStore("job_queue", "jobs");
}

export async function getQueueStatus() {
  const count = await storeCount("job_queue");
  return { pendingCount: count, online: navigator.onLine };
}

// Readings carry a photo Blob (`photo_file`), unlike jobs — job photos are
// deliberately dropped when queued offline (NewJob.jsx: "the photo wasn't
// queued — add it after it syncs"), but a meter photo is core evidence the
// brief requires for every reading, and offline is this feature's normal
// case, not an edge case. IndexedDB can store a Blob directly via
// structured clone, so the file rides in the queue record and only gets
// uploaded to Storage at flush time — this needs its own flush function
// rather than the generic flushStore, which only knows how to insert a
// plain row.
export async function queueReading({ photo_file, ...readingData }) {
  const record = await queueWrite("reading_queue", { ...readingData, photo_file: photo_file || null });
  flushReadingQueue();
  return record;
}

export async function flushReadingQueue() {
  if (!navigator.onLine) return { flushed: 0, remaining: 0 };

  const db = await openDB();
  const pending = await new Promise((resolve, reject) => {
    const tx = db.transaction("reading_queue", "readonly");
    const request = tx.objectStore("reading_queue").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let flushed = 0;
  for (const record of pending) {
    const { client_generated_id, queued_at, photo_file, meter_id, ...fields } = record;
    let photo_storage_path = fields.photo_storage_path || null;

    if (photo_file && !photo_storage_path) {
      const path = `${meter_id}/${client_generated_id}-${photo_file.name}`;
      const { error: uploadError } = await supabase.storage.from("meter-photos").upload(path, photo_file);
      if (uploadError) {
        console.error("Failed to upload queued meter photo, will retry", client_generated_id, uploadError);
        continue;
      }
      photo_storage_path = path;
    }

    const { error } = await supabase
      .from("meter_readings")
      .insert({ ...fields, meter_id, photo_storage_path, client_generated_id });

    // Same idempotent-retry handling as flushStore above.
    if (error && error.code !== "23505") {
      console.error("Failed to flush queued reading", client_generated_id, error);
      // Photo already uploaded (or path already resolved) — persist that so
      // a retry doesn't re-upload it.
      if (photo_storage_path !== (fields.photo_storage_path || null)) {
        await withStore("reading_queue", "readwrite", (store) =>
          store.put({ ...record, photo_storage_path })
        );
      }
      continue;
    }

    await withStore("reading_queue", "readwrite", (store) => store.delete(client_generated_id));
    flushed += 1;
  }

  return { flushed, remaining: pending.length - flushed };
}

export async function getReadingQueueStatus() {
  const count = await storeCount("reading_queue");
  return { pendingCount: count, online: navigator.onLine };
}
