import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import RfidScanListener from "../../components/RfidScanListener.jsx";
import { colors, fonts, space } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, PageHeader, Select } from "../../ui/index.js";

export default function RfidTagsTab() {
  const { org } = useAuth();
  const [tags, setTags] = useState([]);
  const [people, setPeople] = useState([]);
  const [error, setError] = useState(null);
  const [scannedUid, setScannedUid] = useState(null);
  const [assignProfileId, setAssignProfileId] = useState("");

  function refresh() {
    Promise.all([
      supabase.from("rfid_tags").select("id, tag_uid, created_at, profiles(id, display_name)").order("created_at"),
      supabase.from("profiles").select("id, display_name").eq("org_id", org.id).order("display_name"),
    ]).then(([{ data: t, error: err }, { data: p }]) => {
      if (err) setError(err.message);
      else setTags(t || []);
      setPeople(p || []);
    });
  }

  useEffect(refresh, [org]);

  function handleScan(uid) {
    const existing = tags.find((t) => t.tag_uid === uid);
    if (existing) {
      setError(`This fob is already registered to ${existing.profiles?.display_name || "someone else"}.`);
      setScannedUid(null);
      setAssignProfileId("");
      return;
    }
    setError(null);
    setScannedUid(uid);
    setAssignProfileId("");
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!scannedUid || !assignProfileId) return;
    const { error: err } = await supabase.from("rfid_tags").insert({ tag_uid: scannedUid, profile_id: assignProfileId });
    if (err) {
      if (err.code === "23505") {
        const existing = tags.find((t) => t.tag_uid === scannedUid);
        setError(`This fob is already registered${existing ? ` to ${existing.profiles?.display_name}` : ""}.`);
      } else {
        setError(err.message);
      }
      return;
    }
    setScannedUid(null);
    setAssignProfileId("");
    refresh();
  }

  async function handleRevoke(id) {
    const { error: err } = await supabase.from("rfid_tags").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div>
      <PageHeader title="RFID fobs" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Registered fobs let staff sign in at the workshop kiosk by scanning instead of using a magic-link email.
      </p>

      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      {tags.map((t) => (
        <Card pad="sm" key={t.id} style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{t.profiles?.display_name || "Unknown"}</div>
            <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, fontFamily: fonts.mono }}>{t.tag_uid}</div>
          </div>
          <Button variant="danger" onClick={() => handleRevoke(t.id)}>Revoke</Button>
        </Card>
      ))}
      {tags.length === 0 && <EmptyState title="No fobs registered yet" />}

      <Card pad="md" style={{ maxWidth: "var(--width-base)", marginTop: "var(--space-4)" }}>
        <PageHeader title="Register a new fob" level={2} />
        <RfidScanListener onScan={handleScan} />
        {!scannedUid && (
          <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>
            Scan a fob on the reader connected to this computer.
          </p>
        )}
        {scannedUid && (
          <form onSubmit={handleAssign}>
            <p style={{ fontSize: "var(--text-sm)", fontFamily: fonts.mono }}>Scanned tag: {scannedUid}</p>
            <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, marginBottom: "var(--space-2)" }}>Assign to</label>
            <Select required value={assignProfileId} onChange={(e) => setAssignProfileId(e.target.value)} style={{ marginBottom: "var(--space-3)" }}>
              <option value="">—</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>{p.display_name}</option>
              ))}
            </Select>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="primary" type="submit">Save</Button>
              <Button onClick={() => setScannedUid(null)}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
