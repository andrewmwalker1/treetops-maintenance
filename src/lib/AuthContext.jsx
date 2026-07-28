import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import { loadTerminology } from "./terminology.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [profile, setProfile] = useState(null);
  const [org, setOrg] = useState(null);
  const [sites, setSites] = useState([]);
  const [activeSite, setActiveSite] = useState(null);
  const [terminology, setTerminology] = useState({});
  const [loading, setLoading] = useState(true);
  const [deactivated, setDeactivated] = useState(false);

  const loadProfileAndScope = useCallback(async (userId) => {
    setDeactivated(false);
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
      if (data.session) loadProfileAndScope(data.session.user.id);
      else setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        setLoading(true);
        loadProfileAndScope(newSession.user.id);
      } else {
        setProfile(null);
        setOrg(null);
        setSites([]);
        setActiveSite(null);
        setTerminology({});
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadProfileAndScope]);

  const signOut = useCallback(() => supabase.auth.signOut(), []);

  const value = {
    session,
    profile,
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
