import { useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { exportMeterReadingsCsvs } from "../../lib/meterExport.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, PageHeader } from "../../ui/index.js";

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
    <div style={{ maxWidth: "var(--width-xl)" }}>
      <PageHeader title="Download for CampManager" />
      <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>
        Downloads both CSVs in CampManager's own format with New Reading Date/New Reading filled in for every
        meter read since the last export. Marks those readings as exported and updates each meter's last reading.
      </p>
      <Card pad="lg">
        <Button variant="primary" onClick={handleExport} disabled={exporting}>
          {exporting ? "Exporting…" : "Export CSVs"}
        </Button>
        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}
        {result && (
          <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>
            Exported {result.readingsExported} reading{result.readingsExported === 1 ? "" : "s"} across{" "}
            {result.electricRowCount} electric and {result.gasRowCount} gas meter rows.
          </p>
        )}
      </Card>
    </div>
  );
}
