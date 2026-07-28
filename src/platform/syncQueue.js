// IndexedDB-backed offline queue with a foreground flush, triggered on app
// load and on `online` events (see main.jsx). iOS Safari does not support
// the Background Sync API, so this deliberately does not rely on it.
// No other file should touch IndexedDB directly for queued writes —
// swapping this module's internals is how a future Capacitor build adds
// true background sync without touching calling code.

import { supabase } from "../lib/supabaseClient.js";

const DB_NAME = "treetops-maintenance";
const DB_VERSION = 1;
const STORE_NAME = "job_queue";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "client_generated_id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = callback(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function queueJob(jobData) {
  const record = {
    ...jobData,
    client_generated_id: jobData.client_generated_id || crypto.randomUUID(),
    queued_at: new Date().toISOString(),
  };
  await withStore("readwrite", (store) => store.put(record));
  flushQueue();
  return record;
}

export async function flushQueue() {
  if (!navigator.onLine) return { flushed: 0, remaining: 0 };

  const db = await openDB();
  const pending = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let flushed = 0;
  for (const job of pending) {
    const { client_generated_id, queued_at, ...jobFields } = job;
    const { error } = await supabase
      .from("jobs")
      .insert({ ...jobFields, client_generated_id });

    // A unique violation on client_generated_id means a previous flush
    // attempt already created this job server-side (e.g. the insert
    // succeeded but the response was lost) -- treat it as synced rather
    // than retrying forever. Any other error is a genuine failure, so
    // leave the job queued. (Plain insert, not upsert: an upsert here
    // requires satisfying the jobs_update RLS policy too, whose USING
    // clause can never be true for a row that doesn't exist yet -- see
    // the "new row violates row-level security policy" bug this
    // replaced.)
    if (error && error.code !== "23505") {
      console.error("Failed to flush queued job", client_generated_id, error);
      continue;
    }

    await withStore("readwrite", (store) => store.delete(client_generated_id));
    flushed += 1;
  }

  return { flushed, remaining: pending.length - flushed };
}

export async function getQueueStatus() {
  const db = await openDB();
  const count = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return { pendingCount: count, online: navigator.onLine };
}
