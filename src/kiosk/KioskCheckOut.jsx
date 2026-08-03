import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { getEquipmentTypeAvailabilityCounts, getAvailableUnits } from "../lib/equipmentAvailability.js";
import ChecklistBuilder from "../components/ChecklistBuilder.jsx";
import ReportIssueForm from "./ReportIssueForm.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskDangerButtonStyle, kioskCardStyle } from "./kioskTheme.js";

export default function KioskCheckOut() {
  const navigate = useNavigate();
  const { profile, org } = useAuth();
  const [view, setView] = useState("categories"); // categories | units | confirm
  const [categories, setCategories] = useState([]);
  const [selectedType, setSelectedType] = useState(null);
  const [units, setUnits] = useState([]);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [reportingIssue, setReportingIssue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!org) return;
    getEquipmentTypeAvailabilityCounts(org.id).then(setCategories);
  }, [org]);

  function openCategory(type) {
    if (type.availableCount === 0) return;
    setError(null);
    setSelectedType(type);
    getAvailableUnits(type.id).then((u) => {
      setUnits(u);
      setView("units");
    });
  }

  function openUnit(unit) {
    setError(null);
    setReportingIssue(false);
    setSelectedUnit(unit);
    setView("confirm");
  }

  function backToCategories() {
    setView("categories");
    setSelectedType(null);
    setSelectedUnit(null);
    setReportingIssue(false);
    if (org) getEquipmentTypeAvailabilityCounts(org.id).then(setCategories);
  }

  async function handleCheckOut() {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("equipment_checkouts")
      .insert({ equipment_id: selectedUnit.id, profile_id: profile.id });
    setBusy(false);
    if (err) {
      if (err.code === "23505") {
        setError("That unit was just checked out by someone else.");
        getAvailableUnits(selectedType.id).then((u) => {
          setUnits(u);
          setView("units");
        });
      } else {
        setError(err.message);
      }
      return;
    }
    navigate("/kiosk");
  }

  async function handleReportIssue(description) {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc("report_equipment_fault", {
      p_equipment_id: selectedUnit.id,
      p_description: description,
      p_close_checkout_id: null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate("/kiosk");
  }

  if (view === "confirm" && selectedUnit) {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button
          style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
          onClick={() => setView("units")}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{selectedUnit.name}</h1>

        {selectedType.preUseChecklist.length > 0 && (
          <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginTop: 0 }}>Before you take it</h2>
            <ChecklistBuilder items={selectedType.preUseChecklist} onChange={() => {}} readOnly />
          </div>
        )}

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        {reportingIssue ? (
          <ReportIssueForm
            equipmentTypeId={selectedType.id}
            onSubmit={handleReportIssue}
            onCancel={() => setReportingIssue(false)}
            submitting={busy}
          />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <button style={kioskButtonStyle} onClick={handleCheckOut} disabled={busy}>
              {busy ? "Checking out…" : "Check Out"}
            </button>
            <button style={kioskDangerButtonStyle} onClick={() => setReportingIssue(true)} disabled={busy}>
              Report an Issue
            </button>
            <button style={kioskSecondaryButtonStyle} onClick={() => setView("units")} disabled={busy}>
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  if (view === "units") {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button
          style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }}
          onClick={backToCategories}
        >
          ← Categories
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{selectedType.name}</h1>
        {units.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing available right now.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {units.map((u) => (
            <button key={u.id} style={kioskButtonStyle} onClick={() => openUnit(u)}>{u.name}</button>
          ))}
        </div>
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
