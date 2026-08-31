import { Link } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { colors, fonts, buttonStyle } from "../lib/theme.js";

// Landing page for the "Meter Reading" nav item -- mirrors KeysHome.jsx's
// shape (primary actions up top, admin-only actions below a permission
// check) rather than burying upload/download inside the generic Admin tab
// list, per Andy's ask to group everything meter-reading under its own
// menu instead of splitting it between top nav and Admin.
const listButtonStyle = {
  ...buttonStyle.secondary,
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  fontSize: "15px",
};

export default function MeterReadingHome() {
  const permissions = usePermissions();

  return (
    <div style={{ maxWidth: "480px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Meter Reading</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <Link to="/meter-reading/scan" style={{ ...buttonStyle.primary, textDecoration: "none", textAlign: "center" }}>
          Read a meter
        </Link>
        <Link to="/meter-reading/progress" style={listButtonStyle}>
          Round progress
        </Link>

        {permissions.has("can_manage_meter_readings") && (
          <>
            <p style={{ color: colors.inkSoft, fontSize: "12px", margin: "14px 0 0", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Admin
            </p>
            <Link to="/meter-reading/upload" style={listButtonStyle}>
              Upload CampManager CSVs
            </Link>
            <Link to="/meter-reading/download" style={listButtonStyle}>
              Download for CampManager
            </Link>
            <Link to="/meter-reading/labels" style={listButtonStyle}>
              Print QR labels
            </Link>
            <Link to="/meter-reading/settings" style={listButtonStyle}>
              Unit cost settings
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
