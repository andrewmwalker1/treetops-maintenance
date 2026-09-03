import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "../../lib/AuthContext.jsx";
import { fetchActiveMeters } from "../../lib/meterReadingsQuery.js";
import { colors } from "../../lib/theme.js";
import { Button, Card, PageHeader } from "../../ui/index.js";

export default function MeterLabels() {
  const { activeSite } = useAuth();
  const [meters, setMeters] = useState([]);
  const [labels, setLabels] = useState([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!activeSite) return;
    fetchActiveMeters(activeSite.id).then(setMeters);
  }, [activeSite]);

  async function handleGenerate() {
    setGenerating(true);
    const generated = await Promise.all(
      meters.map(async (m) => ({
        qr: await QRCode.toDataURL(m.qr_code, { margin: 1, width: 160 }),
        label: `${m.pitches?.pitch_number_or_name} · ${m.meter_type === "electric" ? "Electric" : "Gas"}`,
        code: m.qr_code,
      }))
    );
    setLabels(generated);
    setGenerating(false);
  }

  if (!activeSite) return null;

  return (
    <div style={{ maxWidth: "720px" }}>
      <PageHeader title="Print QR labels" />
      <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>
        Generates one QR code per active meter, encoding the pitch + meter type directly (e.g. PN-C01-ELEC) — no
        lookup table needed, so a faded label can be reprinted identically. Plain paper is fine for the pilot.
      </p>
      <Card pad="lg">
        <Button onClick={handleGenerate} disabled={generating || meters.length === 0}>
          {generating ? "Generating…" : `Generate ${meters.length} label${meters.length === 1 ? "" : "s"}`}
        </Button>
        {labels.length > 0 && (
          <Button variant="primary" onClick={() => window.print()}>
            Print
          </Button>
        )}
      </Card>
      {labels.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
          {labels.map((l) => (
            <div key={l.code} style={{ textAlign: "center", border: `1px solid ${colors.line}`, borderRadius: "var(--radius-sm)", padding: "var(--space-2)" }}>
              <img src={l.qr} alt={l.code} style={{ width: "100%" }} />
              <div style={{ fontSize: "var(--text-xs)", marginTop: "var(--space-1)" }}>{l.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
