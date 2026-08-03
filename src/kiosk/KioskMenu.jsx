import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { colors, fonts } from "../lib/theme.js";
import { kioskButtonStyle, kioskDangerButtonStyle } from "./kioskTheme.js";

export default function KioskMenu() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, fontSize: "28px", marginBottom: "4px" }}>
        Hi {profile?.display_name || "there"}
      </h1>
      <p style={{ color: colors.inkSoft, fontSize: "16px", marginTop: 0, marginBottom: "32px" }}>What do you need?</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", flex: 1 }}>
        <button style={kioskButtonStyle} onClick={() => navigate("/kiosk/jobs")}>View Jobs</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/kiosk/checkout")}>Check-out Kit</button>
        <button style={kioskButtonStyle} onClick={() => navigate("/kiosk/checkin")}>Check-in Kit</button>
        <button style={kioskDangerButtonStyle} onClick={() => signOut()}>Sign out</button>
      </div>
    </div>
  );
}
