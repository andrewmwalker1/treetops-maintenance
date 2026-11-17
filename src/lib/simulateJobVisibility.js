// Client-side reimplementation of can_see_job() -- latest definition is
// supabase/79-linked-jobs.sql, keep the branches below in step with it --
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

    if (viewingAsTargetId) {
      supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", viewingAsTargetId)
        .then(({ data }) => setGroupIds(new Set((data || []).map((r) => r.group_id))));
    } else {
      // Bare role pick, no real person to check group membership for.
      // Day-to-day jobs get assigned to a team group (e.g. "Maintenance")
      // far more often than to one named individual, so approximate with
      // every group ANY current holder of this role actually belongs to
      // -- without this, a bare-role pick could only ever match via
      // can_see_all_jobs/role_visibility and would show almost nothing,
      // which is what was happening before this was added.
      supabase
        .from("profiles")
        .select("id")
        .eq("role_id", profile.role_id)
        .then(({ data: roleProfiles }) => {
          const ids = (roleProfiles || []).map((p) => p.id);
          if (ids.length === 0) {
            setGroupIds(new Set());
            return;
          }
          supabase
            .from("group_members")
            .select("group_id")
            .in("profile_id", ids)
            .then(({ data }) => setGroupIds(new Set((data || []).map((r) => r.group_id))));
        });
    }
  }, [viewingAs, profile.role_id, viewingAsTargetId]);

  // job_is_assigned_to_me() (79-linked-jobs.sql): directly, via a group,
  // or via the target's contractor company. Takes plain id columns so it
  // works on the main row and on the parent/linked-job embeds alike.
  const assignedToTarget = useCallback(
    ({ profileId, groupId, contractorId }) =>
      (viewingAsTargetId != null && profileId === viewingAsTargetId) ||
      Boolean(groupId && groupIds.has(groupId)) ||
      Boolean(contractorId && profile.contractor_id && contractorId === profile.contractor_id),
    [viewingAsTargetId, groupIds, profile.contractor_id]
  );

  const filterFn = useCallback(
    (job) => {
      const contractorId = job.assignee_contractor?.id ?? null;
      const embedded = (j) => ({
        profileId: j.assignee_profile_id,
        groupId: j.assignee_group_id,
        contractorId: j.assignee_contractor_id,
      });
      return (
        permissions.has("can_see_all_jobs") ||
        // created_by = auth.uid() -- only meaningful for a real target
        // person, since "jobs this bare role created" isn't a thing any
        // real session experiences.
        (viewingAsTargetId != null && job.created_by === viewingAsTargetId) ||
        assignedToTarget({ profileId: job.assignee?.id, groupId: job.assignee_group?.id, contractorId }) ||
        Boolean(job.assignee?.role?.id && visibleRoleIds.has(job.assignee.role.id)) ||
        (contractorId != null && permissions.has("can_see_contractor_jobs")) ||
        // Linked jobs, one level each way: the parent is assigned to the
        // target, or one of this job's linked jobs is.
        Boolean(job.parent_job && assignedToTarget(embedded(job.parent_job))) ||
        (job.linked_jobs || []).some((c) => assignedToTarget(embedded(c)))
      );
    },
    [permissions, viewingAsTargetId, visibleRoleIds, assignedToTarget]
  );

  // null (not a no-op filter) is the signal callers key off to know
  // whether to apply this at all -- see JobsList.jsx.
  return viewingAs ? filterFn : null;
}
