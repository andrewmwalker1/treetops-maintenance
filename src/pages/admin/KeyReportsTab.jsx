import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, fonts, cardStyle } from "../../lib/theme.js";

const fieldStyle = {
  width: "100%",
  maxWidth: "360px",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  fontSize: "13px",
  marginBottom: "12px",
};

const thStyle = { textAlign: "left", padding: "8px 10px", fontSize: "12px", color: colors.inkSoft, whiteSpace: "nowrap" };
const tdStyle = { padding: "8px 10px", fontSize: "13px", borderTop: `1px solid ${colors.line}` };

// First of a growing set of key-system reports (Andy, 2026-08-26) --
// pitches with zero *active* key_tags rows attached. Lost and handed-over
// tags (48-key-tags-handover.sql) don't count as a working key still in
// the system -- same status = 'active' convention every checkout/relocate
// picker already uses -- so a pitch whose only key was lost, or handed
// over to a previous owner with no duplicate left behind, correctly shows
// up here too, not just pitches that never had a key registered at all.
function PitchesWithoutKeysReport() {
  const { activeSite } = useAuth();
  const [pitches, setPitches] = useState([]);
  const [pitchIdsWithKeys, setPitchIdsWithKeys] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!activeSite) return;
    setLoading(true);
    setError(null);
    Promise.all([
      supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", activeSite.id).order("pitch_number_or_name"),
      supabase.from("key_tags").select("pitch_id").eq("site_id", activeSite.id).eq("status", "active").not("pitch_id", "is", null),
    ]).then(([{ data: p, error: pErr }, { data: kt, error: ktErr }]) => {
      if (pErr || ktErr) setError((pErr || ktErr).message);
      setPitches(p || []);
      setPitchIdsWithKeys(new Set((kt || []).map((t) => t.pitch_id)));
      setLoading(false);
    });
  }, [activeSite]);

  const missing = pitches.filter((p) => !pitchIdsWithKeys.has(p.id));
  const visible = search.trim() ? missing.filter((p) => p.pitch_number_or_name.toLowerCase().includes(search.trim().toLowerCase())) : missing;

  return (
    <div>
      <h3 style={{ fontFamily: fonts.display, fontSize: "14px", color: colors.mossDark, marginTop: 0 }}>Pitches with no keys</h3>
      <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
        Every pitch with no active key tag registered against it — includes pitches that never had one, and pitches whose only key has since been
        marked lost or handed over with no duplicate left behind.
      </p>
      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}
      {loading && <p style={{ color: colors.inkSoft }}>Loading…</p>}
      {!loading && !error && (
        <>
          <p style={{ fontSize: "13px", color: colors.inkSoft }}>
            {missing.length} of {pitches.length} pitches.
          </p>
          {missing.length === 0 ? (
            <p style={{ color: colors.inkSoft }}>Every pitch has at least one active key.</p>
          ) : (
            <>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by pitch…" style={fieldStyle} />
              {visible.length === 0 ? (
                <p style={{ color: colors.inkSoft }}>Nothing matches this filter.</p>
              ) : (
                <div style={{ ...cardStyle, overflowX: "auto", maxWidth: "360px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={thStyle}>Pitch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((p) => (
                        <tr key={p.id}>
                          <td style={tdStyle}>{p.pitch_number_or_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// A tab-switcher scaffold, not just a single report, since Andy's asked
// for "a few reports" -- keeping the list here means each new one is a
// one-line addition rather than a new Admin.jsx tab every time.
const REPORTS = [{ key: "noKeys", label: "Pitches with no keys", Component: PitchesWithoutKeysReport }];

export default function KeyReportsTab() {
  const [activeReport, setActiveReport] = useState(REPORTS[0].key);
  const ActiveComponent = REPORTS.find((r) => r.key === activeReport)?.Component;

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>Key reports</h2>
      {REPORTS.length > 1 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
          {REPORTS.map((r) => (
            <button
              key={r.key}
              onClick={() => setActiveReport(r.key)}
              style={{
                border: `1px solid ${activeReport === r.key ? colors.mossDark : colors.lineStrong}`,
                background: activeReport === r.key ? colors.mossDark : "transparent",
                color: activeReport === r.key ? "#FFFFFF" : colors.inkSoft,
                borderRadius: "999px",
                padding: "6px 14px",
                fontFamily: fonts.body,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}
      {ActiveComponent && <ActiveComponent />}
    </div>
  );
}
