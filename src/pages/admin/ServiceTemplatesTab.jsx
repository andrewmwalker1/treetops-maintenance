import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import ChecklistBuilder from "../../components/ChecklistBuilder.jsx";
import AssigneePicker, { assigneeKindAndIdFromRow } from "../../components/AssigneePicker.jsx";
import { colors, space } from "../../lib/theme.js";
import { Alert, Button, Card, Input, Modal, PageHeader, Select } from "../../ui/index.js";

function blankTier() {
  return {
    // A client-only id so React can key/edit an unsaved tier -- swapped
    // for the real row id once saved. Never sent to the database.
    _key: crypto.randomUUID(),
    id: null,
    name: "",
    trigger_type: "hours",
    hours_interval: "",
    date_interval_months: "",
    is_recurring: true,
    checklist: [],
    assigneeKind: "none",
    assigneeId: "",
  };
}

function tierFromRow(row) {
  return {
    _key: row.id,
    id: row.id,
    name: row.name,
    trigger_type: row.trigger_type,
    hours_interval: row.hours_interval ?? "",
    date_interval_months: row.date_interval_months ?? "",
    is_recurring: row.is_recurring,
    checklist: row.checklist || [],
    ...assigneeKindAndIdFromRow(row),
  };
}

const blank = { id: null, name: "", equipment_type_id: "", tiers: [] };

export default function ServiceTemplatesTab() {
  const { org } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [tiersByTemplate, setTiersByTemplate] = useState({});
  const [equipmentTypes, setEquipmentTypes] = useState([]);
  const [people, setPeople] = useState([]);
  const [groups, setGroups] = useState([]);
  const [contractors, setContractors] = useState([]);
  const [form, setForm] = useState(null); // null = modal closed
  const [originalTierIds, setOriginalTierIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function refresh() {
    Promise.all([
      supabase.from("service_templates").select("id, name, equipment_type_id").eq("org_id", org.id).order("name"),
      supabase.from("service_template_tiers").select("*").eq("org_id", org.id).order("sort_order"),
      supabase.from("equipment_types").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("profiles").select("id, display_name").eq("org_id", org.id).eq("is_active", true).order("display_name"),
      supabase.from("groups").select("id, name").eq("org_id", org.id).order("name"),
      supabase.from("contractors").select("id, name").eq("org_id", org.id).order("name"),
    ]).then(([{ data: t, error: err }, { data: tiers }, { data: types }, { data: p }, { data: g }, { data: c }]) => {
      if (err) setError(err.message);
      else setTemplates(t || []);
      const grouped = {};
      for (const row of tiers || []) {
        grouped[row.template_id] = [...(grouped[row.template_id] || []), row];
      }
      setTiersByTemplate(grouped);
      setEquipmentTypes(types || []);
      setPeople(p || []);
      setGroups(g || []);
      setContractors(c || []);
    });
  }

  useEffect(refresh, [org]);

  function newTemplate() {
    setError(null);
    setForm({ ...blank, tiers: [blankTier()] });
    setOriginalTierIds([]);
  }

  function editTemplate(t) {
    setError(null);
    const rows = tiersByTemplate[t.id] || [];
    setForm({
      id: t.id,
      name: t.name,
      equipment_type_id: t.equipment_type_id || "",
      tiers: rows.map(tierFromRow),
    });
    setOriginalTierIds(rows.map((r) => r.id));
  }

  function addTier() {
    setForm((f) => ({ ...f, tiers: [...f.tiers, blankTier()] }));
  }

  function removeTier(key) {
    setForm((f) => ({ ...f, tiers: f.tiers.filter((t) => t._key !== key) }));
  }

  function updateTier(key, patch) {
    setForm((f) => ({ ...f, tiers: f.tiers.map((t) => (t._key === key ? { ...t, ...patch } : t)) }));
  }

  async function handleDelete(id) {
    if (!window.confirm("Delete this service template? Any machine it's applied to keeps its history, but stops getting new service jobs generated from it.")) return;
    const { error: err } = await supabase.from("service_templates").delete().eq("id", id);
    if (err) setError(err.message);
    else refresh();
  }

  async function handleSave(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = { org_id: org.id, name: form.name, equipment_type_id: form.equipment_type_id || null };
    const { data: saved, error: templateErr } = form.id
      ? await supabase.from("service_templates").update(payload).eq("id", form.id).select().single()
      : await supabase.from("service_templates").insert(payload).select().single();
    if (templateErr) {
      setSaving(false);
      setError(templateErr.message);
      return;
    }

    // Reconcile tiers by id rather than delete-everything-and-reinsert --
    // a tier's id is what equipment_service_tier_state (per-machine
    // progress) hangs off, and that cascade-deletes if the tier row it
    // points at disappears. A machine already partway through this
    // template shouldn't lose its progress just because Andy tweaked a
    // checklist item on another tier.
    const currentIds = new Set(form.tiers.filter((t) => t.id).map((t) => t.id));
    const toDelete = originalTierIds.filter((id) => !currentIds.has(id));
    if (toDelete.length > 0) {
      const { error: delErr } = await supabase.from("service_template_tiers").delete().in("id", toDelete);
      if (delErr) {
        setSaving(false);
        setError(`Saved, but couldn't remove a tier: ${delErr.message}`);
        refresh();
        return;
      }
    }

    for (let i = 0; i < form.tiers.length; i++) {
      const t = form.tiers[i];
      const tierPayload = {
        org_id: org.id,
        template_id: saved.id,
        name: t.name,
        trigger_type: t.trigger_type,
        hours_interval: t.trigger_type === "hours" ? Number(t.hours_interval) : null,
        date_interval_months: t.trigger_type === "date" ? Number(t.date_interval_months) : null,
        is_recurring: t.is_recurring,
        sort_order: i,
        checklist: t.checklist,
        assignee_profile_id: t.assigneeKind === "person" ? t.assigneeId || null : null,
        assignee_group_id: t.assigneeKind === "group" ? t.assigneeId || null : null,
        assignee_contractor_id: t.assigneeKind === "contractor" ? t.assigneeId || null : null,
      };
      const { error: tierErr } = t.id
        ? await supabase.from("service_template_tiers").update(tierPayload).eq("id", t.id)
        : await supabase.from("service_template_tiers").insert(tierPayload);
      if (tierErr) {
        setSaving(false);
        setError(`Saved, but couldn't save "${t.name || "a tier"}": ${tierErr.message}`);
        refresh();
        return;
      }
    }

    setSaving(false);
    setForm(null);
    refresh();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
        <PageHeader title="Service templates" level={2} />
        <Button variant="primary" onClick={newTemplate}>+ Add service template</Button>
      </div>
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        A reusable service schedule (e.g. "Iseki SXG324") — apply it to a machine from its Equipment page. Buying a
        second one of the same machine just needs applying the same template again, not redefining it.
      </p>
      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      {templates.map((t) => (
        <Card pad="sm" key={t.id} style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 600 }}>{t.name}</div>
            <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
              {equipmentTypes.find((et) => et.id === t.equipment_type_id)?.name || "No equipment type set"} · {(tiersByTemplate[t.id] || []).length} tier(s)
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <Button onClick={() => editTemplate(t)}>Edit</Button>
            <Button variant="danger" onClick={() => handleDelete(t.id)}>Delete</Button>
          </div>
        </Card>
      ))}
      {templates.length === 0 && <p style={{ color: colors.inkSoft }}>No service templates yet.</p>}

      {form && (
        <Modal title={form.id ? "Edit service template" : "New service template"} onClose={() => setForm(null)} maxWidth="560px">
            <form onSubmit={handleSave}>
              <label className="tt-field__label">Name</label>
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Iseki SXG324" style={{ marginBottom: "var(--space-3)" }} />

              <label className="tt-field__label">Equipment type</label>
              <Select value={form.equipment_type_id} onChange={(e) => setForm({ ...form, equipment_type_id: e.target.value })} style={{ marginBottom: "var(--space-3)" }}>
                <option value="">No type set</option>
                {equipmentTypes.map((et) => (
                  <option key={et.id} value={et.id}>{et.name}</option>
                ))}
              </Select>

              <label className="tt-field__label">Tiers</label>
              {form.tiers.map((t) => (
                <div key={t._key} style={{ background: colors.bg, borderRadius: "var(--radius-sm)", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
                  <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
                    <Input required value={t.name} onChange={(e) => updateTier(t._key, { name: e.target.value })} placeholder="e.g. Every 50 Hours" style={{ flex: 1 }} />
                    <Button variant="danger" onClick={() => removeTier(t._key)}>Remove</Button>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-4)", marginBottom: "var(--space-2)", flexWrap: "wrap" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                      <input type="radio" checked={t.trigger_type === "hours"} onChange={() => updateTier(t._key, { trigger_type: "hours" })} /> Every
                      <input
                        type="number"
                        required={t.trigger_type === "hours"}
                        value={t.hours_interval}
                        onChange={(e) => updateTier(t._key, { hours_interval: e.target.value })}
                        style={{ width: "70px", padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-sm)", border: `1px solid ${colors.lineStrong}` }}
                      />
                      hours
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)" }}>
                      <input type="radio" checked={t.trigger_type === "date"} onChange={() => updateTier(t._key, { trigger_type: "date" })} /> Every
                      <input
                        type="number"
                        required={t.trigger_type === "date"}
                        value={t.date_interval_months}
                        onChange={(e) => updateTier(t._key, { date_interval_months: e.target.value })}
                        style={{ width: "70px", padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-sm)", border: `1px solid ${colors.lineStrong}` }}
                      />
                      months
                    </label>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--text-sm)", marginBottom: "var(--space-2)" }}>
                    <input type="checkbox" checked={t.is_recurring} onChange={(e) => updateTier(t._key, { is_recurring: e.target.checked })} />
                    Repeats (untick for a one-off, like an initial service)
                  </label>

                  <label className="tt-field__label">Checklist</label>
                  <ChecklistBuilder items={t.checklist} onChange={(items) => updateTier(t._key, { checklist: items })} />

                  <label className="tt-field__label">Who normally does this</label>
                  <AssigneePicker
                    kind={t.assigneeKind}
                    id={t.assigneeId}
                    onChange={(assigneeKind, assigneeId) => updateTier(t._key, { assigneeKind, assigneeId })}
                    people={people}
                    groups={groups}
                    contractors={contractors}
                    noneLabel="Unassigned (choose when the job's raised)"
                  />
                </div>
              ))}
              <Button onClick={addTier}>+ Add tier</Button>

              {error && (
                <Alert tone="danger" title="Something went wrong">
                  {error}
                </Alert>
              )}

              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <Button variant="primary" type="submit" disabled={saving}>{saving ? "Saving…" : form.id ? "Save changes" : "Create template"}</Button>
                <Button onClick={() => setForm(null)}>Cancel</Button>
              </div>
            </form>
                  </Modal>
      )}
    </div>
  );
}
