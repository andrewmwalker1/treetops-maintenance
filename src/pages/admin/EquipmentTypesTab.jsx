import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import ChecklistBuilder from "../../components/ChecklistBuilder.jsx";
import DocumentPicker from "../../components/DocumentPicker.jsx";
import AssigneePicker, { assigneeKindAndIdFromRow, assigneeLabel } from "../../components/AssigneePicker.jsx";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, IconArrowDown, IconArrowUp, IconButton, Input, Modal, PageHeader, Select } from "../../ui/index.js";

const blank = {
  id: null,
  name: "",
  pre_use_checklist: [],
  allow_multi_checkout: false,
  tracks_hours_default: false,
  hours_required_default: false,
  documentIds: [],
  assigneeKind: "none",
  assigneeId: "",
};

export default function EquipmentTypesTab() {
  const { org } = useAuth();
  const [types, setTypes] = useState([]);
  const [counts, setCounts] = useState({});
  const [documents, setDocuments] = useState([]);
  const [linksByType, setLinksByType] = useState({});
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [assigneesByType, setAssigneesByType] = useState({}); // equipment_type_id -> row
  const [defaultAssigneeRow, setDefaultAssigneeRow] = useState(null); // the equipment_type_id-is-null row
  const [defaultAssigneeDraft, setDefaultAssigneeDraft] = useState({ assigneeKind: "none", assigneeId: "" });
  const [savingDefaultAssignee, setSavingDefaultAssignee] = useState(false);
  const [form, setForm] = useState(null); // null = modal closed
  const [error, setError] = useState(null);
  const [copyFromId, setCopyFromId] = useState("");

  function refresh() {
    Promise.all([
      supabase
        .from("equipment_types")
        .select("id, name, pre_use_checklist, allow_multi_checkout, tracks_hours_default, hours_required_default, sort_order")
        .eq("org_id", org.id)
        .order("sort_order"),
      supabase.from("equipment").select("equipment_type_id"),
      supabase.from("ra_ms_documents").select("id, type, title").eq("org_id", org.id).order("title"),
      supabase.from("equipment_type_documents").select("equipment_type_id, document_id"),
      supabase.from("profiles").select("id, display_name").eq("org_id", org.id).eq("is_active", true).order("display_name"),
      supabase.from("groups").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("contractors").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("equipment_type_repair_assignees").select("id, equipment_type_id, assignee_profile_id, assignee_group_id, assignee_contractor_id").eq("org_id", org.id),
    ]).then(([{ data: t, error: err }, { data: eq }, { data: docs }, { data: links }, { data: p }, { data: g }, { data: c }, { data: assignees }]) => {
      if (err) setError(err.message);
      else setTypes(t || []);
      const grouped = {};
      for (const row of eq || []) {
        if (row.equipment_type_id) grouped[row.equipment_type_id] = (grouped[row.equipment_type_id] || 0) + 1;
      }
      setCounts(grouped);
      setDocuments(docs || []);
      const linkGroups = {};
      for (const link of links || []) {
        linkGroups[link.equipment_type_id] = [...(linkGroups[link.equipment_type_id] || []), link.document_id];
      }
      setLinksByType(linkGroups);
      setPeople(p || []);
      setGroups(g || []);
      setContractors(c || []);
      const byType = {};
      let defaultRow = null;
      for (const row of assignees || []) {
        if (row.equipment_type_id) byType[row.equipment_type_id] = row;
        else defaultRow = row;
      }
      setAssigneesByType(byType);
      setDefaultAssigneeRow(defaultRow);
      setDefaultAssigneeDraft(assigneeKindAndIdFromRow(defaultRow));
    });
  }

  async function moveType(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= types.length) return;
    const a = types[index];
    const b = types[target];
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase.from("equipment_types").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("equipment_types").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (err1 || err2) setError((err1 || err2).message);
    else refresh();
  }

  useEffect(refresh, [org]);

  // Shared by the per-type assignee (equipment_type_id set) and the
  // org-wide default row (equipment_type_id null) -- "none" deletes
  // whatever row exists (falling through to the default, or to
  // unassigned), anything else upserts the one matching column.
  async function saveAssigneeRow({ equipmentTypeId, existingRowId, assigneeKind, assigneeId }) {
    if (assigneeKind === "none") {
      if (!existingRowId) return null;
      const { error: err } = await supabase.from("equipment_type_repair_assignees").delete().eq("id", existingRowId);
      return err?.message || null;
    }
    const payload = {
      org_id: org.id,
      equipment_type_id: equipmentTypeId,
      assignee_profile_id: assigneeKind === "person" ? assigneeId : null,
      assignee_group_id: assigneeKind === "group" ? assigneeId : null,
      assignee_contractor_id: assigneeKind === "contractor" ? assigneeId : null,
    };
    const { error: err } = existingRowId
      ? await supabase.from("equipment_type_repair_assignees").update(payload).eq("id", existingRowId)
      : await supabase.from("equipment_type_repair_assignees").insert(payload);
    return err?.message || null;
  }

  async function handleSaveDefaultAssignee() {
    setSavingDefaultAssignee(true);
    setError(null);
    const err = await saveAssigneeRow({
      equipmentTypeId: null,
      existingRowId: defaultAssigneeRow?.id,
      ...defaultAssigneeDraft,
    });
    setSavingDefaultAssignee(false);
    if (err) setError(err);
    else refresh();
  }

  function editType(t) {
    setError(null);
    setCopyFromId("");
    setForm({
      id: t.id,
      name: t.name,
      pre_use_checklist: t.pre_use_checklist || [],
      allow_multi_checkout: t.allow_multi_checkout || false,
      tracks_hours_default: t.tracks_hours_default || false,
      hours_required_default: t.hours_required_default || false,
      documentIds: linksByType[t.id] || [],
      ...assigneeKindAndIdFromRow(assigneesByType[t.id]),
    });
  }

  function toggleDocument(docId) {
    setForm((f) => ({
      ...f,
      documentIds: f.documentIds.includes(docId) ? f.documentIds.filter((id) => id !== docId) : [...f.documentIds, docId],
    }));
  }

  function copyChecklistFrom(sourceId) {
    const source = types.find((t) => t.id === sourceId);
    if (!source) return;
    const existing = new Set(form.pre_use_checklist);
    const toAdd = (source.pre_use_checklist || []).filter((item) => !existing.has(item));
    setForm({ ...form, pre_use_checklist: [...form.pre_use_checklist, ...toAdd] });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    const payload = {
      org_id: org.id,
      name: form.name,
      pre_use_checklist: form.pre_use_checklist,
      allow_multi_checkout: form.allow_multi_checkout,
      tracks_hours_default: form.tracks_hours_default,
      hours_required_default: form.hours_required_default,
    };
    if (!form.id) {
      payload.sort_order = types.length > 0 ? Math.max(...types.map((t) => t.sort_order)) + 1 : 0;
    }
    const { data: saved, error: err } = form.id
      ? await supabase.from("equipment_types").update(payload).eq("id", form.id).select().single()
      : await supabase.from("equipment_types").insert(payload).select().single();
    if (err) {
      setError(err.message);
      return;
    }

    const previousLinks = linksByType[saved.id] || [];
    const toAdd = form.documentIds.filter((id) => !previousLinks.includes(id));
    const toRemove = previousLinks.filter((id) => !form.documentIds.includes(id));
    if (toAdd.length > 0) {
      const { error: linkErr } = await supabase
        .from("equipment_type_documents")
        .insert(toAdd.map((document_id) => ({ equipment_type_id: saved.id, document_id })));
      if (linkErr) {
        setError(`Saved, but couldn't update its linked documents: ${linkErr.message}`);
        refresh();
        return;
      }
    }
    for (const document_id of toRemove) {
      const { error: unlinkErr } = await supabase
        .from("equipment_type_documents")
        .delete()
        .eq("equipment_type_id", saved.id)
        .eq("document_id", document_id);
      if (unlinkErr) {
        setError(`Saved, but couldn't update its linked documents: ${unlinkErr.message}`);
        refresh();
        return;
      }
    }

    const assigneeErr = await saveAssigneeRow({
      equipmentTypeId: saved.id,
      existingRowId: assigneesByType[saved.id]?.id,
      assigneeKind: form.assigneeKind,
      assigneeId: form.assigneeId,
    });
    if (assigneeErr) {
      setError(`Saved, but couldn't update its repair assignee: ${assigneeErr}`);
      refresh();
      return;
    }

    setForm(null);
    refresh();
  }

  async function handleDelete(id) {
    const { error: err } = await supabase.from("equipment_types").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
        <PageHeader title="Equipment types" level={2} />
        <Button variant="primary" onClick={() => { setError(null); setCopyFromId(""); setForm(blank); }}>+ Add equipment type</Button>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Groups individual equipment items (e.g. ST1, ST2, ST3) under what they actually are (e.g. "Strimmer").
      </p>

      <Card pad="sm" style={{ marginBottom: "var(--space-4)" }}>
        <div style={{ fontWeight: 600, marginBottom: "var(--space-1)" }}>Default repair assignee</div>
        <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: 0, marginBottom: "var(--space-3)" }}>
          Used when a fault's reported against a type with no assignee set below. Reporting a fault always creates a
          repair job, routed to whoever's configured to fix that type of machine.
        </p>
        <AssigneePicker
          kind={defaultAssigneeDraft.assigneeKind}
          id={defaultAssigneeDraft.assigneeId}
          onChange={(assigneeKind, assigneeId) => setDefaultAssigneeDraft({ assigneeKind, assigneeId })}
          people={people}
          groups={groups}
          contractors={contractors}
        />
        <Button onClick={handleSaveDefaultAssignee} disabled={savingDefaultAssignee}>
          {savingDefaultAssignee ? "Saving…" : "Save default"}
        </Button>
      </Card>

      {types.map((t, i) => (
        <Card pad="sm" key={t.id} style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{t.name}</div>
            <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
              {counts[t.id] || 0} item(s){t.allow_multi_checkout ? " · multi-checkout" : ""}
              {t.tracks_hours_default ? ` · tracks hours${t.hours_required_default ? " (required)" : ""}` : ""}
              {" · "}{(linksByType[t.id] || []).length} RA/MS document(s) linked
              {" · Repairs: "}{assigneeLabel(assigneesByType[t.id], { people, groups, contractors }) || "default"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <IconButton size="sm" label="Move up" onClick={() => moveType(i, -1)} disabled={i === 0}><IconArrowUp size={14} /></IconButton>
            <IconButton size="sm" label="Move down" onClick={() => moveType(i, 1)} disabled={i === types.length - 1}><IconArrowDown size={14} /></IconButton>
            <Button onClick={() => editType(t)}>Edit</Button>
            <Button variant="danger" onClick={() => handleDelete(t.id)}>Delete</Button>
          </div>
        </Card>
      ))}
      {types.length === 0 && <EmptyState title="No equipment types yet" />}

      {form && (
        <Modal title={form.id ? "Edit equipment type" : "New equipment type"} onClose={() => setForm(null)}>
            <form onSubmit={handleSave}>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Strimmer" style={{ marginBottom: "var(--space-3)" }} />

              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, margin: "var(--space-3) 0 var(--space-2)" }}>
                Pre-use checklist (shown as a reminder on the workshop kiosk)
              </label>

              {types.filter((t) => t.id !== form.id).length > 0 && (
                <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                  <Select value={copyFromId} onChange={(e) => setCopyFromId(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Copy checklist from…</option>
                    {types.filter((t) => t.id !== form.id).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                  <Button onClick={() => copyChecklistFrom(copyFromId)} disabled={!copyFromId}>
                    Copy
                  </Button>
                </div>
              )}

              <ChecklistBuilder
                items={form.pre_use_checklist}
                onChange={(items) => setForm({ ...form, pre_use_checklist: items })}
              />

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-base)", color: colors.ink, marginTop: "var(--space-4)" }}>
                <input
                  type="checkbox"
                  checked={form.allow_multi_checkout}
                  onChange={(e) => setForm({ ...form, allow_multi_checkout: e.target.checked })}
                />
                Allow checking out more than one at once
              </label>
              <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: "var(--space-1)", marginBottom: 0 }}>
                For kit like batteries that the team takes out and swaps in a group. On the kiosk, staff will tick as
                many units as they need before continuing, instead of picking one at a time.
              </p>

              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-base)", color: colors.ink, marginTop: "var(--space-4)" }}>
                <input
                  type="checkbox"
                  checked={form.tracks_hours_default}
                  onChange={(e) => setForm({ ...form, tracks_hours_default: e.target.checked, hours_required_default: e.target.checked ? form.hours_required_default : false })}
                />
                Prompt for an hours reading at checkout
              </label>
              <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginTop: "var(--space-1)", marginBottom: 0 }}>
                The default for every item of this type — override it on an individual machine if one's clock is
                broken, or a type is mixed.
              </p>
              {form.tracks_hours_default && (
                <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-base)", color: colors.ink, marginTop: "var(--space-2)" }}>
                  <input
                    type="checkbox"
                    checked={form.hours_required_default}
                    onChange={(e) => setForm({ ...form, hours_required_default: e.target.checked })}
                  />
                  Require it (can't check out without entering one)
                </label>
              )}

              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, margin: "var(--space-4) 0 var(--space-2)" }}>
                Linked RA/MS documents
              </label>
              <DocumentPicker documents={documents} selectedIds={form.documentIds} onToggle={toggleDocument} />

              <label style={{ display: "block", fontSize: "var(--text-sm)", fontWeight: 600, color: colors.inkSoft, margin: "var(--space-4) 0 var(--space-2)" }}>
                Repair assignee (who a reported fault's job gets routed to)
              </label>
              <AssigneePicker
                kind={form.assigneeKind}
                id={form.assigneeId}
                onChange={(assigneeKind, assigneeId) => setForm({ ...form, assigneeKind, assigneeId })}
                people={people}
                groups={groups}
                contractors={contractors}
              />

              {error && (
                <Alert tone="danger" title="Something went wrong">
                  {error}
                </Alert>
              )}

              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="primary" type="submit">{form.id ? "Save changes" : "Create equipment type"}</Button>
                <Button onClick={() => setForm(null)}>Cancel</Button>
              </div>
            </form>
                  </Modal>
      )}
    </div>
  );
}
