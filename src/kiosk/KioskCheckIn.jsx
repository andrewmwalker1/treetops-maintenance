import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import ReportIssueForm from "./ReportIssueForm.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskDangerButtonStyle } from "./kioskTheme.js";

export default function KioskCheckIn() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [checkouts, setCheckouts] = useState([]);
  const [view, setView] = useState("list"); // list | confirm
  // Ticked multi-checkout-type items on the list screen, or the single
  // item tapped directly -- the confirm screen below doesn't distinguish
  // the two, only the list screen's row rendering does (checkbox vs a
  // plain tap-through button, mirroring KioskCheckOut's units screen).
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [reportingIssueFor, setReportingIssueFor] = useState(null); // checkout id, or null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    if (!profile) return;
    supabase
      .from("equipment_checkouts")
      .select("id, checked_out_at, equipment:equipment(id, name, equipment_type_id, equipment_type:equipment_types(id, name, allow_multi_checkout))")
      .eq("profile_id", profile.id)
      .is("checked_in_at", null)
      .order("checked_out_at")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setCheckouts(data || []);
      });
  }, [profile]);

  useEffect(refresh, [refresh]);

  function toggleSelect(checkoutId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(checkoutId)) next.delete(checkoutId);
      else next.add(checkoutId);
      return next;
    });
  }

  // Ordinary (non multi-checkout) flow: tapping an item goes straight to
  // confirm, same as before multi check-in existed.
  function openSingle(c) {
    setError(null);
    setReportingIssueFor(null);
    setSelectedIds(new Set([c.id]));
    setView("confirm");
  }

  function proceedWithSelected() {
    if (selectedIds.size === 0) return;
    setError(null);
    setReportingIssueFor(null);
    setView("confirm");
  }

  function backToList() {
    setView("list");
    setSelectedIds(new Set());
    setReportingIssueFor(null);
  }

  // Best-effort, same reasoning as KioskCheckOut's handleCheckOut -- each
  // selected checkout is closed independently.
  async function handleConfirmClean() {
    setBusy(true);
    setError(null);
    const ids = [...selectedIds];
    const attempts = await Promise.all(
      ids.map(async (id) => {
        const { error: err } = await supabase
          .from("equipment_checkouts")
          .update({ checked_in_at: new Date().toISOString(), checked_in_by: profile.id })
          .eq("id", id);
        return { id, err };
      })
    );
    setBusy(false);
    const failed = attempts.filter((a) => a.err);
    if (failed.length > 0) {
      setError(failed.map((f) => f.err.message).join("; "));
    }
    setSelectedIds(new Set());
    setView("list");
    refresh();
  }

  async function handleReportIssue(checkoutId, description) {
    const checkout = checkouts.find((c) => c.id === checkoutId);
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("report_equipment_fault", {
      p_equipment_id: checkout.equipment.id,
      p_description: description,
      p_close_checkout_id: checkoutId,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setReportingIssueFor(null);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(checkoutId);
      if (next.size === 0) setView("list");
      return next;
    });
    refresh();
  }

  if (view === "confirm") {
    const selected = checkouts.filter((c) => selectedIds.has(c.id));
    const reportingCheckout = reportingIssueFor ? selected.find((c) => c.id === reportingIssueFor) : null;

    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button
          style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
          onClick={backToList}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>
          {selected.length > 1 ? `Checking in ${selected.length}` : selected[0]?.equipment.name}
        </h1>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        {reportingCheckout ? (
          <>
            <p style={{ fontFamily: fonts.body, fontSize: "16px", color: colors.inkSoft }}>
              Reporting an issue with <strong>{reportingCheckout.equipment.name}</strong>
            </p>
            <ReportIssueForm
              equipmentTypeId={reportingCheckout.equipment.equipment_type_id}
              onSubmit={(description) => handleReportIssue(reportingCheckout.id, description)}
              onCancel={() => setReportingIssueFor(null)}
              submitting={busy}
            />
          </>
        ) : (
          <>
            {selected.length > 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
                {selected.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 0",
                      borderBottom: `1px solid ${colors.line}`,
                    }}
                  >
                    <span style={{ fontSize: "17px" }}>{c.equipment.name}</span>
                    <button
                      onClick={() => setReportingIssueFor(c.id)}
                      disabled={busy}
                      style={{ background: "none", border: "none", color: colors.immediate, fontSize: "14px", textDecoration: "underline", cursor: "pointer" }}
                    >
                      Report issue
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontFamily: fonts.body, fontSize: "18px", color: colors.ink, marginTop: 0 }}>
              Is the Kit clean and free from issues?
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <button style={kioskButtonStyle} onClick={handleConfirmClean} disabled={busy}>
                {busy ? "Checking in…" : selected.length > 1 ? `Yes, check in all (${selected.length})` : "Yes"}
              </button>
              {selected.length === 1 && (
                <button style={kioskDangerButtonStyle} onClick={() => setReportingIssueFor(selected[0].id)} disabled={busy}>
                  Report an Issue
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto", paddingBottom: selectedIds.size > 0 ? "110px" : "24px", boxSizing: "border-box" }}>
      <button
        style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
        onClick={() => navigate("/kiosk")}
      >
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Check-in Kit</h1>
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      {checkouts.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing currently checked out to you.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {checkouts.map((c) =>
          c.equipment.equipment_type?.allow_multi_checkout ? (
            <label
              key={c.id}
              style={{
                ...kioskButtonStyle,
                background: selectedIds.has(c.id) ? colors.mossDark : "transparent",
                color: selectedIds.has(c.id) ? "#FFFFFF" : colors.mossDark,
                border: `2px solid ${colors.mossDark}`,
                display: "flex",
                alignItems: "center",
                gap: "14px",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(c.id)}
                onChange={() => toggleSelect(c.id)}
                style={{ width: "26px", height: "26px", flexShrink: 0 }}
              />
              {c.equipment.name}
            </label>
          ) : (
            <button key={c.id} style={kioskButtonStyle} onClick={() => openSingle(c)}>{c.equipment.name}</button>
          )
        )}
      </div>

      {selectedIds.size > 0 && (
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
            style={{ ...kioskButtonStyle, maxWidth: "592px", margin: "0 auto", display: "block" }}
            onClick={proceedWithSelected}
          >
            Continue ({selectedIds.size})
          </button>
        </div>
      )}
    </div>
  );
}
