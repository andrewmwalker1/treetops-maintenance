import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { usePermissions } from "../../lib/permissions.js";
import { supabase } from "../../lib/supabaseClient.js";
import { colors } from "../../lib/theme.js";
import { Button, Card, EmptyState, PageHeader, SkeletonList } from "../../ui/index.js";
import { DEFAULT_AREA_SEASON_MAP, personFullName } from "./calculations.js";
import { generateDocument } from "./generateDocument.js";
import { CardTitle, Step1Import, Step2Price, Step3Instructions, Step4Generate } from "./steps.jsx";

const STEPS = [
  { key: 1, label: "1. Import & contact details" },
  { key: 2, label: "2. Price breakdown" },
  { key: 3, label: "3. Special instructions" },
  { key: 4, label: "4. Generate" },
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

function DraftsPanel({ drafts, onResume, onDiscard }) {
  return (
    <Card pad="md" style={{ padding: "16px 24px", marginBottom: 16 }}>
      <CardTitle>Saved drafts</CardTitle>
      <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, margin: 0 }}>
        Shared with anyone who has access to this tool — pick one up from any computer, or save before stepping away from an interrupted sale.
      </p>
      {drafts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {drafts.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "10px 14px", background: colors.surfaceHover, border: `1px solid ${colors.line}`, borderRadius: "var(--radius-sm)", marginBottom: 8, flexWrap: "wrap" }}>
              <div>
                <strong>{d.unit_site || "(no pitch)"}</strong>{" "}
                <span style={{ color: colors.inkSoft }}>{d.customer_name}</span>
                <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>Saved {new Date(d.saved_at).toLocaleString("en-GB")}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button onClick={() => onResume(d)}>Resume</Button>
                <Button variant="danger" onClick={() => onDiscard(d)}>Delete</Button>
              </div>
            </div>
          ))}
        </div>
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
  const [standardInstructions, setStandardInstructions] = useState([]);

  const [step, setStep] = useState(1);
  // Tracks the furthest step reached, separately from which one's
  // currently shown -- lets the step pills act as real back/forward
  // navigation (click an earlier one to revisit it) without allowing a
  // jump ahead to a step whose data (e.g. wizard.price) doesn't exist
  // yet.
  const [maxStepReached, setMaxStepReached] = useState(1);
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
      supabase.from("license_agreement_standard_instructions").select("*").eq("org_id", org.id).order("sort_order"),
    ]).then(([pf, as, settings, dr, si]) => {
      setPitchBandsTable(pf.data || []);
      if (as.data && as.data.length) setAreaSeasonMap(as.data.map((r) => ({ prefix: r.prefix, seasonLength: Number(r.season_length) })));
      setRatesFullYearDefault(settings.data?.rates_full_year ?? "");
      setTemplateStoragePath(settings.data?.template_storage_path ?? null);
      setDrafts(dr.data || []);
      setStandardInstructions(si.data || []);
      setLoading(false);
    });
  }, [org, permissions]);

  // The wizard now swaps one step's content for another instead of the
  // original single scrolling page -- without this, moving to the next
  // (or a previous) step leaves the view wherever it happened to be
  // scrolled to on the last one, rather than starting at the top of the
  // new content. Layout.jsx's scrollable region is <main class="tt-main">,
  // not the window itself.
  useEffect(() => {
    document.querySelector(".tt-main")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  }, [step]);

  if (!permissions.has("can_use_license_agreement")) {
    return <EmptyState title="No access">You don't have permission to use the License Agreement Builder. Ask an admin to grant it in Roles &amp; Permissions.</EmptyState>;
  }
  if (loading) return <SkeletonList rows={3} height={80} />;

  function startNew() {
    setWizard(BLANK_WIZARD);
    setStep(1);
    setMaxStepReached(1);
    setGenerateError("");
    setGenerateSuccess("");
  }

  function goToStep(n) {
    setStep(n);
    setMaxStepReached((m) => Math.max(m, n));
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
    // A recalled agreement already has all the data every step needs
    // (the sale was selected, so price etc. exist) -- jump to any step
    // freely instead of the sequential unlock a fresh sale gets.
    setStep(Math.min(savedStep || STEPS.length, STEPS.length));
    setMaxStepReached(STEPS.length);
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
      <PageHeader title="License Agreement Builder" level={2} />
      {step === 1 && <DraftsPanel drafts={drafts} onResume={resumeDraft} onDiscard={discardDraft} />}
      {wizard.selectedRow && (
        <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <Button variant="primary" onClick={saveDraft}>💾 Save as draft</Button>
          <Button onClick={startNew}>Start a new sale</Button>
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        {STEPS.map((s) => {
          const isActive = step === s.key;
          const isDone = step > s.key;
          const reachable = s.key <= maxStepReached;
          return (
            <Button
              key={s.key}
              disabled={!reachable}
              onClick={() => goToStep(s.key)}
              style={{
                fontSize: "var(--text-xs)", fontWeight: 600, padding: "5px 12px", borderRadius: "var(--radius-full)",
                border: `1px solid ${isActive ? colors.moss : isDone ? colors.okBorder : colors.line}`,
                background: isActive ? colors.moss : isDone ? colors.okSurface : colors.paper,
                color: isActive ? colors.onDark : isDone ? colors.okInk : colors.inkSoft,
                opacity: reachable ? 1 : 0.6,
              }}
            >
              {s.label}
            </Button>
          );
        })}
      </div>

      {step === 1 && (
        <Step1Import
          wizard={wizard}
          setWizard={setWizard}
          areaSeasonMap={areaSeasonMap}
          ratesFullYearDefault={ratesFullYearDefault}
          onContinue={() => goToStep(2)}
        />
      )}
      {step === 2 && <Step2Price wizard={wizard} setWizard={setWizard} pitchBandsTable={pitchBandsTable} onContinue={() => goToStep(3)} />}
      {step === 3 && (
        <Step3Instructions
          wizard={wizard}
          setWizard={setWizard}
          permissions={permissions}
          standardInstructions={standardInstructions}
          onStandardInstructionsChanged={setStandardInstructions}
          onContinue={() => goToStep(4)}
        />
      )}
      {step === 4 && (
        <Step4Generate
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
