import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { usePermissions } from "../lib/permissions.js";
import { queryOpenKeyCheckouts, keyLocationLabel, keyIssuedToLabel, timeAgo, KEY_GROUPS } from "../lib/keysOutSummary.js";
import RfidScanListener from "../components/RfidScanListener.jsx";
import StatDial from "../components/StatDial.jsx";
import { colors } from "../lib/theme.js";
import { Action, ActionList, Alert, Button, Card, PageHeader } from "../ui/primitives.jsx";
import { IconAlert, IconArrowLeft, IconKeys, IconSearch } from "../ui/icons.jsx";

// The in-app landing for the "Keys" nav link -- lives at /key-register
// rather than /keys because App.jsx's isKeyStation check treats any
// /keys/* path as the physical key-cupboard kiosk and would hijack this
// into a full-screen takeover. Mirrors KeyStationMenu.jsx in full (Andy's
// ask, 2026-08-25): the same "keys currently out" dashboard row (yours /
// your company if a contractor, otherwise the staff/contractors/customers
// breakdown, tap to drill in), and Relocate/Force check-in alongside
// check-out/check-in/find, gated the same way -- can_manage_keys, not just
// can_use_key_system (already enforced one level up by KeysGate).
export default function KeysHome() {
  const navigate = useNavigate();
  const { profile, activeSite } = useAuth();
  const permissions = usePermissions();
  const [openCheckouts, setOpenCheckouts] = useState(null); // null = loading
  const [detailGroup, setDetailGroup] = useState(null); // { label, rows } | null
  const [scanError, setScanError] = useState(null);

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

  // Same scan-to-the-right-screen shortcut as KeyStationMenu.jsx's
  // handleScan -- staff on their own phone (not necessarily stood at the
  // cupboard, but a fob reader could still be attached) get the same
  // "scan it, go straight to check-out/check-in" behaviour.
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
    navigate(openCheckout ? "/key-register/checkin" : "/key-register/checkout", { state: { presetTagId: tag.id } });
  }

  if (detailGroup) {
    return (
      <div style={{ maxWidth: "var(--width-xl)" }}>
        <Button variant="secondary" icon={<IconArrowLeft size={15} />} onClick={() => setDetailGroup(null)} style={{ marginBottom: "var(--space-4)" }}>
          Back
        </Button>
        <PageHeader title={detailGroup.label} subtitle={`${detailGroup.rows.length} out`} />
        {detailGroup.rows.map((c) => (
          <Card key={c.id} style={{ marginBottom: "var(--space-2)" }}>
            <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-base)", fontWeight: 600 }}>{keyLocationLabel(c)}</p>
            <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-sm)" }}>Out to {keyIssuedToLabel(c)}</p>
            {c.reason && (
              <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-sm)", color: colors.inkSoft }}>Reason: {c.reason}</p>
            )}
            <p style={{ margin: 0, fontSize: "var(--text-xs)", color: colors.inkSoft }}>
              Checked out by {c.checked_out_by_profile?.display_name || "—"}, {timeAgo(c.checked_out_at)}
            </p>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "var(--width-xl)" }}>
      <RfidScanListener onScan={handleScan} />
      <PageHeader title="Keys" subtitle="Scan a key to check it out or in, or pick what you need below." />
      {scanError && (
        <Alert tone="danger" style={{ marginBottom: "var(--space-4)" }}>
          {scanError}
        </Alert>
      )}

      {openCheckouts !== null && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "var(--space-3)",
            marginBottom: "var(--space-5)",
          }}
        >
          <StatDial label="Yours" value={myCheckouts.length} onClick={() => openDetail("Yours", myCheckouts)} />
          {profile?.contractor_id ? (
            <StatDial label="Your company" value={myCompanyCheckouts.length} onClick={() => openDetail("Your company", myCompanyCheckouts)} />
          ) : (
            KEY_GROUPS.map((g) => {
              const rows = openCheckouts.filter(g.match);
              return <StatDial key={g.key} label={g.label} value={rows.length} onClick={() => openDetail(g.label, rows)} />;
            })
          )}
        </div>
      )}

      <ActionList>
        <Action as={Link} to="/key-register/checkout" variant="primary" icon={<IconKeys size={18} />}>
          Check out a key
        </Action>
        <Action as={Link} to="/key-register/checkin" variant="primary" icon={<IconKeys size={18} />}>
          Check in a key
        </Action>
        <Action as={Link} to="/key-register/find" icon={<IconSearch size={18} />}>
          Find a key
        </Action>
        {permissions.has("can_manage_keys") && (
          <>
            <Action as={Link} to="/key-register/relocate">
              Relocate a key
            </Action>
            <Action as={Link} to="/key-register/force-checkin" variant="danger" icon={<IconAlert size={18} />}>
              Force check-in
            </Action>
            <Action as={Link} to="/key-register/handover">
              Handover a key
            </Action>
          </>
        )}
      </ActionList>
    </div>
  );
}
