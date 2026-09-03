import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors } from "../../lib/theme.js";
import { Alert, Card, EmptyState, PageHeader, Table } from "../../ui/index.js";

// role_assignable_roles (44-role-assignable-job-targets.sql) -- who a role
// can create or reassign a job to. Nothing is implicit: a role can't even
// assign within itself unless that's ticked too, matching Andy's "it
// should go through a management process" reasoning -- an unconfigured
// role sees nobody in the assignee picker until a row exists here. Same
// matrix shape as RolesPermissionsTab.jsx, just role-by-role instead of
// role-by-permission.
export default function JobAssignmentTab() {
  const { org } = useAuth();
  const [roles, setRoles] = useState([]);
  const [grants, setGrants] = useState(new Set()); // "roleId:assignableRoleId"
  const [error, setError] = useState(null);

  function refresh() {
    Promise.all([
      supabase.from("roles").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("role_assignable_roles").select("role_id, assignable_role_id"),
    ]).then(([{ data: r }, { data: raw }]) => {
      setRoles(r || []);
      setGrants(new Set((raw || []).map((g) => `${g.role_id}:${g.assignable_role_id}`)));
    });
  }

  useEffect(refresh, [org]);

  async function toggle(roleId, assignableRoleId) {
    setError(null);
    const key = `${roleId}:${assignableRoleId}`;
    if (grants.has(key)) {
      const { error: err } = await supabase
        .from("role_assignable_roles")
        .delete()
        .eq("role_id", roleId)
        .eq("assignable_role_id", assignableRoleId);
      if (err) {
        setError(err.message);
        return;
      }
    } else {
      const { error: err } = await supabase.from("role_assignable_roles").insert({ role_id: roleId, assignable_role_id: assignableRoleId });
      if (err) {
        setError(err.message);
        return;
      }
    }
    refresh();
  }

  return (
    <div>
      <PageHeader title="Job assignment" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0, maxWidth: "var(--width-xl)" }}>
        Which roles a role (down the left) can create or reassign a job to (across the top). Nothing is implicit — even
        assigning within a role's own team needs a tick here.
      </p>
      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      <Card pad="md" style={{ overflowX: "auto" }}>
        <Table>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)", color: colors.inkSoft }}>Role can assign to →</th>
              {roles.map((r) => (
                <th key={r.id} style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)", color: colors.inkSoft, fontWeight: 600 }}>
                  {r.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} style={{ borderTop: `1px solid ${colors.line}` }}>
                <td style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-sm)", fontWeight: 600 }}>{r.name}</td>
                {roles.map((target) => (
                  <td key={target.id} style={{ textAlign: "center", padding: "var(--space-2) var(--space-3)" }}>
                    <input
                      type="checkbox"
                      checked={grants.has(`${r.id}:${target.id}`)}
                      onChange={() => toggle(r.id, target.id)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      {roles.length === 0 && <EmptyState title="No roles set up yet" />}
    </div>
  );
}
