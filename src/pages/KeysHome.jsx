import { Link } from "react-router-dom";
import { colors, fonts, buttonStyle } from "../lib/theme.js";

// The in-app landing for the "Keys" nav link -- lives at /key-register
// rather than /keys because App.jsx's isKeyStation check treats any
// /keys/* path as the physical key-cupboard kiosk and would hijack this
// into a full-screen takeover. Mirrors KeyStationMenu.jsx's non-admin
// choices (check out / check in / find); Relocate and Force check-in stay
// kiosk-only since both are really "I'm stood at the cupboard moving a
// key", same reasoning that kept equipment's admin screens off CheckoutKit.jsx.
const listButtonStyle = {
  ...buttonStyle.secondary,
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "15px",
};

export default function KeysHome() {
  return (
    <div style={{ maxWidth: "560px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Keys</h1>
      <p style={{ color: colors.inkSoft, fontSize: "14px", marginTop: "-8px" }}>What do you need?</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <Link to="/key-register/checkout" style={{ ...buttonStyle.primary, textDecoration: "none", textAlign: "center" }}>
          Check out a key
        </Link>
        <Link to="/key-register/checkin" style={{ ...buttonStyle.primary, textDecoration: "none", textAlign: "center" }}>
          Check in a key
        </Link>
        <Link to="/key-register/find" style={listButtonStyle}>
          Find a key
        </Link>
      </div>
    </div>
  );
}
