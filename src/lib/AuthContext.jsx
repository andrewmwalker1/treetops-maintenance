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

// Set by KioskSignIn.jsx/KeyStationSignIn.jsx right before redirecting to
// the magic link rfid-login returns (localStorage, not sessionStorage, for
// the same reason as the normal-login flag below: that redirect goes
// through Supabase's own domain and can land in a fresh tab). Consumed once
// here, on the very next session this tab picks up, to register that
// session against terminal_sessions -- see loadProfileAndScope and
// 46-terminal-session-scoped-login-context.sql for why this has to happen
// AFTER a session exists, not inside rfid-login itself (no session exists
// yet at magic-link-generation time).
const PENDING_TERMINAL_LOGIN_KEY = "auth:pendingTerminalLogin";
const PENDING_TERMINAL_LOGIN_WINDOW_MS = 2 * 60 * 1000;

function consumePendingTerminalLogin() {
  const raw = localStorage.getItem(PENDING_TERMINAL_LOGIN_KEY);
  localStorage.removeItem(PENDING_TERMINAL_LOGIN_KEY);
  if (!raw) return null;
  try {
    const { context, ts } = JSON.parse(raw);
    if (Date.now() - ts >= PENDING_TERMINAL_LOGIN_WINDOW_MS) return null;
    return context || null;
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

    // A kiosk/key-station sign-in registers its own session_id against
    // terminal_sessions (46-terminal-session-scoped-login-context.sql),
    // which a Postgres Auth Hook then uses to add app_metadata.login_context
    // to just THAT session's JWT -- never touching auth.users itself, so no
    // other session for this same person is ever affected. rfid-login can't
    // do this registration itself (no session exists yet when it mints the
    // magic link), so it happens here, the first time this freshly-landed
    // session is loaded -- gated on the pending-terminal-login flag
    // KioskSignIn.jsx/KeyStationSignIn.jsx set right before redirecting, so
    // a plain reload of an already-registered session never re-registers.
    const pendingTerminalContext = consumePendingTerminalLogin();
    if (pendingTerminalContext) {
      const { error: registerError } = await supabase.functions.invoke("register-terminal-session", {
        body: { context: pendingTerminalContext },
      });
      if (registerError) {
        console.error("Failed to register terminal session", registerError);
      } else {
        // This session's JWT was minted before its terminal_sessions row
        // existed, so it doesn't carry app_metadata.login_context yet --
        // refresh once so App.jsx sees it on this very load, not just after
        // the next natural token refresh.
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (refreshed?.session) setSession(refreshed.session);
      }
    }

    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, org_id, role_id, display_name, is_contractor, contractor_id, dnd_enabled, is_active, roles(name)")
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
  // role_name, is_contractor, contractor_id) -- reshaped to look like a real profile row
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
        contractor_id: fakedProfile.contractor_id ?? null,
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
