import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { queryOpenKeyCheckouts, KEY_GROUPS } from "../lib/keysOutSummary.js";
import StatDial from "../components/StatDial.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskSecondaryButtonStyle, kioskDangerButtonStyle } from "../kiosk/kioskTheme.js";

const smallButtonStyle = { ...kioskSecondaryButtonStyle, flex: 1, padding: "14px 8px", fontSize: "14px" };

export default function KeyStationMenu() {
  const navigate = useNavigate();
  const { profile, activeSite, signOut } = useAuth();
  const permissions = usePermissions();
  const [myOpenKeyCount, setMyOpenKeyCount] = useState(null); // null = loading
  const [openCheckouts, setOpenCheckouts] = useState(null); // null = loading

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("key_checkouts")
      .select("id", { count: "exact", head: true })
      .eq("checked_out_by", profile.id)
      .is("checked_in_at", null)
      .then(({ count }) => setMyOpenKeyCount(count || 0));
  }, [profile]);

  // Andy's ask: the same "keys currently out" visibility the main app's
  // Dashboard has, but on the key station itself, since staff mostly live
  // here rather than the desktop app -- and, later, as a row of dials
  // (StatDial.jsx, same component the Dashboard uses) rather than text, to
  // make better use of a kiosk screen's limited height. A trusted
  // contractor's own login (profile.contractor_id set --
  // 43-contractor-linked-profiles.sql) gets a narrower view scoped to just
  // their own company instead of the full org breakdown, which isn't
  // their business to see.
  useEffect(() => {
    if (!activeSite) return;
    queryOpenKeyCheckouts(activeSite.id).then(setOpenCheckouts);
  }, [activeSite]);

  const myCompanyCount = profile?.contractor_id
    ? (openCheckouts || []).filter((c) => c.issued_to_contractor?.id === profile.contractor_id).length
    : 0;

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "28px", marginBottom: "4px" }}>
        Hi {profile?.display_name || "there"}
      </h1>
      <p style={{ color: colors.inkSoft, fontSize: "16px", marginTop: 0, marginBottom: "20px" }}>What do you need?</p>

      {myOpenKeyCount !== null && openCheckouts !== null && (
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <StatDial label="Yours" value={myOpenKeyCount} />
          </div>
          {profile?.contractor_id ? (
            <div style={{ flex: 1 }}>
              <StatDial label="Your company" value={myCompanyCount} />
            </div>
          ) : (
            KEY_GROUPS.map((g) => (
              <div key={g.key} style={{ flex: 1 }}>
                <StatDial label={g.label} value={openCheckouts.filter(g.match).length} />
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkout")}>Check out a key</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkin")}>Check in a key</button>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={smallButtonStyle} onClick={() => navigate("/keys/find")}>Find a key</button>
          {permissions.has("can_manage_keys") && (
            <>
              <button style={smallButtonStyle} onClick={() => navigate("/keys/relocate")}>Relocate</button>
              <button style={smallButtonStyle} onClick={() => navigate("/keys/force-checkin")}>Force check-in</button>
            </>
          )}
        </div>
      </div>
      <button style={{ ...kioskDangerButtonStyle, marginTop: "20px" }} onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
