import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, fonts, cardStyle } from "../../lib/theme.js";

export default function RolesPermissionsTab() {
  const { org } = useAuth();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [grants, setGrants] = useState(new Set()); // "roleId:permissionKey"
  const [error, setError] = useState(null);

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

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>Roles &amp; permissions</h2>
      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}
      <div style={{ ...cardStyle, padding: "16px", overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 10px", fontSize: "12px", color: colors.inkSoft }}>Permission</th>
              {roles.map((r) => (
                <th key={r.id} style={{ padding: "6px 10px", fontSize: "12px", color: colors.inkSoft, fontWeight: 600 }}>{r.name}</th>
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
