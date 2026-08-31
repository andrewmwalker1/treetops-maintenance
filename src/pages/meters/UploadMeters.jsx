import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import {
  importMeterCsvFiles,
  fetchDuplicateGroups,
  fetchMeterCandidatesForGroup,
  resolveDuplicateGroup,
} from "../../lib/meterImport.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

export default function UploadMeters() {
  const { activeSite } = useAuth();
  const [electricFile, setElectricFile] = useState(null);
  const [gasFile, setGasFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [duplicateGroups, setDuplicateGroups] = useState([]);

  async function handleImport() {
    if (!electricFile && !gasFile) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const data = await importMeterCsvFiles({ electricFile, gasFile, siteId: activeSite.id });
      setResult(data);
      if (data.duplicate_group_count > 0) {
        const groups = await fetchDuplicateGroups(data.batch_id);
        setDuplicateGroups(groups.filter((g) => !g.resolved));
      } else {
        setDuplicateGroups([]);
      }
    } catch (err) {
      console.error("Import failed", err);
      setError(err.message || "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  async function handleGroupResolved() {
    const groups = await fetchDuplicateGroups(result.batch_id);
    setDuplicateGroups(groups.filter((g) => !g.resolved));
  }

  if (!activeSite) return null;

  return (
    <div style={{ maxWidth: "560px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Upload CampManager files</h1>
      <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
        Upload the Electric and/or Gas Utilities CSV exported from CampManager. Meters are matched to pitches by
        the Site column — any row that doesn't match a known pitch is flagged, not silently dropped.
      </p>
      <div style={{ ...cardStyle, padding: "18px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxWidth: "360px" }}>
          <label style={{ fontSize: "13px" }}>
            Electric Utilities CSV
            <input type="file" accept=".csv" onChange={(e) => setElectricFile(e.target.files?.[0] || null)} style={{ display: "block", marginTop: "4px" }} />
          </label>
          <label style={{ fontSize: "13px" }}>
            Gas Utilities CSV
            <input type="file" accept=".csv" onChange={(e) => setGasFile(e.target.files?.[0] || null)} style={{ display: "block", marginTop: "4px" }} />
          </label>
          <button
            type="button"
            onClick={handleImport}
            disabled={importing || (!electricFile && !gasFile)}
            style={{ ...buttonStyle.primary, opacity: importing || (!electricFile && !gasFile) ? 0.6 : 1 }}
          >
            {importing ? "Importing…" : "Import"}
          </button>
        </div>

        {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

        {result && (
          <div style={{ marginTop: "12px", fontSize: "13px", color: colors.inkSoft }}>
            <p>
              Imported {result.inserted_count} meter row{result.inserted_count === 1 ? "" : "s"}
              {result.duplicate_group_count > 0 ? `, found ${result.duplicate_group_count} duplicate pitch/type group(s)` : ""}.
            </p>
            {result.unmatched_site_codes?.length > 0 && (
              <p style={{ color: colors.immediate }}>
                These Site codes didn't match a known pitch and were skipped: {result.unmatched_site_codes.join(", ")}
              </p>
            )}
          </div>
        )}
      </div>

      {duplicateGroups.length > 0 && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, margin: 0 }}>
            Review duplicate meters
          </h2>
          {duplicateGroups.map((group) => (
            <DuplicateGroupCard key={group.id} group={group} batchId={result.batch_id} onResolved={handleGroupResolved} />
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicateGroupCard({ group, batchId, onResolved }) {
  const [candidates, setCandidates] = useState([]);
  const [chosen, setChosen] = useState(group.chosen_meter_id);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    fetchMeterCandidatesForGroup(group.pitch_id, group.meter_type, batchId).then(setCandidates);
  }, [group.pitch_id, group.meter_type, batchId]);

  async function handleResolve() {
    setResolving(true);
    try {
      await resolveDuplicateGroup(group.id, chosen);
      onResolved();
    } catch (err) {
      console.error("Failed to resolve duplicate group", err);
    } finally {
      setResolving(false);
    }
  }

  return (
    <div style={{ ...cardStyle, border: `1px solid ${colors.lineStrong}`, padding: "12px" }}>
      <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "8px" }}>
        {group.pitches?.pitch_number_or_name} · {group.meter_type === "electric" ? "Electric" : "Gas"} — {candidates.length} meter records
      </div>
      {candidates.map((c) => (
        <label key={c.external_meter_id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "4px 0" }}>
          <input
            type="radio"
            name={`group-${group.id}`}
            checked={chosen === c.external_meter_id}
            onChange={() => setChosen(c.external_meter_id)}
          />
          <span>
            #{c.external_meter_id} — {c.make || ""} {c.model || ""}
            {!c.connected && " · Disconnected"}
            {c.last_read_date && ` · last read ${new Date(c.last_read_date).toLocaleDateString("en-GB")}`}
            {c.last_reading != null && ` (${c.last_reading})`}
          </span>
        </label>
      ))}
      <button
        type="button"
        onClick={handleResolve}
        disabled={resolving}
        style={{ ...buttonStyle.secondary, marginTop: "8px", fontSize: "13px", padding: "6px 14px" }}
      >
        {resolving ? "Saving…" : "Confirm"}
      </button>
    </div>
  );
}
