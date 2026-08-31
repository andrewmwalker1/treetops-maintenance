import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useAuth } from "../../lib/AuthContext.jsx";
import { fetchActiveMeters } from "../../lib/meterReadingsQuery.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

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
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Print QR labels</h1>
      <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
        Generates one QR code per active meter, encoding the pitch + meter type directly (e.g. PN-C01-ELEC) — no
        lookup table needed, so a faded label can be reprinted identically. Plain paper is fine for the pilot.
      </p>
      <div style={{ ...cardStyle, padding: "18px" }}>
        <button type="button" onClick={handleGenerate} disabled={generating || meters.length === 0} style={buttonStyle.secondary}>
          {generating ? "Generating…" : `Generate ${meters.length} label${meters.length === 1 ? "" : "s"}`}
        </button>
        {labels.length > 0 && (
          <button type="button" onClick={() => window.print()} style={{ ...buttonStyle.primary, marginLeft: "10px" }}>
            Print
          </button>
        )}
      </div>
      {labels.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "12px", marginTop: "16px" }}>
          {labels.map((l) => (
            <div key={l.code} style={{ textAlign: "center", border: `1px solid ${colors.line}`, borderRadius: "8px", padding: "8px" }}>
              <img src={l.qr} alt={l.code} style={{ width: "100%" }} />
              <div style={{ fontSize: "12px", marginTop: "4px" }}>{l.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
