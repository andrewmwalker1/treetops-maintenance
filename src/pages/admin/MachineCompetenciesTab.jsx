import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { getCurrentCompetencies, saveCompetencies } from "../../lib/machineCompetencies.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, EmptyState, Modal, PageHeader, SkeletonList } from "../../ui/index.js";

// Which machine types each team member is competent to operate
// (83-machine-competencies.sql). Its own tab, gated by
// can_manage_machine_competencies alone, rather than a button on Users --
// that tab needs can_manage_users, which someone trusted to sign people off
// on machines (a Head Gardener, say) won't necessarily have.
export default function MachineCompetenciesTab() {
  const { org, profile } = useAuth();
  const [people, setPeople] = useState([]);
  const [roleNames, setRoleNames] = useState({});
  const [types, setTypes] = useState([]);
  const [competencies, setCompetencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [editing, setEditing] = useState(null); // { person, ticked: Set<typeId> } while the modal is open
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  function refresh() {
    Promise.all([
      // Staff only: contractors don't check out the park's machinery.
      supabase.from("profiles").select("id, display_name, role_id").eq("org_id", org.id).eq("is_active", true).is("contractor_id", null).order("display_name"),
      supabase.from("roles").select("id, name").eq("org_id", org.id),
      supabase.from("equipment_types").select("*").eq("org_id", org.id).order("sort_order"),
      getCurrentCompetencies(org.id),
    ]).then(([{ data: p, error: pErr }, { data: r }, { data: t, error: tErr }, c]) => {
      setPeople(p || []);
      setRoleNames(Object.fromEntries((r || []).map((role) => [role.id, role.name])));
      // A no-checkout type (robomowers...) is never checked out, so there's
      // no competency to record for it.
      setTypes((t || []).filter((type) => !type.no_checkout));
      setCompetencies(c || []);
      setLoadError(pErr?.message || tErr?.message || (c === null ? "Couldn't load competencies — has 83-machine-competencies.sql been run?" : null));
      setLoading(false);
    });
  }

  useEffect(refresh, [org]);

  function competenciesFor(personId) {
    return competencies.filter((c) => c.profile_id === personId);
  }

  function openPerson(person) {
    setSaveError(null);
    setEditing({ person, ticked: new Set(competenciesFor(person.id).map((c) => c.equipment_type_id)) });
  }

  function toggle(typeId) {
    setEditing((e) => {
      const ticked = new Set(e.ticked);
      if (ticked.has(typeId)) ticked.delete(typeId);
      else ticked.add(typeId);
      return { ...e, ticked };
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const err = await saveCompetencies({
      orgId: org.id,
      profileId: editing.person.id,
      actorId: profile.id,
      currentRows: competenciesFor(editing.person.id),
      wantedTypeIds: editing.ticked,
    });
    setSaving(false);
    if (err) {
      setSaveError(err.message);
      return;
    }
    setEditing(null);
    refresh();
  }

  const typeIds = new Set(types.map((t) => t.id));
  const countFor = (personId) => competenciesFor(personId).filter((c) => typeIds.has(c.equipment_type_id)).length;

  return (
    <div>
      <PageHeader title="Machine competencies" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Which machine types each team member is competent to operate. Checking out anything else shows them a warning
        on the check-out screen, and Equipment history notes it.
      </p>

      {loadError && (
        <Alert tone="danger" title="Couldn't load everything" style={{ marginBottom: "var(--space-3)" }}>
          {loadError}
        </Alert>
      )}
      {loading && <SkeletonList rows={4} />}
      {!loading && people.length === 0 && <EmptyState title="No active staff" />}

      {!loading &&
        people.map((person) => {
          const count = countFor(person.id);
          return (
            <Card
              pad="sm"
              key={person.id}
              style={{ marginBottom: "var(--space-2)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{person.display_name}</div>
                <div style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
                  {roleNames[person.role_id] || "No role"} · {count === 0 ? "No machines" : `${count} machine${count === 1 ? "" : "s"}`}
                </div>
              </div>
              <Button onClick={() => openPerson(person)} disabled={!!loadError}>
                Machines
              </Button>
            </Card>
          );
        })}

      {editing && (
        <Modal title={`${editing.person.display_name} — machines`} onClose={() => setEditing(null)}>
          <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
            Tick the machine types {editing.person.display_name} is competent to operate. Anything else they check out will
            show a warning on the check-out screen.
          </p>
          <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
            <Button size="sm" variant="ghost" onClick={() => setEditing((e) => ({ ...e, ticked: new Set(types.map((t) => t.id)) }))}>
              Tick all
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing((e) => ({ ...e, ticked: new Set() }))}>
              Clear all
            </Button>
          </div>

          {types.length === 0 && <EmptyState title="No equipment types yet" />}
          {types.map((t) => {
            const ticked = editing.ticked.has(t.id);
            const current = competenciesFor(editing.person.id).find((c) => c.equipment_type_id === t.id);
            return (
              <label
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-3)",
                  padding: "var(--space-2) var(--space-1)",
                  borderBottom: `1px solid ${colors.line}`,
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={ticked} onChange={() => toggle(t.id)} style={{ width: "var(--checkbox-size-md)", height: "var(--checkbox-size-md)", flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: ticked ? 600 : 400 }}>{t.name}</span>
                {ticked && current && (
                  <span style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>
                    Ticked by {current.granted_by_profile?.display_name || "—"} ·{" "}
                    {new Date(current.granted_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                )}
              </label>
            );
          })}

          {saveError && (
            <Alert tone="danger" title="Couldn't save" style={{ marginTop: "var(--space-3)" }}>
              {saveError}
            </Alert>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-4)", gap: "var(--space-3)" }}>
            <span style={{ fontSize: "var(--text-sm)", color: colors.inkSoft }}>
              {[...editing.ticked].filter((id) => typeIds.has(id)).length} of {types.length} ticked
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button onClick={() => setEditing(null)}>Cancel</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
