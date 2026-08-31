// CampManager CSV import for the meter-reading pilot. Both exports share
// one 15-column shape (Meter ID, Name, Serial, Type, Site, Make, Model,
// Customer, Connected, Last Read, Last Reading, New Reading Date,
// New Reading, Cost Per Unit, VAT Rate) — this is also CampManager's own
// re-import format (the last 4 columns are blank, waiting to be filled
// in), which is what the export side hands back.

import Papa from "papaparse";
import { supabase } from "./supabaseClient.js";

// CampManager dates are DD/MM/YYYY — converting client-side to ISO avoids
// relying on the server's DateStyle setting to disambiguate DD/MM vs MM/DD.
function toIsoDate(ddmmyyyy) {
  if (!ddmmyyyy) return null;
  const [d, m, y] = ddmmyyyy.split("/");
  if (!d || !m || !y) return null;
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: reject,
    });
  });
}

// meterType is passed explicitly rather than trusted from the CSV's own
// "Type" column — the two files are named/organised by type already, and
// Andy's samples show at least one row where Type says "Electric Meter"
// but Name says "Gas" (or vice versa), so the filename the row came from
// is the more reliable signal.
async function csvRowsToImportRows(file, meterType) {
  if (!file) return [];
  const rows = await parseCsvFile(file);
  return rows
    .filter((r) => r["Meter ID"])
    .map((r) => ({
      external_meter_id: r["Meter ID"],
      meter_type: meterType,
      site_code: r["Site"],
      make: r["Make"] || null,
      model: r["Model"] || null,
      customer_name: r["Customer"] || null,
      connected: r["Connected"] === "Yes",
      last_read_date: toIsoDate(r["Last Read"]),
      last_reading: r["Last Reading"] || null,
      cost_per_unit: r["Cost Per Unit"] || null,
      vat_rate: r["VAT Rate"] || null,
    }));
}

// Returns { batch_id, inserted_count, unmatched_site_codes, duplicate_group_count }.
// unmatched_site_codes surfaces rather than silently drops any CSV row
// whose Site doesn't match a real pitches.pitch_number_or_name — the CSVs
// and the seeded pitch list came from different sources at different
// times, so a mismatch is a real signal worth showing, not a bug to code
// around.
export async function importMeterCsvFiles({ electricFile, gasFile, siteId }) {
  const [electricRows, gasRows] = await Promise.all([
    csvRowsToImportRows(electricFile, "electric"),
    csvRowsToImportRows(gasFile, "gas"),
  ]);
  const rows = [...electricRows, ...gasRows];
  if (rows.length === 0) throw new Error("No rows found in either file.");

  const { data, error } = await supabase.rpc("import_meters", {
    p_rows: rows,
    p_site_id: siteId,
    p_electric_filename: electricFile?.name || null,
    p_gas_filename: gasFile?.name || null,
  });
  if (error) throw error;
  return data;
}

export async function fetchDuplicateGroups(batchId) {
  const { data, error } = await supabase
    .from("meter_import_duplicate_groups")
    .select("id, pitch_id, meter_type, candidate_meter_ids, chosen_meter_id, resolved, pitches(pitch_number_or_name)")
    .eq("import_batch_id", batchId);
  if (error) {
    console.error("Failed to fetch duplicate groups", error);
    throw error;
  }
  return data;
}

// Confirming the auto-pick without changes still calls this (with the
// already-chosen id) so every group ends up resolved=true — nothing about
// a duplicate is ever left silently decided, per Andy's requirement.
export async function resolveDuplicateGroup(groupId, chosenExternalMeterId) {
  const { error } = await supabase.rpc("resolve_import_duplicate", {
    p_group_id: groupId,
    p_chosen_external_meter_id: chosenExternalMeterId,
  });
  if (error) throw error;
}

// Extra context for the review screen (Name/Last Read/Connected per
// candidate) so e.g. "Dead Meter electric" is visible when picking between
// duplicates, not just a bare list of Meter IDs.
export async function fetchMeterCandidatesForGroup(pitchId, meterType, batchId) {
  const { data, error } = await supabase
    .from("meters")
    .select("external_meter_id, make, model, customer_name, connected, last_read_date, last_reading")
    .eq("pitch_id", pitchId)
    .eq("meter_type", meterType)
    .eq("import_batch_id", batchId);
  if (error) {
    console.error("Failed to fetch duplicate candidates", error);
    throw error;
  }
  return data;
}
