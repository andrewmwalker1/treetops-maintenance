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

const labelStyle = { display: "block", fontSize: "13px", fontWeight: 600, color: colors.inkSoft, marginBottom: "6px" };

export default function GroupsTab() {
  const { org } = useAuth();
  const [groups, setGroups] = useState([]);
  const [people, setPeople] = useState([]);
  const [members, setMembers] = useState({}); // group_id -> Set(profile_id)
  const [editingId, setEditingId] = useState(null); // null = not editing, "new" = creating
  const [nameDraft, setNameDraft] = useState("");
  const [memberDraft, setMemberDraft] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    Promise.all([
      supabase.from("groups").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("profiles").select("id, display_name").eq("org_id", org.id).order("display_name"),
      supabase.from("group_members").select("group_id, profile_id"),
    ]).then(([{ data: g, error: err }, { data: p }, { data: gm }]) => {
      if (err) setError(err.message);
      else setGroups(g || []);
      setPeople(p || []);
      const grouped = {};
      for (const row of gm || []) {
        if (!grouped[row.group_id]) grouped[row.group_id] = new Set();
        grouped[row.group_id].add(row.profile_id);
      }
      setMembers(grouped);
    });
  }

  useEffect(refresh, [org]);

  function startNew() {
    setError(null);
    setEditingId("new");
    setNameDraft("");
    setMemberDraft(new Set());
  }

  function startEdit(g) {
    setError(null);
    setEditingId(g.id);
    setNameDraft(g.name);
    setMemberDraft(new Set(members[g.id] || []));
  }

  function toggleMember(profileId) {
    setMemberDraft((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const name = nameDraft.trim();
    if (!name) return;
    setSaving(true);

    let groupId = editingId;
    if (editingId === "new") {
      const { data, error: err } = await supabase.from("groups").insert({ org_id: org.id, name }).select().single();
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
      groupId = data.id;
    } else {
      const { error: err } = await supabase.from("groups").update({ name }).eq("id", editingId);
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }

    // Diff against what was loaded, rather than replacing wholesale, so a
    // membership change only touches the rows that actually changed.
    const previousMembers = members[groupId] || new Set();
    const toAdd = [...memberDraft].filter((id) => !previousMembers.has(id));
    const toRemove = [...previousMembers].filter((id) => !memberDraft.has(id));

    if (toAdd.length > 0) {
      const { error: err } = await supabase.from("group_members").insert(toAdd.map((profile_id) => ({ group_id: groupId, profile_id })));
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }
    for (const profile_id of toRemove) {
      const { error: err } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("profile_id", profile_id);
      if (err) {
        setSaving(false);
        setError(err.message);
        return;
      }
    }

    setSaving(false);
    setEditingId(null);
    refresh();
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this group? Any jobs assigned to it will become unassigned.")) return;
    const { error: err } = await supabase.from("groups").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
      <div>
        <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>Groups</h2>
        {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}
        {groups.map((g) => (
          <div key={g.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: "12px", color: colors.inkSoft }}>{(members[g.id]?.size || 0)} member(s)</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => startEdit(g)} style={buttonStyle.secondary}>Edit</button>
              <button onClick={() => handleDelete(g.id)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Delete</button>
            </div>
          </div>
        ))}
        {groups.length === 0 && <p style={{ color: colors.inkSoft }}>No groups set up yet.</p>}
        {editingId === null && (
          <button onClick={startNew} style={{ ...buttonStyle.primary, marginTop: "8px" }}>+ Add group</button>
        )}
      </div>

      {editingId !== null && (
        <div>
          <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark }}>{editingId === "new" ? "New group" : "Edit group"}</h2>
          <form onSubmit={handleSave} style={{ ...cardStyle, padding: "16px" }}>
            <label style={labelStyle}>Group name</label>
            <input required autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={fieldStyle} />

            <label style={labelStyle}>Members</label>
            <div style={{ ...cardStyle, padding: "10px 14px", marginBottom: "14px", maxHeight: "260px", overflowY: "auto" }}>
              {people.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "13px", margin: 0 }}>No users yet.</p>}
              {people.map((p) => (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0", fontSize: "14px" }}>
                  <input type="checkbox" checked={memberDraft.has(p.id)} onChange={() => toggleMember(p.id)} />
                  {p.display_name}
                </label>
              ))}
            </div>

            {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" disabled={saving} style={buttonStyle.primary}>
                {saving ? "Saving…" : editingId === "new" ? "Create group" : "Save changes"}
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={buttonStyle.secondary}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
