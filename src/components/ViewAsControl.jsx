import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { usePermissions } from "../lib/permissions.js";
import { supabase } from "../lib/supabaseClient.js";
import { colors, fonts } from "../lib/theme.js";

// Admin-only. Lets Andy (or another can_manage_users holder) fake being a
// different role client-side for training/demoing screens -- NOT a real
// impersonation. Every write during "view as" still happens under the
// real admin's own Supabase session, since neither list_org_users() nor
// the plain roles table read mints a session for anyone. See
// AuthContext.jsx's startViewingAs.
//
// Two ways in: a specific person (their actual role, whoever they are
// today) or a bare role (e.g. "Maintenance" with nobody picked -- useful
// when no one currently holds that role, or you just want the role's
// screens without any one person's name attached).
function useViewAsCandidates() {
  const { realProfile, viewingAs } = useAuth();
  // Gate on the REAL profile's permissions, not the (possibly faked)
  // current profile -- this hook only runs while viewingAs is false
  // anyway (see below), so profile === realProfile at that point, but
  // being explicit here avoids that ever being a silent assumption.
  const permissions = usePermissions();
  const [people, setPeople] = useState([]);
  const [roles, setRoles] = useState([]);

  const refresh = useCallback(() => {
    if (viewingAs || !permissions.has("can_manage_users")) {
      setPeople([]);
      setRoles([]);
      return;
    }
    supabase
      .rpc("list_org_users")
      .then(({ data, error }) => {
        if (error) {
          setPeople([]);
          return;
        }
        setPeople((data || []).filter((u) => u.is_active && u.id !== realProfile?.id));
      });
    supabase
      .from("roles")
      .select("id, name")
      .eq("org_id", realProfile?.org_id)
      .order("name")
      .then(({ data, error }) => setRoles(error ? [] : data || []));
  }, [viewingAs, permissions, realProfile?.id, realProfile?.org_id]);

  // Layout (and this picker with it) mounts once for the whole session --
  // it never remounts just from navigating around the app -- so a fetch
  // on mount alone would go stale the moment someone's invited mid-session
  // and go looking for them in "View as" without a page reload. Refetch on
  // mount AND every time the dropdown is actually opened.
  useEffect(refresh, [refresh]);

  return { people, roles, refresh };
}

export function ViewAsPicker() {
  const { startViewingAs } = useAuth();
  const [picked, setPicked] = useState("");
  const { people, roles, refresh } = useViewAsCandidates();

  if (people.length === 0 && roles.length === 0) return null;

  function handleChange(e) {
    const value = e.target.value;
    setPicked("");
    if (!value) return;
    const colonIdx = value.indexOf(":");
    const kind = value.slice(0, colonIdx);
    const id = value.slice(colonIdx + 1);
    if (kind === "person") {
      const user = people.find((u) => u.id === id);
      if (user) startViewingAs(user);
    } else if (kind === "role") {
      const role = roles.find((r) => r.id === id);
      if (role) {
        startViewingAs({
          role_id: role.id,
          role_name: role.name,
          display_name: `${role.name} (no one picked)`,
          is_contractor: false,
        });
      }
    }
  }

  return (
    <select
      value={picked}
      onChange={handleChange}
      onFocus={refresh}
      style={{
        border: `1px solid ${colors.lineStrong}`,
        borderRadius: "var(--radius-full)",
        padding: "var(--space-2) var(--space-4)",
        fontFamily: fonts.body,
        fontSize: "13px",
        color: colors.inkSoft,
        background: "transparent",
      }}
    >
      <option value="">View as…</option>
      {roles.length > 0 && (
        <optgroup label="By role (no one picked)">
          {roles.map((r) => (
            <option key={`role:${r.id}`} value={`role:${r.id}`}>
              {r.name}
            </option>
          ))}
        </optgroup>
      )}
      {people.length > 0 && (
        <optgroup label="By person">
          {people.map((u) => (
            <option key={`person:${u.id}`} value={`person:${u.id}`}>
              {u.display_name} ({u.role_name})
            </option>
          ))}
        </optgroup>
      )}
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
        color: colors.onDark,
        padding: "var(--space-2) var(--space-5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-3)",
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
          background: colors.onDark,
          color: colors.mossDark,
          border: "none",
          borderRadius: "var(--radius-full)",
          padding: "var(--space-1) var(--space-3)",
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
