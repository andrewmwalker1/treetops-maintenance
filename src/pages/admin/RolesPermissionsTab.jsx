import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { useMediaQuery } from "../../lib/useIsMobile.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, IconButton, IconClose, Input, PageHeader, SectionLabel, Switch, Table } from "../../ui/index.js";

// A permissions-against-roles grid stops being readable long before a
// phone -- somewhere around here on a half-width desktop window too, which
// is why this is a width query and not the phone check.
const MATRIX_BREAKPOINT = "(max-width: 900px)";

export default function RolesPermissionsTab() {
  const { org } = useAuth();
  const narrow = useMediaQuery(MATRIX_BREAKPOINT);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [grants, setGrants] = useState(new Set()); // "roleId:permissionKey"
  const [error, setError] = useState(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  function refresh() {
    Promise.all([
      supabase.from("roles").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("permissions").select("key, description").order("key"),
      supabase.from("role_permissions").select("role_id, permission_key, enabled"),
    ]).then(([{ data: r }, { data: p }, { data: rp }]) => {
      setRoles(r || []);
      setPermissions(p || []);
      setGrants(new Set((rp || []).filter((g) => g.enabled).map((g) => `${g.role_id}:${g.permission_key}`)));
    });
  }

  useEffect(refresh, [org]);

  async function toggle(roleId, permissionKey) {
    setError(null);
    const key = `${roleId}:${permissionKey}`;
    const isGranted = grants.has(key);

    if (isGranted) {
      const { error: err } = await supabase.from("role_permissions").delete().eq("role_id", roleId).eq("permission_key", permissionKey);
      if (err) {
        setError(err.message);
        return;
      }
    } else {
      const { error: err } = await supabase.from("role_permissions").upsert({ role_id: roleId, permission_key: permissionKey, enabled: true });
      if (err) {
        setError(err.message);
        return;
      }
    }
    refresh();
  }

  async function addRole(e) {
    e.preventDefault();
    setError(null);
    const name = newRoleName.trim();
    if (!name) return;
    const { error: err } = await supabase.from("roles").insert({ org_id: org.id, name });
    if (err) {
      setError(err.message);
      return;
    }
    setNewRoleName("");
    refresh();
  }

  function startRename(role) {
    setRenamingId(role.id);
    setRenameValue(role.name);
  }

  async function saveRename(roleId) {
    setError(null);
    const name = renameValue.trim();
    setRenamingId(null);
    if (!name) return;
    const { error: err } = await supabase.from("roles").update({ name }).eq("id", roleId);
    if (err) {
      setError(err.message);
      return;
    }
    refresh();
  }

  async function deleteRole(role) {
    setError(null);
    if (!window.confirm(`Delete the "${role.name}" role? This can't be undone.`)) return;
    const { error: err } = await supabase.from("roles").delete().eq("id", role.id);
    if (err) {
      // The forbid_role_delete_if_in_use trigger raises a plain exception
      // (not a typed Postgres error code) when the role is still assigned,
      // so its message is already user-readable as-is.
      setError(err.message);
      return;
    }
    refresh();
  }

  return (
    <div>
      <PageHeader title="Roles & permissions" level={2} />
      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      <form onSubmit={addRole} style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <Input
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          placeholder="New role name…"
          aria-label="New role name"
          style={{ maxWidth: "260px" }}
        />
        <Button type="submit">Add role</Button>
      </form>

      {/* Below the breakpoint the grid becomes one card per role: the same
          toggles, read down the permission list instead of across a row of
          unlabelled ticks scrolling off the side. Above it, the first
          column pins so the permission name stays visible while the role
          columns scroll. */}
      {narrow
        ? roles.map((r) => (
            <Card key={r.id} pad="md" style={{ marginBottom: "var(--space-3)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
                {renamingId === r.id ? (
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => saveRename(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(r.id);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                    aria-label={`Rename ${r.name}`}
                  />
                ) : (
                  <Button variant="ghost" onClick={() => startRename(r)} style={{ padding: 0, fontSize: "var(--text-lg)" }}>
                    {r.name}
                  </Button>
                )}
                <IconButton label={`Delete ${r.name}`} onClick={() => deleteRole(r)}>
                  <IconClose size={16} />
                </IconButton>
              </div>
              <SectionLabel>Permissions</SectionLabel>
              {permissions.map((p) => (
                <label
                  key={p.key}
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
                  <span>
                    <span style={{ fontWeight: 600 }}>{p.key}</span>
                    <span style={{ display: "block", color: colors.inkSoft, fontSize: "var(--text-xs)" }}>{p.description}</span>
                  </span>
                  <Switch
                    checked={grants.has(`${r.id}:${p.key}`)}
                    onChange={() => toggle(r.id, p.key)}
                    label={`${r.name}: ${p.key}`}
                  />
                </label>
              ))}
            </Card>
          ))
        : roles.length > 0 && (
            <Table stickyFirstColumn>
              <thead>
                <tr>
                  <th>Permission</th>
                  {roles.map((r) => (
                    <th key={r.id} style={{ textAlign: "center" }}>
                      {renamingId === r.id ? (
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => saveRename(r.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveRename(r.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          aria-label={`Rename ${r.name}`}
                          style={{ width: "110px" }}
                        />
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "var(--space-1)" }}>
                          <button
                            type="button"
                            className="tt-sortbtn"
                            onClick={() => startRename(r)}
                            title="Click to rename"
                          >
                            {r.name}
                          </button>
                          <IconButton size="sm" label={`Delete ${r.name}`} onClick={() => deleteRole(r)}>
                            <IconClose size={14} />
                          </IconButton>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((p) => (
                  <tr key={p.key}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.key}</div>
                      <div style={{ color: colors.inkSoft, fontSize: "var(--text-xs)" }}>{p.description}</div>
                    </td>
                    {roles.map((r) => (
                      <td key={r.id} style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          checked={grants.has(`${r.id}:${p.key}`)}
                          onChange={() => toggle(r.id, p.key)}
                          aria-label={`${r.name}: ${p.key}`}
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
