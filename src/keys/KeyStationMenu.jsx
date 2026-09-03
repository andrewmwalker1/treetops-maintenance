import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { usePermissions } from "../lib/permissions.js";
import { queryOpenKeyCheckouts, keyLocationLabel, keyIssuedToLabel, timeAgo, KEY_GROUPS } from "../lib/keysOutSummary.js";
import RfidScanListener from "../components/RfidScanListener.jsx";
import StatDial from "../components/StatDial.jsx";
import { colors } from "../lib/theme.js";
import { Action, ActionList, Alert, Button, Card, IconArrowLeft, IconKeys, PageHeader } from "../ui/index.js";


export default function KeyStationMenu() {
  const navigate = useNavigate();
  const { profile, activeSite, signOut } = useAuth();
  const permissions = usePermissions();
  const [openCheckouts, setOpenCheckouts] = useState(null); // null = loading
  const [detailGroup, setDetailGroup] = useState(null); // { label, rows } | null
  const [scanError, setScanError] = useState(null);

  // Andy's ask: the same "keys currently out" visibility the main app's
  // Dashboard has, but on the key station itself, since staff mostly live
  // here rather than the desktop app -- as a row of dials (StatDial.jsx,
  // same component the Dashboard uses) rather than text, to make better
  // use of a kiosk screen's limited height, and tappable to drill into
  // which keys make up that count. A trusted contractor's own login
  // (profile.contractor_id set -- 43-contractor-linked-profiles.sql) gets
  // a narrower view scoped to just their own company instead of the full
  // org breakdown, which isn't their business to see.
  useEffect(() => {
    if (!activeSite) return;
    queryOpenKeyCheckouts(activeSite.id).then(setOpenCheckouts);
  }, [activeSite]);

  const myCheckouts = (openCheckouts || []).filter((c) => c.checked_out_by_profile?.id === profile?.id);
  const myCompanyCheckouts = profile?.contractor_id
    ? (openCheckouts || []).filter((c) => c.issued_to_contractor?.id === profile.contractor_id)
    : [];

  function openDetail(label, rows) {
    if (rows.length === 0) return;
    setDetailGroup({ label, rows });
  }

  // Andy: standing at the cupboard, scanning the key in hand should be
  // enough on its own to get to the right screen -- no need to first tap
  // "Check out" or "Check in" and then scan again. This looks the tag up
  // itself (rather than just guessing from openCheckouts, which only knows
  // about tags currently out) so a lost/handed-over/unallocated tag gets a
  // clear reason instead of silently landing on the wrong screen. The
  // target screen re-does its own fetch and only auto-selects the tag if
  // it's still there (see useKeyCheckout.js/useKeyCheckin.js's presetTagId
  // handling) -- if it isn't (someone else got there first), it just falls
  // back to the ordinary picker rather than erroring twice.
  async function handleScan(uid) {
    setScanError(null);
    const { data: tag, error: err } = await supabase
      .from("key_tags")
      .select("id, status, pitch_id, special_location_id")
      .eq("site_id", activeSite.id)
      .eq("tag_uid", uid)
      .maybeSingle();
    if (err) {
      setScanError(err.message);
      return;
    }
    if (!tag) {
      setScanError("That tag isn't registered here.");
      return;
    }
    if (tag.status !== "active") {
      setScanError(tag.status === "lost" ? "This tag is marked lost." : "This key has already been handed over to its owner.");
      return;
    }
    if (!tag.pitch_id && !tag.special_location_id) {
      setScanError("This tag isn't allocated to a pitch yet — see Admin ▸ Key Tags.");
      return;
    }
    const { data: openCheckout, error: coErr } = await supabase
      .from("key_checkouts")
      .select("id")
      .eq("key_tag_id", tag.id)
      .is("checked_in_at", null)
      .maybeSingle();
    if (coErr) {
      setScanError(coErr.message);
      return;
    }
    navigate(openCheckout ? "/keys/checkin" : "/keys/checkout", { state: { presetTagId: tag.id } });
  }

  if (detailGroup) {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "640px", margin: "0 auto" }}>
        <Button onClick={() => setDetailGroup(null)} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Back
        </Button>
        <PageHeader title={detailGroup.label} />
        {detailGroup.rows.map((c) => (
          <Card key={c.id} pad="lg" style={{ marginBottom: "var(--space-3)" }}>
            <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-md)", fontWeight: 600 }}>{keyLocationLabel(c)}</p>
            <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-base)" }}>Out to {keyIssuedToLabel(c)}</p>
            {c.reason && <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-base)", color: colors.inkSoft }}>Reason: {c.reason}</p>}
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: colors.inkSoft }}>
              Checked out by {c.checked_out_by_profile?.display_name || "—"}, {timeAgo(c.checked_out_at)}
            </p>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-7)", display: "flex", flexDirection: "column", minHeight: "100vh", boxSizing: "border-box" }}>
      <RfidScanListener onScan={handleScan} />
      <PageHeader
        title={`Hi ${profile?.display_name || "there"}`}
        subtitle="Scan a key to check it out or in, or pick what you need below."
      />
      {scanError && (
        <Alert tone="danger" title="Tag not recognised" style={{ marginBottom: "var(--space-4)" }}>
          {scanError}
        </Alert>
      )}

      {openCheckouts !== null && (
        <div style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
          <div style={{ flex: 1 }}>
            <StatDial label="Yours" value={myCheckouts.length} onClick={() => openDetail("Yours", myCheckouts)} />
          </div>
          {profile?.contractor_id ? (
            <div style={{ flex: 1 }}>
              <StatDial label="Your company" value={myCompanyCheckouts.length} onClick={() => openDetail("Your company", myCompanyCheckouts)} />
            </div>
          ) : (
            KEY_GROUPS.map((g) => {
              const rows = openCheckouts.filter(g.match);
              return (
                <div key={g.key} style={{ flex: 1 }}>
                  <StatDial label={g.label} value={rows.length} onClick={() => openDetail(g.label, rows)} />
                </div>
              );
            })
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", flex: 1 }}>
        <ActionList size="kiosk">
          <Action variant="primary" icon={<IconKeys size={24} />} onClick={() => navigate("/keys/checkout")}>
            Check out a key
          </Action>
          <Action variant="primary" icon={<IconKeys size={24} />} onClick={() => navigate("/keys/checkin")}>
            Check in a key
          </Action>
        </ActionList>
        {/* The secondary row stays compact -- these are the occasional
            actions, not what someone walks up to the cupboard to do. */}
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button variant="secondary" size="lg" block onClick={() => navigate("/keys/find")}>
            Find a key
          </Button>
          {permissions.has("can_manage_keys") && (
            <>
              <Button variant="secondary" size="lg" block onClick={() => navigate("/keys/relocate")}>
                Relocate
              </Button>
              <Button variant="secondary" size="lg" block onClick={() => navigate("/keys/force-checkin")}>
                Force check-in
              </Button>
              <Button variant="secondary" size="lg" block onClick={() => navigate("/keys/handover")}>
                Handover
              </Button>
            </>
          )}
        </div>
      </div>
      <Button variant="danger" size="lg" block onClick={() => signOut()} style={{ marginTop: "var(--space-5)" }}>
        Sign out
      </Button>
    </div>
  );
}
