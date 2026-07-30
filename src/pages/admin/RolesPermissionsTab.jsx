import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

export default function RolesPermissionsTab() {
  const { org } = useAuth();
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
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>Roles &amp; permissions</h2>
      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

      <form onSubmit={addRole} style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <input
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          placeholder="New role name…"
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: `1px solid ${colors.lineStrong}`,
            fontFamily: fonts.body,
            fontSize: "14px",
          }}
        />
        <button type="submit" style={buttonStyle.secondary}>Add role</button>
      </form>

      <div style={{ ...cardStyle, padding: "16px", overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px", fontSize: "12px", color: colors.inkSoft }}>Permission</th>
              {roles.map((r) => (
                <th key={r.id} style={{ padding: "6px 10px", fontSize: "12px", color: colors.inkSoft, fontWeight: 600 }}>
                  {renamingId === r.id ? (
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => saveRename(r.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveRename(r.id);
                        if (e.key === "Escape") setRenamingId(null);
                      }}
                      style={{
                        width: "100px",
                        padding: "4px 6px",
                        borderRadius: "6px",
                        border: `1px solid ${colors.lineStrong}`,
                        fontFamily: fonts.body,
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    />
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                      <span
                        onClick={() => startRename(r)}
                        title="Click to rename"
                        style={{ cursor: "pointer" }}
                      >
                        {r.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteRole(r)}
                        aria-label={`Delete ${r.name}`}
                        title="Delete role"
                        style={{
                          background: "none",
                          border: "none",
                          color: colors.inkSoft,
                          cursor: "pointer",
                          fontSize: "13px",
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {permissions.map((p) => (
              <tr key={p.key} style={{ borderTop: `1px solid ${colors.line}` }}>
                <td style={{ padding: "8px 10px", fontSize: "13px" }}>
                  <div style={{ fontWeight: 600 }}>{p.key}</div>
                  <div style={{ color: colors.inkSoft, fontSize: "12px" }}>{p.description}</div>
                </td>
                {roles.map((r) => (
                  <td key={r.id} style={{ textAlign: "center", padding: "8px 10px" }}>
                    <input type="checkbox" checked={grants.has(`${r.id}:${p.key}`)} onChange={() => toggle(r.id, p.key)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
