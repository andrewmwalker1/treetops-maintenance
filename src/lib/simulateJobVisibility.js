// Client-side reimplementation of can_see_job() (supabase/02-rls-policies.sql)
// used ONLY to approximate what a faked "View as" role/person would see in
// a Jobs list. Only ever consulted while viewingAs is true -- the real
// access control stays server-side RLS, completely unaffected either way.
// Deliberately skips is_platform_admin()/has_site_scope(): this org only
// ever has one site in practice (see SYSTEMSPEC.md §17), and the query
// this filters is already scoped to activeSite.id.
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { usePermissions } from "./permissions.js";
import { supabase } from "./supabaseClient.js";

export function useViewAsJobFilter() {
  const { profile, viewingAs, viewingAsTargetId } = useAuth();
  const permissions = usePermissions();
  const [visibleRoleIds, setVisibleRoleIds] = useState(new Set());
  const [groupIds, setGroupIds] = useState(new Set());

  useEffect(() => {
    if (!viewingAs) {
      setVisibleRoleIds(new Set());
      setGroupIds(new Set());
      return;
    }
    supabase
      .from("role_visibility")
      .select("visible_role_id")
      .eq("role_id", profile.role_id)
      .then(({ data }) => setVisibleRoleIds(new Set((data || []).map((r) => r.visible_role_id))));

    // No target person for a bare-role pick -- group_members has nothing
    // meaningful to look up, so this role can only ever see jobs via
    // can_see_all_jobs or role_visibility, never "assigned to me"/group.
    if (viewingAsTargetId) {
      supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", viewingAsTargetId)
        .then(({ data }) => setGroupIds(new Set((data || []).map((r) => r.group_id))));
    } else {
      setGroupIds(new Set());
    }
  }, [viewingAs, profile.role_id, viewingAsTargetId]);

  const filterFn = useCallback(
    (job) =>
      permissions.has("can_see_all_jobs") ||
      (viewingAsTargetId != null && job.assignee?.id === viewingAsTargetId) ||
      Boolean(job.assignee_group?.id && groupIds.has(job.assignee_group.id)) ||
      Boolean(job.assignee?.role?.id && visibleRoleIds.has(job.assignee.role.id)),
    [permissions, viewingAsTargetId, groupIds, visibleRoleIds]
  );

  // null (not a no-op filter) is the signal callers key off to know
  // whether to apply this at all -- see JobsList.jsx.
  return viewingAs ? filterFn : null;
}
