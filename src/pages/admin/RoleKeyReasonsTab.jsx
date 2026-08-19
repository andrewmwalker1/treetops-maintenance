import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import KeyReasonsModal from "./KeyReasonsModal.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

// Preset key check-out reasons for staff checking a key out for
// themselves (issued_to_kind "self" on KeyStationCheckOut.jsx), by role --
// e.g. Sam's "Caravan Prep" role might have "Clean the caravan", "At the
// request of the owner", "Dress the caravan". Contractor-side presets are
// the equivalent "Key reasons" button on the Contractors tab -- kept
// separate rather than merged into one screen since they're two different
// lists a reader would look for in two different places (roles vs.
// contractors), same reasoning as Key Tags and Key Activity Log being
// separate tabs rather than one.
// Customer/guest checkouts aren't tied to a specific person or role, so
// their presets (key_reason_presets, kind = 'customer'/'guest') are
// org-wide rather than keyed to a role/contractor row -- same
// KeyReasonsModal, just with ownerColumn="kind" and a fixed string id
// instead of a role's uuid.
const FIXED_REASON_OWNERS = [
  { id: "customer", label: "Customer" },
  { id: "guest", label: "Guest" },
];

export default function RoleKeyReasonsTab() {
  const { org } = useAuth();
  const [roles, setRoles] = useState([]);
  const [reasonsFor, setReasonsFor] = useState(null); // { kind: "role" | "fixed", id, name } whose modal is open, or null

  useEffect(() => {
    if (!org) return;
    supabase.from("roles").select("id, name").eq("org_id", org.id).order("name").then(({ data }) => setRoles(data || []));
  }, [org]);

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>Key reasons</h2>
      <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
        Preset reasons shown on the key-station check-out screen. Self-checkouts use presets from the person's own role; customer and guest checkouts
        use the standard reasons below. Contractor presets are managed from the Contractors tab.
      </p>

      {roles.map((r) => (
        <div key={r.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div style={{ fontWeight: 600 }}>{r.name}</div>
          <button onClick={() => setReasonsFor({ kind: "role", id: r.id, name: r.name })} style={buttonStyle.secondary}>Reasons</button>
        </div>
      ))}
      {roles.length === 0 && <p style={{ color: colors.inkSoft }}>No roles set up yet.</p>}

      <h3 style={{ fontFamily: fonts.display, fontSize: "14px", color: colors.mossDark, marginTop: "20px" }}>Standard reasons</h3>
      {FIXED_REASON_OWNERS.map((f) => (
        <div key={f.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div style={{ fontWeight: 600 }}>{f.label}</div>
          <button onClick={() => setReasonsFor({ kind: "fixed", id: f.id, name: f.label })} style={buttonStyle.secondary}>Reasons</button>
        </div>
      ))}

      {reasonsFor && (
        <KeyReasonsModal
          title={`${reasonsFor.name} — Key reasons`}
          table={reasonsFor.kind === "role" ? "role_key_reasons" : "key_reason_presets"}
          ownerColumn={reasonsFor.kind === "role" ? "role_id" : "kind"}
          ownerId={reasonsFor.id}
          extraFields={reasonsFor.kind === "fixed" ? { org_id: org.id } : undefined}
          onClose={() => setReasonsFor(null)}
        />
      )}
    </div>
  );
}
