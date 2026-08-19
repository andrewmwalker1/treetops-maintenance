// Which people/groups the signed-in profile's role is allowed to create
// or reassign a job to (role_assignable_roles, 44-role-assignable-job-
// targets.sql) -- nothing is implicit, not even a role assigning within
// itself, so an unconfigured role sees nobody until an admin sets up its
// row(s) on the Job Assignment tab. A group shows up if at least one of
// its members holds an assignable role -- matches can_assign_job's own
// rule in RLS, so what this offers and what the server will actually
// accept never disagree. Contractors aren't filtered -- they're outside
// this role hierarchy entirely, same as before this table existed.
import { supabase } from "./supabaseClient.js";

export async function getAssignableTargets(orgId, myRoleId) {
  if (!myRoleId) return { people: [], groups: [] };

  const [{ data: allowedRoles }, { data: profiles }, { data: groups }, { data: groupMembers }] = await Promise.all([
    supabase.from("role_assignable_roles").select("assignable_role_id").eq("role_id", myRoleId),
    supabase.from("profiles").select("id, display_name, role_id").eq("org_id", orgId),
    supabase.from("groups").select("id, name").eq("org_id", orgId),
    supabase.from("group_members").select("group_id, profile_id"),
  ]);

  const allowedRoleIds = new Set((allowedRoles || []).map((r) => r.assignable_role_id));
  const roleByProfileId = new Map((profiles || []).map((p) => [p.id, p.role_id]));

  const people = (profiles || [])
    .filter((p) => p.role_id && allowedRoleIds.has(p.role_id))
    .map(({ id, display_name }) => ({ id, display_name }));

  const groupsWithAllowedMember = new Set();
  for (const gm of groupMembers || []) {
    const roleId = roleByProfileId.get(gm.profile_id);
    if (roleId && allowedRoleIds.has(roleId)) groupsWithAllowedMember.add(gm.group_id);
  }
  const filteredGroups = (groups || []).filter((g) => groupsWithAllowedMember.has(g.id));

  return { people, groups: filteredGroups };
}
