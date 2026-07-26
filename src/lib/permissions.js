// Client-side permission check, for showing/hiding controls only — the
// real enforcement is server-side (RLS policies + the
// enforce_job_reallocation_permission trigger in 02-rls-policies.sql).
// Never trust this hook for anything security-relevant.

import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient.js";
import { useAuth } from "./AuthContext.jsx";

export function usePermissions() {
  const { profile } = useAuth();
  const [keys, setKeys] = useState(new Set());

  useEffect(() => {
    if (!profile?.role_id) return;
    supabase
      .from("role_permissions")
      .select("permission_key, enabled")
      .eq("role_id", profile.role_id)
      .then(({ data, error }) => {
        if (error) {
          console.error("Failed to load permissions", error);
          return;
        }
        setKeys(new Set(data.filter((row) => row.enabled).map((row) => row.permission_key)));
      });
  }, [profile?.role_id]);

  return keys;
}
