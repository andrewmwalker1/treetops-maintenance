import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
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

const OTHER_CONTRACTOR = "__other__";

export default function KeyStationCheckOut() {
  const navigate = useNavigate();
  const { profile, org, activeSite } = useAuth();
  const [view, setView] = useState("select"); // select | confirm | done
  const [keyTags, setKeyTags] = useState([]);
  const [openTagIds, setOpenTagIds] = useState(new Set());
  const [contractors, setContractors] = useState([]);
  const [selfReasons, setSelfReasons] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);

  const [issuedToKind, setIssuedToKind] = useState("self");
  const [contractorChoice, setContractorChoice] = useState("");
  const [contractorFreeText, setContractorFreeText] = useState("");
  const [contractorReasons, setContractorReasons] = useState([]);
  const [personName, setPersonName] = useState("");
  const [guestConfirmed, setGuestConfirmed] = useState(false);
  const [reason, setReason] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    if (!org || !activeSite) return;
    Promise.all([
      supabase
        .from("key_tags")
        .select("id, tag_uid, pitch_id, special_location_id, pitches(pitch_number_or_name), key_special_locations(label)")
        .eq("site_id", activeSite.id),
      supabase.from("key_checkouts").select("key_tag_id").is("checked_in_at", null),
      supabase.from("contractors").select("id, name").eq("org_id", org.id).order("name"),
    ]).then(([{ data: kt }, { data: open }, { data: c }]) => {
      setKeyTags((kt || []).filter((t) => t.pitch_id || t.special_location_id));
      setOpenTagIds(new Set((open || []).map((o) => o.key_tag_id)));
      setContractors(c || []);
    });
  }

  useEffect(refresh, [org, activeSite]);

  // Preset reasons for checking a key out to yourself, by your own role
  // (RoleKeyReasonsTab.jsx) -- e.g. Sam's "Caravan Prep" role might offer
  // "Clean the caravan" / "At the request of the owner" / "Dress the
  // caravan". Loaded once per role, unlike contractorReasons below which
  // reloads whenever the picked contractor changes.
  useEffect(() => {
    if (!profile?.role_id) return;
    supabase
      .from("role_key_reasons")
      .select("id, label")
      .eq("role_id", profile.role_id)
      .order("sort_order")
      .then(({ data }) => setSelfReasons(data || []));
  }, [profile?.role_id]);

  useEffect(() => {
    if (!contractorChoice || contractorChoice === OTHER_CONTRACTOR) {
      setContractorReasons([]);
      return;
    }
    supabase
      .from("contractor_reasons")
      .select("id, label")
      .eq("contractor_id", contractorChoice)
      .order("sort_order")
      .then(({ data }) => setContractorReasons(data || []));
  }, [contractorChoice]);

  function pickTag(tag) {
    setError(null);
    setSelectedTag(tag);
    setIssuedToKind("self");
    setContractorChoice("");
    setContractorFreeText("");
    setPersonName("");
    setGuestConfirmed(false);
    setReason("");
    setView("confirm");
  }

  function backToSelect() {
    setView("select");
    setSelectedTag(null);
    refresh();
  }

  const canSubmit =
    reason.trim().length > 0 &&
    (issuedToKind === "self" ||
      (issuedToKind === "contractor" && (contractorChoice === OTHER_CONTRACTOR ? contractorFreeText.trim() : contractorChoice)) ||
      (issuedToKind === "customer" && personName.trim()) ||
      (issuedToKind === "guest" && personName.trim() && guestConfirmed));

  async function handleSubmit() {
    if (!canSubmit || !selectedTag) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.from("key_checkouts").insert({
      key_tag_id: selectedTag.id,
      checked_out_by: profile.id,
      issued_to_kind: issuedToKind,
      issued_to_contractor_id: issuedToKind === "contractor" && contractorChoice !== OTHER_CONTRACTOR ? contractorChoice || null : null,
      issued_to_name:
        issuedToKind === "self"
          ? null
          : issuedToKind === "contractor"
          ? contractorChoice === OTHER_CONTRACTOR
            ? contractorFreeText.trim()
            : null
          : personName.trim(),
      reason: reason.trim(),
    });
    setSubmitting(false);
    if (err) {
      setError(err.code === "23505" ? "This key was just checked out by someone else." : err.message);
      return;
    }
    setView("done");
  }

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
                  color: issuedToKind === opt.value ? "#FFFFFF" : colors.mossDark,
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
        </div>

        <div style={{ ...kioskCardStyle, marginBottom: "16px" }}>
          <p style={{ fontWeight: 600, marginTop: 0, marginBottom: "10px" }}>Reason</p>
          {(issuedToKind === "self" ? selfReasons : issuedToKind === "contractor" ? contractorReasons : []).length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" }}>
              {(issuedToKind === "self" ? selfReasons : contractorReasons).map((r) => (
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

  const availableTags = keyTags.filter((t) => !openTagIds.has(t.id));

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
