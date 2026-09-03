import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, text } from "../../lib/theme.js";
import { Alert, Button, Card, Chip, EmptyState, Input, PageHeader, SkeletonList, Table } from "../../ui/index.js";

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
      <PageHeader title="Pitches with no keys" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Every pitch with no active key tag registered against it — includes pitches that never had one, and pitches whose only key has since been
        marked lost or handed over with no duplicate left behind.
      </p>
      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}
      {loading && <SkeletonList rows={3} />}
      {!loading && !error && (
        <>
          <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>
            {missing.length} of {pitches.length} pitches.
          </p>
          {missing.length === 0 ? (
            <p style={{ color: colors.inkSoft }}>Every pitch has at least one active key.</p>
          ) : (
            <>
              <Input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter by pitch…" style={{ marginBottom: "var(--space-3)" }} />
              {visible.length === 0 ? (
                <EmptyState
                  title="Nothing matches this filter"
                  action={
                    <Button size="sm" onClick={() => setSearch("")}>
                      Clear
                    </Button>
                  }
                />
              ) : (
                <Card pad="md" style={{ overflowX: "auto", maxWidth: "var(--width-sm)" }}>
                  <Table>
                    <thead>
                      <tr>
                        <th>Pitch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((p) => (
                        <tr key={p.id}>
                          <td>{p.pitch_number_or_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card>
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
      <PageHeader title="Key reports" level={2} />
      {REPORTS.length > 1 && (
        <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
          {REPORTS.map((r) => (
            <Chip
              key={r.key}
              active={activeReport === r.key}
              onClick={() => setActiveReport(r.key)}
            >
              {r.label}
            </Chip>
          ))}
        </div>
      )}
      {ActiveComponent && <ActiveComponent />}
    </div>
  );
}
