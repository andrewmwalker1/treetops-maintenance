import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { locationLabel } from "./KeySelector.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskDangerButtonStyle, kioskCardStyle } from "../kiosk/kioskTheme.js";

export default function KeyStationMenu() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [myOpenKeys, setMyOpenKeys] = useState(null); // null = loading

  useEffect(() => {
    if (!profile) return;
    supabase
      .from("key_checkouts")
      .select("id, key_tags(pitches(pitch_number_or_name), key_special_locations(label))")
      .eq("checked_out_by", profile.id)
      .is("checked_in_at", null)
      .then(({ data }) => setMyOpenKeys((data || []).map((c) => ({ ...c.key_tags }))));
  }, [profile]);

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

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkout")}>Check out a key</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkin")}>Check in a key</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/find")}>Find a key</button>
      </div>
      <button style={{ ...kioskDangerButtonStyle, marginTop: "20px" }} onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
