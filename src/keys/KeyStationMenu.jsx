import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskDangerButtonStyle } from "../kiosk/kioskTheme.js";

export default function KeyStationMenu() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "28px", marginBottom: "4px" }}>
        Hi {profile?.display_name || "there"}
      </h1>
      <p style={{ color: colors.inkSoft, fontSize: "16px", marginTop: 0, marginBottom: "32px" }}>What do you need?</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px", flex: 1 }}>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkout")}>Check out a key</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/checkin")}>Check in a key</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/keys/find")}>Find a key</button>
      </div>
      <button style={{ ...kioskDangerButtonStyle, marginTop: "20px" }} onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
