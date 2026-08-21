import { useEquipmentCheckin } from "../lib/useEquipmentCheckin.js";
import ReportIssueForm from "../kiosk/ReportIssueForm.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../lib/theme.js";

// Same equipment check-in logic as the workshop kiosk (useEquipmentCheckin.js),
// so someone like Hazel can check a strimmer back in from her own phone
// without needing to be stood at the kiosk terminal -- matches CheckoutKit.jsx
// (equipment checkout/check-in has never been role-gated, unlike keys).
// Styled for the normal app (theme.js, not kioskTheme.js) since this lives
// inside Layout's ordinary chrome, not a full-screen kiosk takeover.
const listButtonStyle = {
  ...buttonStyle.secondary,
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "15px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

export default function CheckinKit() {
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
      <div style={{ maxWidth: "560px" }}>
        <button style={{ ...buttonStyle.secondary, marginBottom: "16px" }} onClick={backToList}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>
          {selected.length > 1 ? `Checking in ${selected.length}` : selected[0]?.equipment.name}
        </h1>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        {reportingCheckout ? (
          <>
            <p style={{ fontSize: "14px", color: colors.inkSoft }}>
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
              <div style={{ ...cardStyle, padding: "16px", marginBottom: "16px" }}>
                <h2 style={{ fontFamily: fonts.display, fontSize: "14px", color: colors.mossDark, marginTop: 0 }}>
                  Checking in {selected.length}
                </h2>
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
                    <span style={{ fontSize: "15px" }}>{c.equipment.name}</span>
                    <button
                      onClick={() => setReportingIssueFor(c.id)}
                      disabled={busy}
                      style={{ background: "none", border: "none", color: colors.immediate, fontSize: "13px", textDecoration: "underline", cursor: "pointer" }}
                    >
                      Report issue
                    </button>
                  </div>
                ))}
              </div>
            )}

            <p style={{ fontSize: "15px", color: colors.ink, marginTop: 0 }}>Is the kit clean and free from issues?</p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button style={buttonStyle.primary} onClick={handleConfirmClean} disabled={busy}>
                {busy ? "Checking in…" : selected.length > 1 ? `Yes, check in all (${selected.length})` : "Yes"}
              </button>
              {selected.length === 1 && (
                <button
                  style={{ ...buttonStyle.secondary, color: colors.immediate, borderColor: colors.immediate }}
                  onClick={() => setReportingIssueFor(selected[0].id)}
                  disabled={busy}
                >
                  Report an issue
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Check-in kit</h1>
      {error && <p style={{ color: colors.immediate }}>{error}</p>}
      {checkouts.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing currently checked out to you.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {checkouts.map((c) =>
          c.equipment.equipment_type?.allow_multi_checkout ? (
            <label
              key={c.id}
              style={{
                ...listButtonStyle,
                background: selectedIds.has(c.id) ? colors.mossDark : "transparent",
                color: selectedIds.has(c.id) ? "#FFFFFF" : colors.mossDark,
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  style={{ width: "20px", height: "20px", flexShrink: 0 }}
                />
                {c.equipment.name}
              </span>
            </label>
          ) : (
            <button key={c.id} style={listButtonStyle} onClick={() => openSingle(c)}>
              {c.equipment.name}
            </button>
          )
        )}
      </div>

      {selectedIds.size > 0 && (
        <button
          style={{ ...buttonStyle.primary, width: "100%", marginTop: "16px" }}
          onClick={proceedWithSelected}
        >
          Continue ({selectedIds.size})
        </button>
      )}
    </div>
  );
}
