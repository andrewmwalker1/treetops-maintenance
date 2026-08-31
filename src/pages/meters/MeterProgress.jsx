import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { fetchProgress, fetchOutstandingMeters } from "../../lib/meterReadingsQuery.js";
import { colors, fonts, cardStyle } from "../../lib/theme.js";

export default function MeterProgress() {
  const { activeSite } = useAuth();
  const [progress, setProgress] = useState(null);
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeSite) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchProgress(activeSite.id), fetchOutstandingMeters(activeSite.id)])
      .then(([p, o]) => {
        if (cancelled) return;
        setProgress(p);
        setOutstanding(o);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [activeSite]);

  if (!activeSite) return null;

  return (
    <div style={{ maxWidth: "520px" }}>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Round progress</h1>

      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}

      {!loading && progress && (
        <>
          <div style={{ ...cardStyle, padding: "20px", marginBottom: "20px" }}>
            <div style={{ fontFamily: fonts.display, fontSize: "28px", color: colors.mossDark }}>
              {progress.read} of {progress.total}
            </div>
            <div style={{ color: colors.inkSoft, fontSize: "13px" }}>connected meters read this round</div>
          </div>

          <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>
            Outstanding ({outstanding.length})
          </h2>
          {outstanding.length === 0 ? (
            <p style={{ color: colors.inkSoft }}>All connected meters have a reading this round.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {outstanding.map((m) => (
                <div
                  key={m.id}
                  style={{ ...cardStyle, padding: "10px 14px", display: "flex", justifyContent: "space-between", fontSize: "14px" }}
                >
                  <span>{m.pitches?.pitch_number_or_name}</span>
                  <span style={{ color: colors.inkSoft }}>{m.meter_type === "electric" ? "Electric" : "Gas"}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
