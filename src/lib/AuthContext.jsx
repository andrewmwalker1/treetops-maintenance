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

// Set by Login.jsx right before signInWithOtp (which is what sends BOTH the
// magic link and the 8-digit code, so one flag placement covers whichever
// one the person completes with). Read once, on the very next sign-in this
// tab processes -- see loadProfileAndScope for why this, and not "is the
// pathname non-kiosk", is what's safe to key clearing a stale login_context
// claim off of. localStorage (not sessionStorage) because the magic-link
// half of the flow is a full-page redirect through Supabase's own domain,
// which can land in a fresh tab depending on the browser/email client.
const PENDING_NORMAL_LOGIN_KEY = "auth:pendingNormalLogin";
const PENDING_NORMAL_LOGIN_WINDOW_MS = 2 * 60 * 1000;

function consumePendingNormalLogin() {
  const raw = localStorage.getItem(PENDING_NORMAL_LOGIN_KEY);
  localStorage.removeItem(PENDING_NORMAL_LOGIN_KEY);
  return Boolean(raw) && Date.now() - Number(raw) < PENDING_NORMAL_LOGIN_WINDOW_MS;
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
  // Fetched here (rather than via the async usePermissions() hook every
  // other permission check uses) specifically so it's settled BEFORE
  // `loading` goes false -- App.jsx gates the entire desktop <Layout> on
  // this, and usePermissions()'s own fetch resolving a tick later would
  // otherwise flash a "no access" screen for every user on every load,
  // not just the ones actually being restricted.
  const [canAccessDesktop, setCanAccessDesktop] = useState(true);
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
    // one -- until explicitly cleared.
    //
    // IMPORTANT: this must only ever clear on a session that was JUST NOW
    // established by a real credential (magic link / code), never on a
    // plain page reload or session rehydration -- "pathname isn't /kiosk"
    // is NOT a safe signal for that, because a hard reload of an ACTUAL
    // live kiosk session (e.g. someone editing the URL to escape it) looks
    // identical from here: same non-kiosk pathname, same claim present.
    // An earlier version of this check used pathname alone and would
    // silently clear the claim on exactly that escape attempt, defeating
    // App.jsx's kiosk confinement the moment someone tried it. The pending-
    // login flag (set by Login.jsx immediately before signInWithOtp, and
    // consumed here at most once within a couple of minutes) is what
    // actually distinguishes "a normal login just happened" from "an
    // existing session got reloaded."
    if (consumePendingNormalLogin() && user.app_metadata?.login_context) {
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

    const { data: desktopGrant } = await supabase
      .from("role_permissions")
      .select("enabled")
      .eq("role_id", profileRow.role_id)
      .eq("permission_key", "can_access_desktop")
      .maybeSingle();
    setCanAccessDesktop(Boolean(desktopGrant?.enabled));

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
    canAccessDesktop,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
