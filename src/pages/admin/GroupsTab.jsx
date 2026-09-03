import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Input, PageHeader } from "../../ui/index.js";

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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-5)" }}>
      <div>
        <PageHeader title="Groups" level={2} />
        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}
        {groups.map((g) => (
          <Card pad="sm" key={g.id} style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{g.name}</div>
              <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>{(members[g.id]?.size || 0)} member(s)</div>
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={() => startEdit(g)}>Edit</Button>
              <Button variant="danger" onClick={() => handleDelete(g.id)}>Delete</Button>
            </div>
          </Card>
        ))}
        {groups.length === 0 && <EmptyState title="No groups set up yet" />}
        {editingId === null && (
          <Button variant="primary" onClick={startNew}>+ Add group</Button>
        )}
      </div>

      {editingId !== null && (
        <div>
          <PageHeader title={editingId === "new" ? "New group" : "Edit group"} level={2} />
          <Card as="form" pad="md" onSubmit={handleSave}>
            <label className="tt-field__label">Group name</label>
            <Input required autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} style={{ marginBottom: "var(--space-3)" }} />

            <label className="tt-field__label">Members</label>
            <Card pad="sm" style={{ marginBottom: "var(--space-4)", maxHeight: "var(--scrollbox-max-h)", overflowY: "auto" }}>
              {people.length === 0 && <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)", margin: 0 }}>No users yet.</p>}
              {people.map((p) => (
                <label key={p.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-1) 0", fontSize: "var(--text-base)" }}>
                  <input type="checkbox" checked={memberDraft.has(p.id)} onChange={() => toggleMember(p.id)} />
                  {p.display_name}
                </label>
              ))}
            </Card>

            {error && (
              <Alert tone="danger" title="Something went wrong">
                {error}
              </Alert>
            )}

            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button variant="primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId === "new" ? "Create group" : "Save changes"}
              </Button>
              <Button onClick={() => setEditingId(null)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
