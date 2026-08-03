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
  const [selected, setSelected] = useState(null);
  const [reportingIssue, setReportingIssue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(() => {
    if (!profile) return;
    supabase
      .from("equipment_checkouts")
      .select("id, checked_out_at, equipment:equipment(id, name, equipment_type_id)")
      .eq("profile_id", profile.id)
      .is("checked_in_at", null)
      .order("checked_out_at")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setCheckouts(data || []);
      });
  }, [profile]);

  useEffect(refresh, [refresh]);

  function openCheckout(c) {
    setError(null);
    setReportingIssue(false);
    setSelected(c);
  }

  async function handleConfirmClean() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("equipment_checkouts")
      .update({ checked_in_at: new Date().toISOString(), checked_in_by: profile.id })
      .eq("id", selected.id);
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSelected(null);
    refresh();
  }

  async function handleReportIssue(description) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("report_equipment_fault", {
      p_equipment_id: selected.equipment.id,
      p_description: description,
      p_close_checkout_id: selected.id,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSelected(null);
    refresh();
  }

  if (selected) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button
          style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
          onClick={() => setSelected(null)}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{selected.equipment.name}</h1>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        {reportingIssue ? (
          <ReportIssueForm
            equipmentTypeId={selected.equipment.equipment_type_id}
            onSubmit={handleReportIssue}
            onCancel={() => setReportingIssue(false)}
            submitting={busy}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ fontFamily: fonts.body, fontSize: "18px", color: colors.ink, marginTop: 0 }}>
              Is the Kit clean and free from issues?
            </p>
            <button style={kioskButtonStyle} onClick={handleConfirmClean} disabled={busy}>
              {busy ? "Checking in…" : "Yes"}
            </button>
            <button style={kioskDangerButtonStyle} onClick={() => setReportingIssue(true)} disabled={busy}>
              Report an Issue
            </button>
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
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Check-in Kit</h1>
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      {checkouts.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing currently checked out to you.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {checkouts.map((c) => (
          <button key={c.id} style={kioskButtonStyle} onClick={() => openCheckout(c)}>{c.equipment.name}</button>
        ))}
      </div>
    </div>
  );
}
