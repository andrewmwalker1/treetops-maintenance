import { useNavigate } from "react-router-dom";
import { useEquipmentCheckout } from "../lib/useEquipmentCheckout.js";
import ChecklistBuilder from "../components/ChecklistBuilder.jsx";
import ReportIssueForm from "./ReportIssueForm.jsx";
import SafetyDocumentLink from "../components/SafetyDocumentLink.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskDangerButtonStyle, kioskCardStyle } from "./kioskTheme.js";

export default function KioskCheckOut() {
  const navigate = useNavigate();
  const {
    view,
    setView,
    categories,
    selectedType,
    units,
    selectedIds,
    reportingIssueFor,
    setReportingIssueFor,
    checkoutOutcome,
    busy,
    error,
    openCategory,
    selectUnit,
    toggleUnit,
    backToCategories,
    handleCheckOut,
    handleReportIssue,
  } = useEquipmentCheckout();

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
              <button style={kioskButtonStyle} onClick={() => handleCheckOut(() => navigate("/kiosk"))} disabled={busy}>
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

        {selectedType.documents.length > 0 && (
          <div style={{ marginTop: "24px" }}>
            <h2 style={{ fontFamily: fonts.display, fontSize: "18px", color: colors.mossDark, marginBottom: "8px" }}>Health &amp; Safety</h2>
            {selectedType.documents.map((doc) => (
              <SafetyDocumentLink key={doc.id} doc={doc} large />
            ))}
          </div>
        )}
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
            style={{
              ...kioskButtonStyle,
              opacity: c.availableCount === 0 ? 0.6 : 1,
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
