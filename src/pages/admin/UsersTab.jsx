import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  marginBottom: "10px",
};

const blankInvite = { email: "", displayName: "", roleId: "", isContractor: false, siteIds: [] };

export default function UsersTab() {
  const { org } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [sites, setSites] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [invite, setInvite] = useState(blankInvite);
  const [inviteStatus, setInviteStatus] = useState("idle"); // idle | sending | sent | sent-email-failed | error
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [error, setError] = useState(null);
  const [resendStatus, setResendStatus] = useState({}); // userId -> "sending" | "sent" | "error"

  function refresh() {
    Promise.all([
      supabase.rpc("list_org_users"),
      supabase.from("roles").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("sites").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("contractors").select("id, name").eq("org_id", org.id).order("name"),
    ]).then(([{ data: u, error: err }, { data: r }, { data: s }, { data: c }]) => {
      if (err) setError(err.message);
      else setUsers(u || []);
      setRoles(r || []);
      setSites(s || []);
      setContractors(c || []);
    });
  }

  useEffect(refresh, [org]);

  async function handleInvite(e) {
    e.preventDefault();
    setError(null);
    setInviteStatus("sending");
    const { data, error: err } = await supabase.functions.invoke("manage-users", {
      body: {
        action: "invite",
        // A trailing/leading space here becomes a permanent mismatch --
        // the person can never sign in with the address they actually
        // type, and it just looks like Supabase rejecting their account
        // outright (see Login.jsx's identical trim, added after exactly
        // this happened to Zara).
        email: invite.email.trim(),
        displayName: invite.displayName,
        roleId: invite.roleId,
        isContractor: invite.isContractor,
        siteIds: invite.siteIds,
        redirectTo: window.location.origin,
      },
    });
    if (err) {
      setInviteStatus("error");
      setError(err.message);
      return;
    }
    // The account can be created even when the invite email itself fails to
    // send -- that's now a distinct, recoverable state (use Resend below)
    // rather than the whole invite silently vanishing.
    setInviteStatus(data?.emailSent === false ? "sent-email-failed" : "sent");
    setInvite(blankInvite);
    refresh();
  }

  async function handleResend(userId) {
    setResendStatus((s) => ({ ...s, [userId]: "sending" }));
    const { error: err } = await supabase.functions.invoke("manage-users", {
      body: { action: "resend", userId, redirectTo: window.location.origin },
    });
    setResendStatus((s) => ({ ...s, [userId]: err ? "error" : "sent" }));
    if (err) setError(err.message);
  }

  function startEdit(u) {
    setEditingId(u.id);
    setEditForm({
      display_name: u.display_name,
      email: u.email || "",
      role_id: u.role_id || "",
      is_contractor: u.is_contractor,
      contractor_id: u.contractor_id || "",
      siteIds: u.site_ids || [],
    });
  }

  function toggleEditSite(id) {
    setEditForm((f) => ({
      ...f,
      siteIds: f.siteIds.includes(id) ? f.siteIds.filter((s) => s !== id) : [...f.siteIds, id],
    }));
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setError(null);

    const user = users.find((u) => u.id === editingId);

    // Email lives on auth.users, not profiles (see list_org_users in
    // 10-user-admin.sql) -- changing it needs the Auth Admin API, so it
    // goes through manage-users rather than a plain table update like
    // the rest of this form. Trimmed for the same reason as the invite
    // form and Login.jsx -- a stray space here would just recreate the
    // exact mismatch this edit exists to fix.
    const trimmedEmail = editForm.email.trim();
    if (trimmedEmail && trimmedEmail !== user?.email) {
      const { error: emailErr } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_email", userId: editingId, email: trimmedEmail },
      });
      if (emailErr) {
        setError(emailErr.message);
        return;
      }
    }

    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        display_name: editForm.display_name,
        role_id: editForm.role_id,
        is_contractor: editForm.is_contractor,
        // Cleared whenever "Contractor" is unticked -- profiles_contractor_id_
        // requires_flag (43-contractor-linked-profiles.sql) would reject the
        // update otherwise, and a stale link would misattribute their key
        // checkouts to a company they're no longer flagged as belonging to.
        contractor_id: editForm.is_contractor ? editForm.contractor_id || null : null,
      })
      .eq("id", editingId);
    if (profileErr) {
      setError(profileErr.message);
      return;
    }

    const previousSites = user?.site_ids || [];
    const toAdd = editForm.siteIds.filter((id) => !previousSites.includes(id));
    const toRemove = previousSites.filter((id) => !editForm.siteIds.includes(id));

    if (toAdd.length > 0) {
      await supabase.from("site_scope").insert(toAdd.map((site_id) => ({ profile_id: editingId, site_id })));
    }
    for (const site_id of toRemove) {
      await supabase.from("site_scope").delete().eq("profile_id", editingId).eq("site_id", site_id);
    }

    setEditingId(null);
    setEditForm(null);
    refresh();
  }

  async function handleDeactivate(userId) {
    setError(null);
    const { error: err } = await supabase.functions.invoke("manage-users", { body: { action: "deactivate", userId } });
    if (err) setError(err.message);
    else refresh();
  }

  async function handleReactivate(userId) {
    setError(null);
    const { error: err } = await supabase.functions.invoke("manage-users", { body: { action: "reactivate", userId } });
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>Users</h2>
        {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}
        {users.map((u) => (
          <div key={u.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px" }}>
            {editingId === u.id ? (
              <form onSubmit={handleSaveEdit}>
                <input required value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} style={fieldStyle} />
                <input required type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" style={fieldStyle} />
                <select required value={editForm.role_id} onChange={(e) => setEditForm({ ...editForm, role_id: e.target.value })} style={fieldStyle}>
                  <option value="">Select a role</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", marginBottom: "10px" }}>
                  <input
                    type="checkbox"
                    checked={editForm.is_contractor}
                    onChange={(e) => setEditForm({ ...editForm, is_contractor: e.target.checked, contractor_id: e.target.checked ? editForm.contractor_id : "" })}
                  />
                  Contractor
                </label>
                {editForm.is_contractor && (
                  <select
                    value={editForm.contractor_id}
                    onChange={(e) => setEditForm({ ...editForm, contractor_id: e.target.value })}
                    style={fieldStyle}
                  >
                    <option value="">No company linked yet</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" }}>Site access</label>
                {sites.map((s) => (
                  <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", padding: "3px 0" }}>
                    <input type="checkbox" checked={editForm.siteIds.includes(s.id)} onChange={() => toggleEditSite(s.id)} />
                    {s.name}
                  </label>
                ))}
                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button type="submit" style={buttonStyle.primary}>Save</button>
                  <button type="button" onClick={() => { setEditingId(null); setEditForm(null); }} style={buttonStyle.secondary}>Cancel</button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600 }}>
                    {u.display_name}
                    {u.is_active === false && (
                      <span style={{ marginLeft: "8px", fontSize: "11px", color: colors.immediate, fontWeight: 600 }}>DEACTIVATED</span>
                    )}
                  </div>
                  <div style={{ fontSize: "12px", color: colors.inkSoft }}>
                    {u.email} · {u.role_name || "No role"}
                    {u.is_contractor ? ` · Contractor${u.contractor_id ? ` (${contractors.find((c) => c.id === u.contractor_id)?.name || "?"})` : " (no company linked)"}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "6px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => startEdit(u)} style={buttonStyle.secondary}>Edit</button>
                    {u.is_active === false ? (
                      <button onClick={() => handleReactivate(u.id)} style={buttonStyle.secondary}>Reactivate</button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleResend(u.id)}
                          disabled={resendStatus[u.id] === "sending"}
                          style={buttonStyle.secondary}
                        >
                          {resendStatus[u.id] === "sending" ? "Sending…" : "Resend invite"}
                        </button>
                        <button onClick={() => handleDeactivate(u.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Deactivate</button>
                      </>
                    )}
                  </div>
                  {resendStatus[u.id] === "sent" && <span style={{ fontSize: "12px", color: colors.moss }}>Invite email sent</span>}
                  {resendStatus[u.id] === "error" && <span style={{ fontSize: "12px", color: colors.immediate }}>Failed to send — see message above</span>}
                </div>
              </div>
            )}
          </div>
        ))}
        {users.length === 0 && <p style={{ color: colors.inkSoft }}>No users yet.</p>}
      </div>

      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>Invite a user</h2>
        <p style={{ fontSize: "13px", color: colors.inkSoft }}>Only people invited here can sign in — there's no public sign-up.</p>
        <form onSubmit={handleInvite} style={{ ...cardStyle, padding: "16px" }}>
          <input required type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="Work email" style={fieldStyle} />
          <input required value={invite.displayName} onChange={(e) => setInvite({ ...invite, displayName: e.target.value })} placeholder="Display name" style={fieldStyle} />
          <select required value={invite.roleId} onChange={(e) => setInvite({ ...invite, roleId: e.target.value })} style={fieldStyle}>
            <option value="">Select a role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", marginBottom: "10px" }}>
            <input type="checkbox" checked={invite.isContractor} onChange={(e) => setInvite({ ...invite, isContractor: e.target.checked })} />
            Contractor
          </label>

          <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" }}>Site access</label>
          {sites.map((s) => (
            <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", padding: "3px 0" }}>
              <input
                type="checkbox"
                checked={invite.siteIds.includes(s.id)}
                onChange={() =>
                  setInvite((f) => ({
                    ...f,
                    siteIds: f.siteIds.includes(s.id) ? f.siteIds.filter((id) => id !== s.id) : [...f.siteIds, s.id],
                  }))
                }
              />
              {s.name}
            </label>
          ))}

          {inviteStatus === "sent" && <p style={{ color: colors.moss, fontSize: "13px" }}>Invite sent.</p>}
          {inviteStatus === "sent-email-failed" && (
            <p style={{ color: colors.immediate, fontSize: "13px" }}>
              Account created, but the invite email failed to send — find them in the list on the left and use "Resend invite".
            </p>
          )}
          {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

          <button type="submit" disabled={inviteStatus === "sending"} style={{ ...buttonStyle.primary, width: "100%", marginTop: "10px" }}>
            {inviteStatus === "sending" ? "Sending…" : "Send invite"}
          </button>
        </form>
      </div>
    </div>
  );
}
