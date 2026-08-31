// Query/write helpers for the meter-reading pilot. Mirrors NewJob.jsx's
// online/offline submit pattern exactly (client-generates the id up front,
// tries a direct insert when online, falls back to the offline queue on a
// network TypeError or when navigator.onLine is already false) rather than
// inventing a different convention for this feature.

import { supabase } from "./supabaseClient.js";
import { queueReading } from "../platform/syncQueue.js";
import { replaceMetersCache, findMeterByQrCode, getAllCachedMeters } from "../platform/metersCache.js";

export async function fetchActiveMeters(siteId) {
  const { data, error } = await supabase
    .from("meters")
    .select("id, external_meter_id, meter_type, qr_code, make, model, customer_name, connected, last_read_date, last_reading, pitch_id, pitches(pitch_number_or_name)")
    .eq("site_id", siteId)
    .eq("is_current", true);
  if (error) {
    console.error("Failed to fetch active meters", error);
    throw error;
  }
  return data;
}

// Called on load and whenever back online (Layout.jsx-style) so the offline
// cache never drifts far from the server. Safe to call often — it's a
// full-replace, not an incremental sync.
export async function refreshMetersCache(siteId) {
  if (!navigator.onLine) return;
  try {
    const meters = await fetchActiveMeters(siteId);
    await replaceMetersCache(meters);
  } catch (err) {
    console.error("Failed to refresh meters cache", err);
  }
}

// Resolves a scanned QR string to a meter, preferring the live table when
// online (fresher) and falling back to the offline cache when not — the
// cache itself is also kept current by refreshMetersCache above.
export async function resolveMeterByQrCode(qrCode) {
  if (navigator.onLine) {
    const { data, error } = await supabase
      .from("meters")
      .select("id, external_meter_id, meter_type, qr_code, make, model, customer_name, connected, last_read_date, last_reading, pitch_id, pitches(pitch_number_or_name)")
      .eq("qr_code", qrCode)
      .eq("is_current", true)
      .maybeSingle();
    if (!error && data) return data;
    if (error) console.error("Live meter lookup failed, falling back to cache", error);
  }
  return findMeterByQrCode(qrCode);
}

// "Already read today" check (Section: Progress / round tracking) — looks
// at both the synced table and anything still sitting in the offline
// queue, since a re-scan minutes after an offline save should still warn
// even though that reading hasn't reached the server yet.
export async function findTodaysReadingForMeter(meterId) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("meter_readings")
    .select("reading_value, read_at")
    .eq("meter_id", meterId)
    .gte("read_at", startOfDay.toISOString())
    .order("read_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) console.error("Failed to check today's readings", error);
  return data || null;
}

export async function submitReading(readingData) {
  const client_generated_id = crypto.randomUUID();
  const payload = { ...readingData, client_generated_id };

  if (!navigator.onLine) {
    await queueReading(payload);
    return { queued: true };
  }

  try {
    const { photo_file, ...fields } = payload;
    let photo_storage_path = null;
    if (photo_file) {
      const path = `${fields.meter_id}/${client_generated_id}-${photo_file.name}`;
      const { error: uploadError } = await supabase.storage.from("meter-photos").upload(path, photo_file);
      if (uploadError) throw uploadError;
      photo_storage_path = path;
    }
    const { error } = await supabase.from("meter_readings").insert({ ...fields, photo_storage_path });
    if (error) throw error;
    return { queued: false };
  } catch (err) {
    // Same reasoning as NewJob.jsx: only a genuine network failure should
    // fall back to queueing — anything else (permission, validation) would
    // just fail identically on retry, so surface it instead.
    if (err instanceof TypeError) {
      console.error("Network error submitting reading, queueing for later sync", err);
      await queueReading(payload);
      return { queued: true };
    }
    throw err;
  }
}

export async function fetchProgress(siteId) {
  const { count: totalMeters, error: totalError } = await supabase
    .from("meters")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId)
    .eq("is_current", true)
    .eq("connected", true);
  if (totalError) console.error("Failed to count active meters", totalError);

  const { data: pendingReadings, error: pendingError } = await supabase
    .from("meter_readings")
    .select("meter_id")
    .eq("site_id", siteId)
    .is("exported_at", null);
  if (pendingError) console.error("Failed to count pending readings", pendingError);

  const readMeterIds = new Set((pendingReadings || []).map((r) => r.meter_id));
  return { total: totalMeters || 0, read: readMeterIds.size, readMeterIds };
}

export async function fetchOutstandingMeters(siteId) {
  const [meters, progress] = await Promise.all([fetchActiveMeters(siteId), fetchProgress(siteId)]);
  return meters.filter((m) => m.connected && !progress.readMeterIds.has(m.id));
}

export { getAllCachedMeters };
