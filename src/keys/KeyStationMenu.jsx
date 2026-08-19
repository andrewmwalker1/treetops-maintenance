import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { locationLabel } from "./KeySelector.jsx";
import { queryOpenKeyCheckouts, keyLocationLabel, timeAgo, KEY_GROUPS } from "../lib/keysOutSummary.js";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskDangerButtonStyle, kioskCardStyle } from "../kiosk/kioskTheme.js";

export default function KeyStationMenu() {
  const navigate = useNavigate();
  const { profile, activeSite, signOut } = useAuth();
  const permissions = usePermissions();
  const [myOpenKeys, setMyOpenKeys] = useState(null); // null = loading
  const [openCheckouts, setOpenCheckouts] = useState(null); // null = loading

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("key_checkouts")
      .select("id, key_tags(pitches(pitch_number_or_name), key_special_locations(label))")
      .eq("checked_out_by", profile.id)
      .is("checked_in_at", null)
      .then(({ data }) => setMyOpenKeys((data || []).map((c) => ({ ...c.key_tags }))));
  }, [profile]);

  // Andy's ask: the same "keys currently out" visibility the main app's
  // Dashboard has, but on the key station itself, since staff mostly live
  // here rather than the desktop app. A trusted contractor's own login
  // (profile.contractor_id set -- 43-contractor-linked-profiles.sql) gets
  // a narrower view scoped to just their own company instead of the full
  // org breakdown, which isn't their business to see.
  useEffect(() => {
    if (!activeSite) return;
    queryOpenKeyCheckouts(activeSite.id).then(setOpenCheckouts);
  }, [activeSite]);

  const myCompanyCheckouts = profile?.contractor_id
    ? (openCheckouts || []).filter((c) => c.issued_to_contractor?.id === profile.contractor_id)
    : [];

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "28px", marginBottom: "4px" }}>
        Hi {profile?.display_name || "there"}
      </h1>
      <p style={{ color: colors.inkSoft, fontSize: "16px", marginTop: 0, marginBottom: "20px" }}>What do you need?</p>

      {myOpenKeys !== null && (
        <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
          {myOpenKeys.length === 0 ? (
            <p style={{ margin: 0, fontSize: "15px", color: colors.inkSoft }}>You have no keys checked out right now.</p>
          ) : (
            <>
              <p style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 600 }}>
                You currently have {myOpenKeys.length} key{myOpenKeys.length === 1 ? "" : "s"} checked out:
              </p>
              <p style={{ margin: 0, fontSize: "15px", color: colors.inkSoft }}>{myOpenKeys.map((t) => locationLabel(t)).join(", ")}</p>
            </>
          )}
        </div>
      )}

      {profile?.contractor_id && openCheckouts !== null && (
        <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
          <p style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>
            Your company currently has {myCompanyCheckouts.length} key{myCompanyCheckouts.length === 1 ? "" : "s"} checked out
            {myCompanyCheckouts.length > 0 ? ":" : "."}
          </p>
          {myCompanyCheckouts.map((c) => (
            <p key={c.id} style={{ margin: "4px 0 0", fontSize: "14px", color: colors.inkSoft }}>
              {keyLocationLabel(c)} — taken by {c.checked_out_by_profile?.display_name || "—"}, {timeAgo(c.checked_out_at)}
            </p>
          ))}
        </div>
      )}

      {!profile?.contractor_id && openCheckouts !== null && <KeysOutSummary checkouts={openCheckouts} />}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkout")}>Check out a key</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkin")}>Check in a key</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/find")}>Find a key</button>
        {permissions.has("can_manage_keys") && (
          <>
            <button style={kioskSecondaryButtonStyle} onClick={() => navigate("/keys/relocate")}>Relocate a key</button>
            <button style={kioskSecondaryButtonStyle} onClick={() => navigate("/keys/force-checkin")}>Force check-in</button>
          </>
        )}
      </div>
      <button style={{ ...kioskDangerButtonStyle, marginTop: "20px" }} onClick={() => signOut()}>Sign out</button>
    </div>
  );
}

// Org-wide breakdown for ordinary staff (not shown to contractors -- see
// the company-scoped block above instead). Collapsed to just the counts
// per group, since a kiosk screen has far less room than the Dashboard's
// three-column grid -- tap a count to see who, rather than always
// showing every row.
function KeysOutSummary({ checkouts }) {
  const [expanded, setExpanded] = useState(null); // group key, or null

  return (
    <div style={{ ...kioskCardStyle, marginBottom: "20px" }}>
      <p style={{ margin: "0 0 8px", fontSize: "15px", fontWeight: 600 }}>Keys currently out</p>
      {KEY_GROUPS.map((g) => {
        const rows = checkouts.filter(g.match);
        const isExpanded = expanded === g.key;
        return (
          <div key={g.key} style={{ borderTop: `1px solid ${colors.line}`, paddingTop: "8px", marginTop: "8px" }}>
            <button
              onClick={() => setExpanded(isExpanded ? null : g.key)}
              disabled={rows.length === 0}
              style={{
                display: "flex",
                justifyContent: "space-between",
                width: "100%",
                background: "none",
                border: "none",
                padding: 0,
                fontFamily: fonts.body,
                fontSize: "15px",
                color: colors.ink,
                cursor: rows.length > 0 ? "pointer" : "default",
              }}
            >
              <span>{g.label}</span>
              <span style={{ fontWeight: 600 }}>{rows.length}</span>
            </button>
            {isExpanded && (
              <div style={{ marginTop: "6px" }}>
                {rows.map((c) => (
                  <p key={c.id} style={{ margin: "2px 0", fontSize: "13px", color: colors.inkSoft }}>
                    {keyLocationLabel(c)} · {timeAgo(c.checked_out_at)}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
