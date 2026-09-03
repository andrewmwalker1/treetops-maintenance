import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { fetchProgress, fetchOutstandingMeters } from "../../lib/meterReadingsQuery.js";
import { colors, fonts, space } from "../../lib/theme.js";
import { Card, PageHeader, SkeletonList } from "../../ui/index.js";

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
      <PageHeader title="Round progress" />

      {loading && <SkeletonList rows={3} />}

      {!loading && progress && (
        <>
          <Card pad="lg" style={{ marginBottom: "var(--space-5)" }}>
            <div style={{ fontFamily: fonts.display, fontSize: "28px", color: colors.mossDark }}>
              {progress.read} of {progress.total}
            </div>
            <div style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>connected meters read this round</div>
          </Card>

          <PageHeader title={`Outstanding (${outstanding.length})`} level={2} />
          {outstanding.length === 0 ? (
            <p style={{ color: colors.inkSoft }}>All connected meters have a reading this round.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {outstanding.map((m) => (
                <Card pad="sm" key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-base)" }}>
                  <span>{m.pitches?.pitch_number_or_name}</span>
                  <span style={{ color: colors.inkSoft }}>{m.meter_type === "electric" ? "Electric" : "Gas"}</span>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
