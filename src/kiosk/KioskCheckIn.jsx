import { useNavigate } from "react-router-dom";
import { useEquipmentCheckin } from "../lib/useEquipmentCheckin.js";
import ReportIssueForm from "./ReportIssueForm.jsx";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskDangerButtonStyle } from "./kioskTheme.js";

export default function KioskCheckIn() {
  const navigate = useNavigate();
  const {
    view,
    checkouts,
    selectedIds,
    reportingIssueFor,
    setReportingIssueFor,
    busy,
    error,
    toggleSelect,
    openSingle,
    proceedWithSelected,
    backToList,
    handleConfirmClean,
    handleReportIssue,
  } = useEquipmentCheckin();

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

  const documents = [
    ...new Map(checkouts.flatMap((c) => c.equipment.equipment_type?.documents || []).map((d) => [d.id, d])).values(),
  ].sort((a, b) => a.title.localeCompare(b.title));

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

      {documents.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginBottom: "8px" }}>Health &amp; Safety</h2>
          {documents.map((doc) => (
            <SafetyDocumentLink key={doc.id} doc={doc} large />
          ))}
        </div>
      )}

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
