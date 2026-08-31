import { useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { exportMeterReadingsCsvs } from "../../lib/meterExport.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

export default function DownloadMeters() {
  const { profile, org, activeSite } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    setResult(null);
    try {
      const data = await exportMeterReadingsCsvs({ orgId: org.id, siteId: activeSite.id, profileId: profile.id });
      setResult(data);
    } catch (err) {
      console.error("Export failed", err);
      setError(err.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  if (!org || !activeSite) return null;

  return (
    <div style={{ maxWidth: "560px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Download for CampManager</h1>
      <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
        Downloads both CSVs in CampManager's own format with New Reading Date/New Reading filled in for every
        meter read since the last export. Marks those readings as exported and updates each meter's last reading.
      </p>
      <div style={{ ...cardStyle, padding: "18px" }}>
        <button type="button" onClick={handleExport} disabled={exporting} style={{ ...buttonStyle.primary, opacity: exporting ? 0.6 : 1 }}>
          {exporting ? "Exporting…" : "Export CSVs"}
        </button>
        {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}
        {result && (
          <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
            Exported {result.readingsExported} reading{result.readingsExported === 1 ? "" : "s"} across{" "}
            {result.electricRowCount} electric and {result.gasRowCount} gas meter rows.
          </p>
        )}
      </div>
    </div>
  );
}
