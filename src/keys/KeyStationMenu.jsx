import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { usePermissions } from "../lib/permissions.js";
import { queryOpenKeyCheckouts, keyLocationLabel, keyIssuedToLabel, timeAgo, KEY_GROUPS } from "../lib/keysOutSummary.js";
import { queryEquipmentSignals } from "../lib/equipmentAvailability.js";
import RfidScanListener from "../components/RfidScanListener.jsx";
import StatDial from "../components/StatDial.jsx";
import { colors } from "../lib/theme.js";
import { Action, ActionList, Alert, Button, Card, IconArrowLeft, IconKeys, PageHeader } from "../ui/index.js";


export default function KeyStationMenu() {
  const navigate = useNavigate();
  const { profile, org, activeSite, signOut } = useAuth();
  const permissions = usePermissions();
  const [openCheckouts, setOpenCheckouts] = useState(null); // null = loading
  const [equipmentSignals, setEquipmentSignals] = useState(null); // { out, faulty } | null
  const [detailGroup, setDetailGroup] = useState(null); // { label, rows, kind: "keys" | "kit" } | null
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

  // Andy (2026-09-28): the same "Kit out" / "Faulty kit" signals as the
  // Dashboard and Office Hub, since staff mostly live on this screen.
  // Staff only -- a contractor's login gets the narrowed key view above,
  // and the park's machinery isn't their business either.
  const showEquipment = !profile?.contractor_id;
  useEffect(() => {
    if (!org || !showEquipment) return;
    queryEquipmentSignals(org.id).then(setEquipmentSignals);
  }, [org, showEquipment]);

  const myCheckouts = (openCheckouts || []).filter((c) => c.checked_out_by_profile?.id === profile?.id);
  const myCompanyCheckouts = profile?.contractor_id
    ? (openCheckouts || []).filter((c) => c.issued_to_contractor?.id === profile.contractor_id)
    : [];

  function openDetail(label, rows, kind = "keys") {
    if (rows.length === 0) return;
    setDetailGroup({ label, rows, kind });
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
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <Button onClick={() => setDetailGroup(null)} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Back
        </Button>
        <PageHeader title={detailGroup.label} />
        {detailGroup.kind === "kit" && detailGroup.rows.map((m) => (
          <Card key={m.id} pad="lg" style={{ marginBottom: "var(--space-3)" }}>
            <p style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-md)", fontWeight: 600 }}>
              {m.equipment?.name || m.name}
            </p>
            <p style={{ margin: 0, fontSize: "var(--text-base)", color: colors.inkSoft }}>
              {m.checked_out_at
                ? `${m.equipment?.equipment_type?.name ? `${m.equipment.equipment_type.name} · ` : ""}Out with ${m.checked_out_by?.display_name || "someone"}, ${timeAgo(m.checked_out_at)}`
                : [m.equipment_type?.name, [m.make, m.model].filter(Boolean).join(" ")].filter(Boolean).join(" · ")}
            </p>
          </Card>
        ))}
        {detailGroup.kind === "keys" && detailGroup.rows.map((c) => (
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
        // Wraps rather than squeezing: six dials is a lot for a narrow
        // screen, and a StatDial's gauge has a fixed width.
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
          <div style={{ flex: "1 1 110px" }}>
            <StatDial label="Yours" value={myCheckouts.length} onClick={() => openDetail("Yours", myCheckouts)} />
          </div>
          {profile?.contractor_id ? (
            <div style={{ flex: "1 1 110px" }}>
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
          {showEquipment && equipmentSignals && (
            <>
              {/* Keys to the left, machines to the right. */}
              <div aria-hidden="true" style={{ width: 1, alignSelf: "stretch", background: colors.lineStrong }} />
              <div style={{ flex: "1 1 110px" }}>
                <StatDial
                  label="Kit out"
                  value={equipmentSignals.out.length}
                  onClick={() => openDetail("Kit out", equipmentSignals.out, "kit")}
                />
              </div>
              <div style={{ flex: "1 1 110px" }}>
                <StatDial
                  label="Faulty kit"
                  value={equipmentSignals.faulty.length}
                  color={equipmentSignals.faulty.length ? colors.immediate : colors.moss}
                  onClick={() => openDetail("Faulty kit", equipmentSignals.faulty, "kit")}
                />
              </div>
            </>
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
