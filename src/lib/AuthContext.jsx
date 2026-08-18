import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient.js";
import { loadTerminology } from "./terminology.js";

const AuthContext = createContext(null);

// "View as" is a purely client-side role fake for admin
// testing/training -- it never mints a real session for the target
// person, so every write still happens under the real signed-in admin.
// sessionStorage (not localStorage) so it can't silently survive past
// the tab closing.
const VIEWING_AS_STORAGE_KEY = "auth:viewingAs";

function loadStoredViewingAs() {
  try {
    const raw = sessionStorage.getItem(VIEWING_AS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [profile, setProfile] = useState(null);
  const [org, setOrg] = useState(null);
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [terminology, setTerminology] = useState({});
  const [loading, setLoading] = useState(true);
  const [deactivated, setDeactivated] = useState(false);
  const [viewingAsProfile, setViewingAsProfile] = useState(() => loadStoredViewingAs()?.viewAs ?? null);
  // The real target person's id, kept separate from viewingAsProfile.id
  // (which stays the admin's own id, see startViewingAs below) -- only
  // used to look up the target's real group memberships for the Jobs
  // list visibility simulation. Null for a bare-role "view as" pick,
  // since there's no real person to look up.
  const [viewingAsTargetId, setViewingAsTargetId] = useState(() => loadStoredViewingAs()?.targetId ?? null);
  const loadedUserIdRef = useRef(null);

  const loadProfileAndScope = useCallback(async (user) => {
    setDeactivated(false);
    const userId = user.id;

    // A profile that has ever scanned in at a kiosk carries
    // app_metadata.login_context on its auth.users row (stamped
    // server-side by rfid-login -- see 34-key-station-login-context.sql).
    // That's a user-level field, not a session-level one, so it persists
    // across every future login -- including a completely normal desktop
    // one -- until explicitly cleared. Outside a kiosk path, a leftover
    // claim would otherwise force App.jsx's isKiosk check to send a normal
    // login straight back into the kiosk view. clear-login-context resets
    // it (only ever touching the caller's own row), then refreshSession
    // mints a fresh token reflecting the change immediately.
    if (!window.location.pathname.startsWith("/kiosk") && user.app_metadata?.login_context) {
      await supabase.functions.invoke("clear-login-context");
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session) setSession(refreshed.session);
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, org_id, role_id, display_name, is_contractor, dnd_enabled, is_active, roles(name)")
      .eq("id", userId)
      .single();
    if (profileError) {
      console.error("Failed to load profile", profileError);
      setLoading(false);
      return;
    }

    // Belt-and-braces on top of the hard ban set by manage-users: an
    // access token issued before deactivation is still technically
    // valid until it expires, so check is_active on every load too.
    if (profileRow.is_active === false) {
      setDeactivated(true);
      setLoading(false);
      await supabase.auth.signOut();
      return;
    }

    setProfile(profileRow);
    loadedUserIdRef.current = userId;

    const { data: orgRow, error: orgError } = await supabase
      .from("organisations")
      .select("id, name")
      .eq("id", profileRow.org_id)
      .single();
    if (orgError) console.error("Failed to load organisation", orgError);
    setOrg(orgRow || null);

    const { data: scopeRows, error: scopeError } = await supabase
      .from("site_scope")
      .select("sites(id, name, site_type, terminology_overrides, branding_overrides)")
      .eq("profile_id", userId);
    if (scopeError) console.error("Failed to load site scope", scopeError);

    const scopedSites = (scopeRows || []).map((row) => row.sites).filter(Boolean);
    setSites(scopedSites);

    // Exactly one site in scope -> skip the site picker entirely.
    const chosenSite = scopedSites.length === 1 ? scopedSites[0] : null;
    setActiveSite(chosenSite);

    if (chosenSite) {
      const terms = await loadTerminology(chosenSite);
      setTerminology(terms);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfileAndScope(data.session.user);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "SIGNED_IN") {
        // supabase-js re-fires SIGNED_IN (not just TOKEN_REFRESHED) every
        // time the tab regains focus, as part of its "recover session from
        // storage" check on visibilitychange -- not just on an actual new
        // sign-in. Re-running the full profile/org/site load on every one
        // of those was throwing the app back to the loading screen (and
        // unmounting whatever page/form was open) every time the user
        // switched back to the tab. Only treat it as a real sign-in if the
        // signed-in user has actually changed.
        if (loadedUserIdRef.current !== newSession.user.id) {
          setLoading(true);
          loadProfileAndScope(newSession.user);
        }
      } else if (event === "SIGNED_OUT") {
        loadedUserIdRef.current = null;
        setProfile(null);
        setOrg(null);
        setSites([]);
        setActiveSite(null);
        setTerminology({});
        setLoading(false);
        setViewingAsProfile(null);
        setViewingAsTargetId(null);
        sessionStorage.removeItem(VIEWING_AS_STORAGE_KEY);
      }
      // Anything else (TOKEN_REFRESHED, INITIAL_SESSION, USER_UPDATED) just
      // swaps in an updated token -- profile/org/site haven't changed, so
      // don't re-run the full load.
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfileAndScope]);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  // fakedProfile comes from list_org_users() (id, display_name, role_id,
  // role_name, is_contractor) -- reshaped to look like a real profile row
  // so every existing `profile.x` read (usePermissions, Layout, etc.) just
  // works without knowing "view as" exists. org_id/id below stay the REAL
  // admin's, not the target's, since every actual query still runs under
  // the admin's real Supabase session/RLS -- only role-gated UI changes.
  const startViewingAs = useCallback(
    (fakedProfile) => {
      const viewAs = {
        id: profile.id,
        org_id: profile.org_id,
        role_id: fakedProfile.role_id,
        display_name: fakedProfile.display_name,
        is_contractor: fakedProfile.is_contractor,
        dnd_enabled: false,
        is_active: true,
        roles: { name: fakedProfile.role_name },
      };
      // fakedProfile.id is the real target's id when a specific person
      // was picked (it's their row from list_org_users), and undefined
      // for a bare-role pick -- targetId stays null in that case.
      const targetId = fakedProfile.id ?? null;
      setViewingAsProfile(viewAs);
      setViewingAsTargetId(targetId);
      sessionStorage.setItem(VIEWING_AS_STORAGE_KEY, JSON.stringify({ viewAs, targetId }));
    },
    [profile]
  );

  const stopViewingAs = useCallback(() => {
    setViewingAsProfile(null);
    setViewingAsTargetId(null);
    sessionStorage.removeItem(VIEWING_AS_STORAGE_KEY);
  }, []);

  const value = {
    session,
    profile: viewingAsProfile || profile,
    realProfile: profile,
    viewingAs: Boolean(viewingAsProfile),
    viewingAsTargetId,
    startViewingAs,
    stopViewingAs,
    org,
    sites,
    activeSite,
    setActiveSite,
    terminology,
    loading,
    deactivated,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
