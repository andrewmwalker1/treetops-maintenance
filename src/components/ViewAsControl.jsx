import { useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts } from "../lib/theme.js";

// Admin-only. Lets Andy (or another can_manage_users holder) fake being a
// different role client-side for training/demoing screens -- NOT a real
// impersonation. Every write during "view as" still happens under the
// real admin's own Supabase session, since list_org_users() never mints
// a session for the target person. See AuthContext.jsx's startViewingAs.
function useViewAsCandidates() {
  const { realProfile, viewingAs } = useAuth();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (viewingAs) return;
    supabase
      .rpc("list_org_users")
      .then(({ data, error }) => {
        // Most likely cause of an error here: caller doesn't hold
        // can_manage_users, in which case list_org_users() legitimately
        // returns nothing -- not worth surfacing, the picker just hides.
        if (error) {
          setUsers([]);
          return;
        }
        setUsers((data || []).filter((u) => u.is_active && u.id !== realProfile?.id));
      });
  }, [viewingAs, realProfile?.id]);

  return users;
}

export function ViewAsPicker() {
  const { startViewingAs } = useAuth();
  const [picked, setPicked] = useState("");
  const users = useViewAsCandidates();

  if (users.length === 0) return null;

  return (
    <select
      value={picked}
      onChange={(e) => {
        const user = users.find((u) => u.id === e.target.value);
        setPicked("");
        if (user) startViewingAs(user);
      }}
      style={{
        border: `1px solid ${colors.lineStrong}`,
        borderRadius: "999px",
        padding: "6px 14px",
        fontFamily: fonts.body,
        fontSize: "13px",
        color: colors.inkSoft,
        background: "transparent",
      }}
    >
      <option value="">View as…</option>
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.display_name} ({u.role_name})
        </option>
      ))}
    </select>
  );
}

export function ViewAsBanner() {
  const { profile, viewingAs, stopViewingAs } = useAuth();
  if (!viewingAs) return null;

  return (
    <div
      style={{
        background: colors.mossDark,
        color: "#FFFFFF",
        padding: "8px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "10px",
        flexWrap: "wrap",
        fontFamily: fonts.body,
        fontSize: "13px",
      }}
    >
      <span>
        Viewing as <strong>{profile.display_name}</strong> ({profile.roles?.name}) -- your data, faked permissions
      </span>
      <button
        onClick={stopViewingAs}
        style={{
          background: "#FFFFFF",
          color: colors.mossDark,
          border: "none",
          borderRadius: "999px",
          padding: "4px 12px",
          cursor: "pointer",
          fontFamily: fonts.body,
          fontSize: "13px",
          fontWeight: 600,
        }}
      >
        Return to my view
      </button>
    </div>
  );
}
