import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { useMediaQuery } from "../../lib/useIsMobile.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, PageHeader, SectionLabel, Switch, Table } from "../../ui/index.js";

// A roles-against-roles grid stops being readable long before a phone --
// somewhere around here on a half-width desktop window too, which is why
// this is a width query and not the phone check.
const MATRIX_BREAKPOINT = "(max-width: 900px)";

// Which roles' jobs a role can see (role_visibility, 01-schema.sql) --
// separate from Job Assignment (role_assignable_roles), which governs
// who a role can HAND a job to. Same "own role only" default every role
// but Head Gardener has had since day one (BUILD-BRIEF.md §11, flagged
// pending Andy's confirmation ever since) -- previously only editable by
// hand in the SQL editor since role_visibility had no write policy until
// 50-role-visibility-write-policies.sql. A row's own assignee still
// always sees their own jobs regardless of this table (that's
// assignee_profile_id = auth.uid(), unconditional) -- this only governs
// seeing OTHER people's jobs, including colleagues in the same role, which
// is why the diagonal (a role ticking its own column) is meaningful, not
// a no-op.
export default function RoleVisibilityTab() {
  const { org } = useAuth();
  const narrow = useMediaQuery(MATRIX_BREAKPOINT);
  const [roles, setRoles] = useState([]);
  const [grants, setGrants] = useState(new Set()); // "roleId:visibleRoleId"
  const [error, setError] = useState(null);

  function refresh() {
    if (!org) return;
    Promise.all([
      supabase.from("roles").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("role_visibility").select("role_id, visible_role_id"),
    ]).then(([{ data: r }, { data: rv }]) => {
      setRoles(r || []);
      setGrants(new Set((rv || []).map((v) => `${v.role_id}:${v.visible_role_id}`)));
    });
  }

  useEffect(refresh, [org]);

  async function toggle(roleId, visibleRoleId) {
    setError(null);
    const key = `${roleId}:${visibleRoleId}`;
    const isGranted = grants.has(key);

    if (isGranted) {
      const { error: err } = await supabase.from("role_visibility").delete().eq("role_id", roleId).eq("visible_role_id", visibleRoleId);
      if (err) {
        setError(err.message);
        return;
      }
    } else {
      const { error: err } = await supabase.from("role_visibility").insert({ role_id: roleId, visible_role_id: visibleRoleId });
      if (err) {
        setError(err.message);
        return;
      }
    }
    refresh();
  }

  return (
    <div>
      <PageHeader title="Role visibility" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, maxWidth: "640px" }}>
        Which roles' jobs each role can see, on top of their own assigned jobs (always visible regardless of this). Tick the row role
        under every column role whose jobs it should see -- e.g. tick Head Gardener's row under Maintenance so Head Gardener sees
        Maintenance's jobs too. Add or rename roles from Roles &amp; Permissions.
      </p>
      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      {roles.length === 0 && (
        <EmptyState
          title="No roles yet"
          action={
            <Button as={Link} to="/admin/roles" variant="primary">
              Go to Roles &amp; permissions
            </Button>
          }
        >
          Add one from Roles &amp; permissions.
        </EmptyState>
      )}

      {/* Below the breakpoint the grid becomes one card per role: the same
          toggles, read down instead of across, so each role's visibility is
          legible on its own rather than as a row of unlabelled ticks
          scrolling off the side. */}
      {narrow
        ? roles.map((row) => (
            <Card key={row.id} pad="md" style={{ marginBottom: "var(--space-3)" }}>
              <PageHeader title={row.name} level={2} />
              <SectionLabel>Also sees the jobs of</SectionLabel>
              {roles.map((col) => (
                <label
                  key={col.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    padding: "var(--space-2) 0",
                    borderTop: `1px solid ${colors.line}`,
                    cursor: "pointer",
                  }}
                >
                  <span>{col.name}</span>
                  <Switch
                    checked={grants.has(`${row.id}:${col.id}`)}
                    onChange={() => toggle(row.id, col.id)}
                    label={`${row.name} sees ${col.name}'s jobs`}
                  />
                </label>
              ))}
            </Card>
          ))
        : roles.length > 0 && (
            <Table stickyFirstColumn>
              <thead>
                <tr>
                  <th>This role…</th>
                  <th colSpan={roles.length} style={{ textAlign: "center" }}>
                    …sees this role's jobs
                  </th>
                </tr>
                <tr>
                  <th />
                  {roles.map((c) => (
                    <th key={c.id} style={{ textAlign: "center" }}>
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{row.name}</td>
                    {roles.map((col) => (
                      <td key={col.id} style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={grants.has(`${row.id}:${col.id}`)}
                          onChange={() => toggle(row.id, col.id)}
                          aria-label={`${row.name} sees ${col.name}'s jobs`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
    </div>
  );
}
