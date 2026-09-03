import { useNavigate, useLocation } from "react-router-dom";
import { useKeyCheckout, OTHER_CONTRACTOR } from "../lib/useKeyCheckout.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskCardStyle } from "../kiosk/kioskTheme.js";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 16px",
  borderRadius: "12px",
  border: `2px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "17px",
  marginBottom: "14px",
};

export default function KeyStationCheckOut() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    view,
    availableTags,
    openTagIds,
    contractors,
    selectedTag,
    issuedToKind,
    setIssuedToKind,
    contractorChoice,
    setContractorChoice,
    contractorFreeText,
    setContractorFreeText,
    personName,
    setPersonName,
    guestConfirmed,
    setGuestConfirmed,
    reason,
    setReason,
    submitting,
    error,
    setError,
    myContractor,
    reasonPresets,
    canSubmit,
    pickTag,
    backToSelect,
    handleSubmit,
  } = useKeyCheckout(location.state?.presetTagId);

  if (view === "done") {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Checked out</h1>
        <p style={{ fontSize: "18px" }}>{locationLabel(selectedTag)} — logged.</p>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys")}>Done</button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
        <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={backToSelect}>
          ← Back
        </button>
        <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>{locationLabel(selectedTag)}</h1>

        <div style={{ ...kioskCardStyle, marginBottom: "16px" }}>
          {myContractor ? (
            <p style={{ margin: 0, fontSize: "16px" }}>
              Checking out for <strong>{myContractor.name}</strong>.
            </p>
          ) : (
            <>
              <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "10px" }}>Who's taking it?</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "6px" }}>
                {[
                  { value: "self", label: "Me" },
                  { value: "contractor", label: "Contractor" },
                  { value: "customer", label: "Customer" },
                  { value: "guest", label: "Guest" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setIssuedToKind(opt.value)}
                    style={{
                      ...kioskSecondaryButtonStyle,
                      width: "auto",
                      padding: "10px 18px",
                      fontSize: "16px",
                      background: issuedToKind === opt.value ? colors.mossDark : "transparent",
                      color: issuedToKind === opt.value ? colors.onDark : colors.mossDark,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {issuedToKind === "contractor" && (
                <>
                  <select value={contractorChoice} onChange={(e) => setContractorChoice(e.target.value)} style={fieldStyle}>
                    <option value="">Select a contractor…</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    <option value={OTHER_CONTRACTOR}>Other…</option>
                  </select>
                  {contractorChoice === OTHER_CONTRACTOR && (
                    <input
                      type="text"
                      value={contractorFreeText}
                      onChange={(e) => setContractorFreeText(e.target.value)}
                      placeholder="Contractor / company name"
                      style={fieldStyle}
                    />
                  )}
                </>
              )}

              {(issuedToKind === "customer" || issuedToKind === "guest") && (
                <input
                  type="text"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder={issuedToKind === "guest" ? "Guest's name" : "Customer's name"}
                  style={fieldStyle}
                />
              )}

              {issuedToKind === "guest" && (
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "15px", color: colors.inkSoft }}>
                  <input type="checkbox" checked={guestConfirmed} onChange={(e) => setGuestConfirmed(e.target.checked)} style={{ width: "22px", height: "22px" }} />
                  Confirmed with the caravan owner
                </label>
              )}
            </>
          )}
        </div>

        <div style={{ ...kioskCardStyle, marginBottom: "16px" }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "10px" }}>Reason</p>
          {reasonPresets.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
              {reasonPresets.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.label)}
                  style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "8px 14px", fontSize: "14px" }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}
          <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for taking this key" style={fieldStyle} />
        </div>

        {error && <p style={{ color: colors.immediate }}>{error}</p>}

        <button style={{ ...kioskButtonStyle, opacity: canSubmit ? 1 : 0.5 }} onClick={handleSubmit} disabled={!canSubmit || submitting}>
          {submitting ? "Checking out…" : "Check out"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", maxWidth: "640px", margin: "0 auto" }}>
      <button style={{ ...kioskSecondaryButtonStyle, width: "auto", padding: "10px 20px", fontSize: "16px", marginBottom: "20px" }} onClick={() => navigate("/keys")}>
        ← Menu
      </button>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "26px", marginTop: 0 }}>Check out a key</h1>
      <KeySelector
        tags={availableTags}
        onPick={(tag) => {
          if (openTagIds.has(tag.id)) {
            setError("This key is already checked out.");
            return;
          }
          pickTag(tag);
        }}
        notFoundMessage="That key isn't recognised, or it's already checked out."
      />
    </div>
  );
}
