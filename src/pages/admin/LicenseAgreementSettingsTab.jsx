import { useEffect, useState } from "react";
import Papa from "papaparse";
import PizZip from "pizzip";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Input, PageHeader } from "../../ui/index.js";
import { parsePitchBandsCsv } from "../license-agreement/calculations.js";
import { convertTemplateDocx } from "../license-agreement/templateConverter.js";

const TEMPLATE_BUCKET = "license-agreement-files";

// Native DOMParser reports XML errors via a <parsererror> element in the
// returned document, not a callback/exception - matching the original
// tool's browser-side validator exactly.
function validateXmlBrowser(xml) {
  const parsed = new DOMParser().parseFromString(xml, "text/xml");
  const errorNode = parsed.querySelector("parsererror");
  return errorNode ? [errorNode.textContent.replace(/\s+/g, " ").trim()] : [];
}

export default function LicenseAgreementSettingsTab() {
  const { org } = useAuth();
  const [pitchFees, setPitchFees] = useState([]);
  const [areaSeasons, setAreaSeasons] = useState([]);
  const [ratesFullYear, setRatesFullYear] = useState("");
  const [importError, setImportError] = useState("");
  const [newArea, setNewArea] = useState({ prefix: "", season_length: 9 });
  const [templateInfo, setTemplateInfo] = useState(null); // { fileName, uploadedAt } or null = built-in
  const [templateUploading, setTemplateUploading] = useState(false);
  const [templateError, setTemplateError] = useState("");

  function refresh() {
    Promise.all([
      supabase.from("license_agreement_pitch_fees").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("license_agreement_area_seasons").select("*").eq("org_id", org.id).order("prefix"),
      supabase.from("license_agreement_settings").select("*").eq("org_id", org.id).maybeSingle(),
    ]).then(([pf, as, settings]) => {
      setPitchFees(pf.data || []);
      setAreaSeasons(as.data || []);
      setRatesFullYear(settings.data?.rates_full_year ?? "");
      setTemplateInfo(
        settings.data?.template_storage_path
          ? { fileName: settings.data.template_file_name, uploadedAt: settings.data.template_uploaded_at }
          : null
      );
    });
  }
  useEffect(refresh, [org]);

  async function handleTemplateUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setTemplateError("");
    setTemplateUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const { zip } = convertTemplateDocx(buf, PizZip, validateXmlBrowser);
      const converted = zip.generate({ type: "arraybuffer" });

      const path = `${org.id}/template-${Date.now()}.docx`;
      const { error: uploadError } = await supabase.storage.from(TEMPLATE_BUCKET).upload(path, converted, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      if (uploadError) throw new Error(uploadError.message);

      const uploadedAt = new Date().toISOString();
      const { error: settingsError } = await supabase.from("license_agreement_settings").upsert({
        org_id: org.id,
        template_storage_path: path,
        template_file_name: file.name,
        template_uploaded_at: uploadedAt,
      });
      if (settingsError) throw new Error(settingsError.message);

      setTemplateInfo({ fileName: file.name, uploadedAt });
    } catch (err) {
      setTemplateError(
        "Couldn't convert that document: " + (err.message || String(err)) + " — the previous template is still in use."
      );
    } finally {
      setTemplateUploading(false);
    }
  }

  async function revertToBuiltInTemplate() {
    setTemplateError("");
    await supabase.from("license_agreement_settings").upsert({
      org_id: org.id,
      template_storage_path: null,
      template_file_name: null,
      template_uploaded_at: null,
    });
    setTemplateInfo(null);
  }

  async function handlePitchFeesUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError("");
    const text = await file.text();
    let rows;
    try {
      rows = parsePitchBandsCsv(text, Papa);
    } catch (err) {
      setImportError("Couldn't read that file: " + err.message);
      return;
    }
    if (rows.length === 0) {
      setImportError("No valid rows found in that file (expects no header row, at least 7 columns per row).");
      return;
    }
    await supabase.from("license_agreement_pitch_fees").delete().eq("org_id", org.id);
    const { error } = await supabase.from("license_agreement_pitch_fees").insert(
      rows.map((r, i) => ({ org_id: org.id, description: r.description, net_price: r.net_price, gross_price: r.gross_price, sort_order: i }))
    );
    if (error) setImportError(error.message);
    else refresh();
  }

  async function deletePitchFeeRow(id) {
    setPitchFees(pitchFees.filter((r) => r.id !== id));
    await supabase.from("license_agreement_pitch_fees").delete().eq("id", id);
  }

  async function addArea() {
    if (!newArea.prefix.trim()) return;
    const { data } = await supabase
      .from("license_agreement_area_seasons")
      .insert({ org_id: org.id, prefix: newArea.prefix.trim().toUpperCase(), season_length: newArea.season_length })
      .select().single();
    if (data) setAreaSeasons([...areaSeasons, data].sort((a, b) => a.prefix.localeCompare(b.prefix)));
    setNewArea({ prefix: "", season_length: 9 });
  }

  async function updateAreaSeason(id, season_length) {
    setAreaSeasons(areaSeasons.map((a) => (a.id === id ? { ...a, season_length } : a)));
    await supabase.from("license_agreement_area_seasons").update({ season_length }).eq("id", id);
  }

  async function removeArea(id) {
    setAreaSeasons(areaSeasons.filter((a) => a.id !== id));
    await supabase.from("license_agreement_area_seasons").delete().eq("id", id);
  }

  async function saveRatesFullYear() {
    await supabase.from("license_agreement_settings").upsert({ org_id: org.id, rates_full_year: ratesFullYear || null });
  }

  return (
    <div>
      <PageHeader title="License agreement settings" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Shared by everyone using the License Agreement Builder — one Pitch Fees table, one area→season mapping, one Rates default for the whole team.
      </p>

      <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
        <PageHeader title="Pitch Fees table (annual — re-import each year)" level={2} />
        <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
          Import the same CSV export Tree Tops issues each year (no header row). Importing replaces the whole table.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={handlePitchFeesUpload} />
        {importError && <Alert tone="danger" title="Import failed">{importError}</Alert>}
        {pitchFees.length === 0 ? (
          <EmptyState title="No Pitch Fees table imported yet" />
        ) : (
          <div style={{ marginTop: "var(--space-3)" }}>
            {pitchFees.map((r) => (
              <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: "var(--space-2)", padding: "6px 0", borderBottom: `1px solid ${colors.line}` }}>
                <span>{r.description}</span>
                <span style={{ display: "flex", gap: "var(--space-3)" }}>
                  <span>£{Number(r.gross_price).toFixed(2)}</span>
                  <Button variant="danger" onClick={() => deletePitchFeeRow(r.id)}>✕</Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
        <PageHeader title="Season length by area" level={2} />
        <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
          The first two letters of the pitch number (e.g. "OP" in OP-E16) set the default pitch fee season for that area — overridable per-sale in the wizard.
        </p>
        {areaSeasons.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
            <strong style={{ width: 50 }}>{a.prefix}</strong>
            {[9, 10.5].map((len) => (
              <label key={len} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
                <input type="radio" checked={Number(a.season_length) === len} onChange={() => updateAreaSeason(a.id, len)} /> {len} months
              </label>
            ))}
            <Button variant="danger" onClick={() => removeArea(a.id)}>Remove</Button>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "flex-end", gap: "var(--space-2)" }}>
          <Input placeholder="e.g. OP" maxLength={4} style={{ width: 100 }} value={newArea.prefix} onChange={(e) => setNewArea({ ...newArea, prefix: e.target.value })} />
          {[9, 10.5].map((len) => (
            <label key={len} style={{ display: "flex", alignItems: "center", gap: "var(--space-1)" }}>
              <input type="radio" checked={newArea.season_length === len} onChange={() => setNewArea({ ...newArea, season_length: len })} /> {len} months
            </label>
          ))}
          <Button variant="primary" onClick={addArea}>+ Add area</Button>
        </div>
      </Card>

      <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
        <PageHeader title="Rates full-year default" level={2} />
        <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
          Carried over as the starting figure for the next sale in the wizard — not banded or apportioned, just a running default.
        </p>
        <div style={{ display: "flex", gap: "var(--space-2)", maxWidth: 260 }}>
          <Input type="number" step="0.01" min="0" placeholder="0.00" value={ratesFullYear} onChange={(e) => setRatesFullYear(e.target.value)} />
          <Button variant="primary" onClick={saveRatesFullYear}>Save</Button>
        </div>
      </Card>

      <Card pad="md">
        <PageHeader title="Template document" level={2} />
        <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
          Wording, formatting or legal-text changes to the Purchase &amp; Licence Agreement: edit the document as usual
          in Word, then upload it here — it's converted automatically and used for every document generated after
          that. Don't upload a document with different tables, fields or a restructured signature block; the
          converter checks the layout it expects and will show an error rather than risk a wrong document.
        </p>
        <input type="file" accept=".docx" onChange={handleTemplateUpload} disabled={templateUploading} />
        <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>
          {templateUploading
            ? "Converting…"
            : templateInfo
              ? `Using ${templateInfo.fileName}, converted ${new Date(templateInfo.uploadedAt).toLocaleString("en-GB")}.`
              : "Using the built-in template."}
        </p>
        {templateError && <Alert tone="danger" title="Conversion failed">{templateError}</Alert>}
        {templateInfo && <Button onClick={revertToBuiltInTemplate}>Revert to the built-in template</Button>}
      </Card>
    </div>
  );
}
