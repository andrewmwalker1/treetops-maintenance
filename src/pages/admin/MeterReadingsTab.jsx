import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import {
  importMeterCsvFiles,
  fetchDuplicateGroups,
  fetchMeterCandidatesForGroup,
  resolveDuplicateGroup,
} from "../../lib/meterImport.js";
import { exportMeterReadingsCsvs } from "../../lib/meterExport.js";
import { fetchActiveMeters } from "../../lib/meterReadingsQuery.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

export default function MeterReadingsTab() {
  const { profile, org, activeSite } = useAuth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <ImportSection profile={profile} org={org} activeSite={activeSite} />
      <ExportSection profile={profile} org={org} activeSite={activeSite} />
      <SettingsSection activeSite={activeSite} />
      <LabelsSection activeSite={activeSite} />
    </div>
  );
}

function SectionCard({ title, children }) {
  return (
    <div style={{ ...cardStyle, padding: "18px" }}>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>{title}</h2>
      {children}
    </div>
  );
}

function ImportSection({ profile, org, activeSite }) {
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

  async function handleGroupResolved(groupId) {
    const groups = await fetchDuplicateGroups(result.batch_id);
    setDuplicateGroups(groups.filter((g) => !g.resolved));
  }

  return (
    <SectionCard title="Import CampManager files">
      <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
        Upload the Electric and/or Gas Utilities CSV exported from CampManager. Meters are matched to pitches by
        the Site column — any row that doesn't match a known pitch is flagged, not silently dropped.
      </p>
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

      {duplicateGroups.length > 0 && (
        <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ fontFamily: fonts.display, fontSize: "14px", color: colors.mossDark, margin: 0 }}>
            Review duplicate meters
          </h3>
          {duplicateGroups.map((group) => (
            <DuplicateGroupCard key={group.id} group={group} batchId={result.batch_id} onResolved={() => handleGroupResolved(group.id)} />
          ))}
        </div>
      )}
    </SectionCard>
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
    <div style={{ border: `1px solid ${colors.lineStrong}`, borderRadius: "10px", padding: "12px" }}>
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

function ExportSection({ profile, org, activeSite }) {
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      const data = await exportMeterReadingsCsvs({ orgId: org.id, siteId: activeSite.id, profileId: profile.id });
      setResult(data);
    } catch (err) {
      console.error("Export failed", err);
      setError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <SectionCard title="Export for CampManager">
      <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
        Downloads both CSVs in CampManager's own format with New Reading Date/New Reading filled in for every
        meter read since the last export. Marks those readings as exported and updates each meter's last reading.
      </p>
      <button type="button" onClick={handleExport} disabled={exporting} style={{ ...buttonStyle.primary, opacity: exporting ? 0.6 : 1 }}>
        {exporting ? "Exporting…" : "Export CSVs"}
      </button>
      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}
      {result && (
        <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
          Exported {result.readingsExported} reading{result.readingsExported === 1 ? "" : "s"} across{" "}
          {result.electricRowCount} electric and {result.gasRowCount} gas meter rows.
        </p>
      )}
    </SectionCard>
  );
}

function SettingsSection({ activeSite }) {
  const [electricCost, setElectricCost] = useState("");
  const [gasCost, setGasCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!activeSite) return;
    supabase
      .from("meter_reading_settings")
      .select("electric_unit_cost, gas_unit_cost")
      .eq("site_id", activeSite.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setElectricCost(data.electric_unit_cost ?? "");
          setGasCost(data.gas_unit_cost ?? "");
        }
      });
  }, [activeSite]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from("meter_reading_settings")
      .upsert({ site_id: activeSite.id, electric_unit_cost: electricCost || null, gas_unit_cost: gasCost || null }, { onConflict: "site_id" });
    setSaving(false);
    if (error) {
      console.error("Failed to save unit costs", error);
    } else {
      setSaved(true);
    }
  }

  return (
    <SectionCard title="Unit costs">
      <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
        Used only for the estimated £ shown on the confirm screen as a sanity check — not for actual billing.
      </p>
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", maxWidth: "360px" }}>
        <label style={{ fontSize: "13px", flex: 1 }}>
          Electric £/unit
          <input type="number" step="0.01" value={electricCost} onChange={(e) => setElectricCost(e.target.value)} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${colors.lineStrong}`, marginTop: "4px" }} />
        </label>
        <label style={{ fontSize: "13px", flex: 1 }}>
          Gas £/unit
          <input type="number" step="0.01" value={gasCost} onChange={(e) => setGasCost(e.target.value)} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "8px", border: `1px solid ${colors.lineStrong}`, marginTop: "4px" }} />
        </label>
      </div>
      <button type="button" onClick={handleSave} disabled={saving} style={{ ...buttonStyle.secondary, marginTop: "10px" }}>
        {saving ? "Saving…" : saved ? "Saved" : "Save"}
      </button>
    </SectionCard>
  );
}

function LabelsSection({ activeSite }) {
  const [meters, setMeters] = useState([]);
  const [labels, setLabels] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!activeSite) return;
    fetchActiveMeters(activeSite.id).then(setMeters);
  }, [activeSite]);

  async function handleGenerate() {
    setGenerating(true);
    const generated = await Promise.all(
      meters.map(async (m) => ({
        qr: await QRCode.toDataURL(m.qr_code, { margin: 1, width: 160 }),
        label: `${m.pitches?.pitch_number_or_name} · ${m.meter_type === "electric" ? "Electric" : "Gas"}`,
        code: m.qr_code,
      }))
    );
    setLabels(generated);
    setGenerating(false);
  }

  return (
    <SectionCard title="Print QR labels">
      <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
        Generates one QR code per active meter, encoding the pitch + meter type directly (e.g. PN-C01-ELEC) — no
        lookup table needed, so a faded label can be reprinted identically. Plain paper is fine for the pilot.
      </p>
      <button type="button" onClick={handleGenerate} disabled={generating || meters.length === 0} style={buttonStyle.secondary}>
        {generating ? "Generating…" : `Generate ${meters.length} label${meters.length === 1 ? "" : "s"}`}
      </button>
      {labels.length > 0 && (
        <>
          <button type="button" onClick={() => window.print()} style={{ ...buttonStyle.primary, marginLeft: "10px" }}>
            Print
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px", marginTop: "16px" }}>
            {labels.map((l) => (
              <div key={l.code} style={{ textAlign: "center", border: `1px solid ${colors.line}`, borderRadius: "8px", padding: "8px" }}>
                <img src={l.qr} alt={l.code} style={{ width: "100%" }} />
                <div style={{ fontSize: "12px", marginTop: "4px" }}>{l.label}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}
