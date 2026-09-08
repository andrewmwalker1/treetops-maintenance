import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { usePermissions } from "../../lib/permissions.js";
import { supabase } from "../../lib/supabaseClient.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, PageHeader, SkeletonList } from "../../ui/index.js";
import { DEFAULT_AREA_SEASON_MAP, personFullName } from "./calculations.js";
import { generateDocument } from "./generateDocument.js";
import { Step1Import, Step2Price, Step3Instructions, Step4Signees, Step5Generate } from "./steps.jsx";

const STEPS = [
  { key: 1, label: "1. Import &amp; contact details" },
  { key: 2, label: "2. Price breakdown" },
  { key: 3, label: "3. Special instructions" },
  { key: 4, label: "4. Signees" },
  { key: 5, label: "5. Generate" },
];

const BLANK_WIZARD = {
  selectedRow: null,
  customer: {},
  people: [],
  peopleAutoSwapped: false,
  price: null,
  unit: { pitchBand: "", licenceStart: "", licenceEnd: "" },
  originalUnit: { pitchBand: "", licenceStart: "", licenceEnd: "" },
  seasonLength: 9,
  buildSpec: "EN 1647",
  firstOwner: "no",
  specialTerms: "None",
};

function DraftsPanel({ drafts, onResume, onDiscard, onSaveNow, canSave }) {
  return (
    <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <PageHeader title="Saved drafts" level={2} />
        <Button variant="primary" disabled={!canSave} onClick={onSaveNow}>💾 Save as draft</Button>
      </div>
      <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: 0 }}>
        Shared with anyone who has access to this tool — pick one up from any computer, or save progress here before stepping away from an interrupted sale.
      </p>
      {drafts.length === 0 ? (
        <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>No saved drafts yet.</p>
      ) : (
        drafts.map((d) => (
          <Card pad="sm" key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
            <div>
              <strong>{d.unit_site || "(no pitch)"}</strong>{" "}
              <span style={{ color: colors.inkSoft }}>{d.customer_name}</span>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>Saved {new Date(d.saved_at).toLocaleString("en-GB")}</div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={() => onResume(d)}>Resume</Button>
              <Button variant="danger" onClick={() => onDiscard(d)}>Delete</Button>
            </div>
          </Card>
        ))
      )}
    </Card>
  );
}

export default function LicenseAgreement() {
  const { org, profile } = useAuth();
  const permissions = usePermissions();
  const [loading, setLoading] = useState(true);
  const [pitchBandsTable, setPitchBandsTable] = useState([]);
  const [areaSeasonMap, setAreaSeasonMap] = useState(DEFAULT_AREA_SEASON_MAP);
  const [ratesFullYearDefault, setRatesFullYearDefault] = useState("");
  const [templateStoragePath, setTemplateStoragePath] = useState(null);
  const [drafts, setDrafts] = useState([]);

  const [step, setStep] = useState(1);
  const [wizard, setWizard] = useState(BLANK_WIZARD);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState("");
  const [generateSuccess, setGenerateSuccess] = useState("");

  useEffect(() => {
    if (!org || !permissions.has("can_use_license_agreement")) { setLoading(false); return; }
    Promise.all([
      supabase.from("license_agreement_pitch_fees").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("license_agreement_area_seasons").select("*").eq("org_id", org.id),
      supabase.from("license_agreement_settings").select("*").eq("org_id", org.id).maybeSingle(),
      supabase.from("license_agreement_drafts").select("*").eq("org_id", org.id).order("saved_at", { ascending: false }),
    ]).then(([pf, as, settings, dr]) => {
      setPitchBandsTable(pf.data || []);
      if (as.data && as.data.length) setAreaSeasonMap(as.data.map((r) => ({ prefix: r.prefix, seasonLength: Number(r.season_length) })));
      setRatesFullYearDefault(settings.data?.rates_full_year ?? "");
      setTemplateStoragePath(settings.data?.template_storage_path ?? null);
      setDrafts(dr.data || []);
      setLoading(false);
    });
  }, [org, permissions]);

  if (!permissions.has("can_use_license_agreement")) {
    return <EmptyState title="No access">You don't have permission to use the License Agreement Builder. Ask an admin to grant it in Roles &amp; Permissions.</EmptyState>;
  }
  if (loading) return <SkeletonList rows={3} height={80} />;

  function startNew() {
    setWizard(BLANK_WIZARD);
    setStep(1);
    setGenerateError("");
    setGenerateSuccess("");
  }

  async function saveDraft() {
    if (!wizard.selectedRow) return;
    const payload = {
      org_id: org.id,
      created_by: profile.id,
      unit_site: wizard.selectedRow["Unit Site"] || "",
      customer_name: wizard.people.map(personFullName).filter(Boolean).join(", "),
      data: { ...wizard, step },
    };
    const { data, error } = await supabase.from("license_agreement_drafts").insert(payload).select().single();
    if (!error && data) setDrafts([data, ...drafts]);
  }

  function resumeDraft(draft) {
    const { step: savedStep, ...savedWizard } = draft.data;
    setWizard(savedWizard);
    setStep(savedStep || 5);
    setGenerateError("");
    setGenerateSuccess("");
  }

  async function discardDraft(draft) {
    setDrafts(drafts.filter((d) => d.id !== draft.id));
    await supabase.from("license_agreement_drafts").delete().eq("id", draft.id);
  }

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError("");
    setGenerateSuccess("");
    try {
      const fileName = await generateDocument({ ...wizard, pitchBandsTable, templateStoragePath });
      if (fileName) setGenerateSuccess(fileName);
      // Rates full-year figure persists as next sale's default, same as the original tool.
      if (wizard.price.ratesFullYear && wizard.price.ratesFullYear !== ratesFullYearDefault) {
        setRatesFullYearDefault(wizard.price.ratesFullYear);
        supabase.from("license_agreement_settings").upsert({ org_id: org.id, rates_full_year: wizard.price.ratesFullYear });
      }
    } catch (err) {
      setGenerateError(err.message || String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <PageHeader title="License Agreement Builder" />
      <DraftsPanel drafts={drafts} onResume={resumeDraft} onDiscard={discardDraft} onSaveNow={saveDraft} canSave={!!wizard.selectedRow} />
      {wizard.selectedRow && (
        <Button onClick={startNew} style={{ marginBottom: "var(--space-3)" }}>Start a new sale</Button>
      )}

      <div style={{ display: "flex", gap: "var(--space-1)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        {STEPS.map((s) => (
          <span
            key={s.key}
            style={{
              padding: "6px 12px", borderRadius: "var(--radius-full)", fontSize: "var(--text-xs)", fontWeight: 700,
              background: step === s.key ? colors.moss : step > s.key ? colors.surfaceSunken : "transparent",
              color: step === s.key ? colors.onDark : colors.inkSoft,
            }}
          >
            {s.label}
          </span>
        ))}
      </div>

      {step === 1 && (
        <Step1Import
          wizard={wizard}
          setWizard={setWizard}
          areaSeasonMap={areaSeasonMap}
          ratesFullYearDefault={ratesFullYearDefault}
          onContinue={() => setStep(2)}
        />
      )}
      {step === 2 && <Step2Price wizard={wizard} setWizard={setWizard} pitchBandsTable={pitchBandsTable} onContinue={() => setStep(3)} />}
      {step === 3 && <Step3Instructions wizard={wizard} setWizard={setWizard} onContinue={() => setStep(4)} />}
      {step === 4 && <Step4Signees wizard={wizard} onContinue={() => setStep(5)} />}
      {step === 5 && (
        <Step5Generate
          wizard={wizard}
          generating={generating}
          generateError={generateError}
          generateSuccess={generateSuccess}
          onGenerate={handleGenerate}
        />
      )}
    </div>
  );
}
