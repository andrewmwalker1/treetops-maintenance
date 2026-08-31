// "Recreate these files" — re-emits CampManager's own 15-column format,
// New Reading Date/New Reading filled in for meters with a pending
// (unexported) reading, everything else carried through unchanged.
//
// Cost Per Unit/VAT Rate are left blank on export, same as every row in
// both source files today — unclear whether CampManager expects the
// export to populate them or fills them in itself on import, so this
// defaults to the lower-risk assumption for a billing-adjacent field
// rather than guessing. Flagged in the build plan for Andy to confirm
// before this is relied on for billing.
//
// Every field is always double-quoted to match the source files' own
// style byte-for-byte on unmodified columns, rather than the general
// csvExport.js helpers' quote-only-if-needed behaviour.

import { supabase } from "./supabaseClient.js";

function quoted(value) {
  const str = value == null ? "" : String(value);
  return `"${str.replace(/"/g, '""')}"`;
}

function toDdMmYyyy(isoDateOrTimestamp) {
  if (!isoDateOrTimestamp) return "";
  const d = new Date(isoDateOrTimestamp);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

const COLUMNS = [
  "Meter ID", "Name", "Serial", "Type", "Site", "Make", "Model", "Customer",
  "Connected", "Last Read", "Last Reading", "New Reading Date", "New Reading",
  "Cost Per Unit", "VAT Rate",
];

function downloadCsv(rows, filenamePrefix) {
  const csv = [COLUMNS, ...rows].map((row) => row.map(quoted).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// meterType: "electric" | "gas". Returns the reading ids that were
// included, so the caller can confirm before calling markReadingsExported.
async function buildExportRows(siteId, meterType) {
  const { data: meters, error } = await supabase
    .from("meters")
    .select("id, external_meter_id, meter_type, make, model, customer_name, connected, last_read_date, last_reading, cost_per_unit, vat_rate, pitches(pitch_number_or_name)")
    .eq("site_id", siteId)
    .eq("meter_type", meterType)
    .eq("is_current", true);
  if (error) throw error;

  const meterIds = meters.map((m) => m.id);
  const { data: pending, error: readingsError } = await supabase
    .from("meter_readings")
    .select("id, meter_id, reading_value, read_at")
    .in("meter_id", meterIds.length ? meterIds : ["00000000-0000-0000-0000-000000000000"])
    .is("exported_at", null)
    .order("read_at", { ascending: false });
  if (readingsError) throw readingsError;

  // Latest pending reading per meter, in case a meter was re-read more
  // than once this round.
  const latestByMeter = new Map();
  for (const r of pending) {
    if (!latestByMeter.has(r.meter_id)) latestByMeter.set(r.meter_id, r);
  }

  const rows = [];
  const includedReadingIds = [];
  for (const m of meters) {
    const reading = latestByMeter.get(m.id);
    if (reading) includedReadingIds.push(reading.id);
    rows.push([
      m.external_meter_id,
      "",
      "",
      m.meter_type === "electric" ? "Electric Meter" : "Gas Meter",
      m.pitches?.pitch_number_or_name || "",
      m.make || "",
      m.model || "",
      m.customer_name || "",
      m.connected ? "Yes" : "No",
      toDdMmYyyy(m.last_read_date),
      m.last_reading ?? "",
      reading ? toDdMmYyyy(reading.read_at) : "",
      reading ? reading.reading_value : "",
      "",
      "",
    ]);
  }
  return { rows, includedReadingIds };
}

// Logs the export first (export_logs RLS gates the whole feature on
// can_manage_meter_readings — same audit-before-data pattern as
// exportJobsCsv/exportEquipmentCheckoutsCsv in csvExport.js), then
// generates and downloads both CSVs, then marks every included reading
// exported and rolls its value into the parent meter's last_reading so
// the next round doesn't show a stale one.
export async function exportMeterReadingsCsvs({ orgId, siteId, profileId }) {
  const { error: logError } = await supabase.from("export_logs").insert({
    exported_by: profileId,
    org_id: orgId,
    filters_used: { export_type: "meter_readings" },
  });
  if (logError) throw new Error(`Export not permitted: ${logError.message}`);

  const [electric, gas] = await Promise.all([
    buildExportRows(siteId, "electric"),
    buildExportRows(siteId, "gas"),
  ]);

  downloadCsv(electric.rows, "electric-utilities-export");
  downloadCsv(gas.rows, "gas-utilities-export");

  const allReadingIds = [...electric.includedReadingIds, ...gas.includedReadingIds];
  if (allReadingIds.length > 0) {
    const { error } = await supabase.rpc("mark_readings_exported", { p_reading_ids: allReadingIds });
    if (error) throw error;
  }

  return { electricRowCount: electric.rows.length, gasRowCount: gas.rows.length, readingsExported: allReadingIds.length };
}
