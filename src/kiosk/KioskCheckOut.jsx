import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { getEquipmentTypeAvailabilityCounts, getAvailableUnits } from "../lib/equipmentAvailability.js";
import ChecklistBuilder from "../components/ChecklistBuilder.jsx";
import ReportIssueForm from "./ReportIssueForm.jsx";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskDangerButtonStyle, kioskCardStyle } from "./kioskTheme.js";

export default function KioskCheckOut() {
  const navigate = useNavigate();
  const { profile, org } = useAuth();
  const [view, setView] = useState("categories"); // categories | units | confirm | results
  const [categories, setCategories] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [units, setUnits] = useState([]);
  // Holds one id for an ordinary checkout, several for a multi-checkout
  // type -- the confirm/checkout logic below doesn't distinguish the two,
  // only the "units" screen's selection UI does.
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reportingIssueFor, setReportingIssueFor] = useState(null); // unit id, or null
  const [checkoutOutcome, setCheckoutOutcome] = useState(null); // set only when a multi checkout partially failed
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [showSafety, setShowSafety] = useState(false);

  useEffect(() => {
    if (!org) return;
    getEquipmentTypeAvailabilityCounts(org.id).then(setCategories);
  }, [org]);

  function openCategory(type) {
    if (type.availableCount === 0) return;
    setError(null);
    setSelectedType(type);
    setSelectedIds(new Set());
    setCheckoutOutcome(null);
    setShowSafety(false);
    getAvailableUnits(type.id).then((u) => {
      setUnits(u);
      setView("units");
    });
  }

  // Ordinary (non multi-checkout) flow: tapping a unit goes straight to
  // confirm, same as before multi-checkout existed.
  function selectUnit(unit) {
    setError(null);
    setReportingIssueFor(null);
    setSelectedIds(new Set([unit.id]));
    setView("confirm");
  }

  function toggleUnit(unitId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  }

  function backToCategories() {
    setView("categories");
    setSelectedType(null);
    setSelectedIds(new Set());
    setReportingIssueFor(null);
    setCheckoutOutcome(null);
    setShowSafety(false);
    if (org) getEquipmentTypeAvailabilityCounts(org.id).then(setCategories);
  }

  // Best-effort: each selected unit is checked out independently, so one
  // taken by someone else in the meantime doesn't block the rest.
  async function handleCheckOut() {
    setBusy(true);
    setError(null);
    const ids = [...selectedIds];
    const attempts = await Promise.all(
      ids.map(async (id) => {
        const { error: err } = await supabase.from("equipment_checkouts").insert({ equipment_id: id, profile_id: profile.id });
        return { id, err };
      })
    );
    setBusy(false);

    const failed = attempts.filter((a) => a.err);
    if (failed.length === 0) {
      navigate("/kiosk");
      return;
    }

    const succeededIds = new Set(attempts.filter((a) => !a.err).map((a) => a.id));
    setCheckoutOutcome({
      succeeded: units.filter((u) => succeededIds.has(u.id)),
      failed: failed.map((f) => ({
        unit: units.find((u) => u.id === f.id),
        message: f.err.code === "23505" ? "Just taken by someone else" : f.err.message,
      })),
    });
    setView("results");
  }

  // Filing a fault for one selected-but-not-yet-checked-out unit -- same
  // RPC and same "no checkout to close" shape as reporting an issue on a
  // single ordinary checkout always has. Drops that unit from the
  // selection and the available list; if nothing's left selected, there's
  // nothing to confirm, so fall back to the units screen.
  async function handleReportIssue(unitId, description) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("report_equipment_fault", {
      p_equipment_id: unitId,
      p_description: description,
      p_close_checkout_id: null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setReportingIssueFor(null);
    setUnits((prev) => prev.filter((u) => u.id !== unitId));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(unitId);
      if (next.size === 0) setView("units");
      return next;
    });
  }

  if (view === "results" && checkoutOutcome) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Check-out results</h1>

        {checkoutOutcome.succeeded.length > 0 && (
          <div style={{ ...kioskCardStyle, marginBottom: "14px" }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginTop: 0 }}>Checked out</h2>
            {checkoutOutcome.succeeded.map((u) => (
              <p key={u.id} style={{ fontSize: "17px", margin: "6px 0" }}>{u.name}</p>
            ))}
          </div>
        )}

        {checkoutOutcome.failed.length > 0 && (
          <div style={{ ...kioskCardStyle, marginBottom: "20px", border: `2px solid ${colors.immediate}` }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.immediate, marginTop: 0 }}>Not checked out</h2>
            {checkoutOutcome.failed.map((f) => (
              <p key={f.unit?.id || f.message} style={{ fontSize: "17px", margin: "6px 0" }}>
                {f.unit?.name || "Unit"} — {f.message}
              </p>
            ))}
          </div>
        )}

        <button style={kioskButtonStyle} onClick={() => navigate("/kiosk")}>Done</button>
      </div>
    );
  }

  if (view === "confirm") {
    const selected = units.filter((u) => selectedIds.has(u.id));
    const reportingUnit = reportingIssueFor ? selected.find((u) => u.id === reportingIssueFor) : null;

    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button
          style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
          onClick={() => setView("units")}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{selectedType.name}</h1>

        {selectedType.preUseChecklist.length > 0 && (
          <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginTop: 0 }}>Before you take it</h2>
            <ChecklistBuilder items={selectedType.preUseChecklist} onChange={() => {}} readOnly />
          </div>
        )}

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        {reportingUnit ? (
          <>
            <p style={{ fontFamily: fonts.body, fontSize: "16px", color: colors.inkSoft }}>
              Reporting an issue with <strong>{reportingUnit.name}</strong>
            </p>
            <ReportIssueForm
              equipmentTypeId={selectedType.id}
              onSubmit={(description) => handleReportIssue(reportingUnit.id, description)}
              onCancel={() => setReportingIssueFor(null)}
              submitting={busy}
            />
          </>
        ) : (
          <>
            {selected.length > 1 && (
              <div style={{ ...kioskCardStyle, marginBottom: "16px" }}>
                <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>
                  Taking {selected.length}
                </h2>
                {selected.map((u) => (
                  <div
                    key={u.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: `1px solid ${colors.line}`,
                    }}
                  >
                    <span style={{ fontSize: "17px" }}>{u.name}</span>
                    <button
                      onClick={() => setReportingIssueFor(u.id)}
                      disabled={busy}
                      style={{ background: "none", border: "none", color: colors.immediate, fontSize: "14px", textDecoration: "underline", cursor: "pointer" }}
                    >
                      Report issue
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <button style={kioskButtonStyle} onClick={handleCheckOut} disabled={busy}>
                {busy ? "Checking out…" : selected.length > 1 ? `Check Out Selected (${selected.length})` : "Check Out"}
              </button>
              {selected.length === 1 && (
                <button style={kioskDangerButtonStyle} onClick={() => setReportingIssueFor(selected[0].id)} disabled={busy}>
                  Report an Issue
                </button>
              )}
              <button style={kioskSecondaryButtonStyle} onClick={() => setView("units")} disabled={busy}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  if (view === "units") {
    const multi = selectedType.allowMultiCheckout;
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto", paddingBottom: multi ? "110px" : "24px", boxSizing: "border-box" }}>
        <button
          style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
          onClick={backToCategories}
        >
          ← Categories
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{selectedType.name}</h1>
        {selectedType.documents.length > 0 && (
          <button
            type="button"
            onClick={() => setShowSafety(true)}
            style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "16px", borderColor: colors.immediate, color: colors.immediate }}
          >
            ⚠ Health &amp; Safety
          </button>
        )}
        {multi && units.length > 0 && (
          <p style={{ color: colors.inkSoft, marginTop: "-8px" }}>Tick everything you need, then continue.</p>
        )}
        {units.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing available right now.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {units.map((u) =>
            multi ? (
              <label
                key={u.id}
                style={{
                  ...kioskButtonStyle,
                  background: selectedIds.has(u.id) ? colors.mossDark : "transparent",
                  color: selectedIds.has(u.id) ? "#FFFFFF" : colors.mossDark,
                  border: `2px solid ${colors.mossDark}`,
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(u.id)}
                  onChange={() => toggleUnit(u.id)}
                  style={{ width: "26px", height: "26px", flexShrink: 0 }}
                />
                {u.name}
              </label>
            ) : (
              <button key={u.id} style={kioskButtonStyle} onClick={() => selectUnit(u)}>{u.name}</button>
            )
          )}
        </div>
        {multi && (
          <div
            style={{
              position: "fixed",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "16px 24px",
              background: colors.paper,
              borderTop: `1px solid ${colors.line}`,
              boxSizing: "border-box",
            }}
          >
            <button
              style={{ ...kioskButtonStyle, maxWidth: "592px", margin: "0 auto", display: "block", opacity: selectedIds.size === 0 ? 0.5 : 1 }}
              onClick={() => selectedIds.size > 0 && setView("confirm")}
              disabled={selectedIds.size === 0}
            >
              Continue{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
          </div>
        )}

        {showSafety && (
          <div
            style={{ position: "fixed", inset: 0, background: "rgba(20, 40, 64, 0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 200 }}
            onClick={() => setShowSafety(false)}
          >
            <div style={{ ...kioskCardStyle, maxWidth: "560px", width: "100%", maxHeight: "80vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
              <h2 style={{ fontFamily: fonts.display, fontSize: "20px", color: colors.mossDark, marginTop: 0 }}>⚠ Health &amp; Safety — {selectedType.name}</h2>
              {selectedType.documents.map((doc) => (
                <SafetyDocumentLink key={doc.id} doc={doc} />
              ))}
              <button type="button" style={{ ...kioskSecondaryButtonStyle, marginTop: "16px" }} onClick={() => setShowSafety(false)}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <button
        style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
        onClick={() => navigate("/kiosk")}
      >
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Check-out Kit</h1>
      {categories.length === 0 && <p style={{ color: colors.inkSoft }}>No equipment types set up yet.</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => openCategory(c)}
            disabled={c.availableCount === 0}
            style={{
              ...kioskButtonStyle,
              opacity: c.availableCount === 0 ? 0.45 : 1,
              cursor: c.availableCount === 0 ? "not-allowed" : "pointer",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            }}
          >
            <span>{c.name}</span>
            <span style={{ fontSize: "14px", fontWeight: 400 }}>{c.availableCount} available</span>
          </button>
        ))}
      </div>
    </div>
  );
}
