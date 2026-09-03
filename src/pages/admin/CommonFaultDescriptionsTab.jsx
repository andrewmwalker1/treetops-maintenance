import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors, text } from "../../lib/theme.js";
import { Alert, Button, Card, Chip, EmptyState, IconArrowDown, IconArrowUp, IconButton, IconClose, Input, PageHeader } from "../../ui/index.js";

export default function CommonFaultDescriptionsTab() {
  const { org } = useAuth();
  const [types, setTypes] = useState([]);
  const [selectedTypeId, setSelectedTypeId] = useState(null);
  const [faults, setFaults] = useState([]);
  const [newFault, setNewFault] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!org) return;
    supabase
      .from("equipment_types")
      .select("id, name")
      .eq("org_id", org.id)
      .order("name")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else {
          setTypes(data || []);
          if (data?.length && !selectedTypeId) setSelectedTypeId(data[0].id);
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [org]);

  function refreshFaults(typeId) {
    if (!typeId) return;
    supabase
      .from("common_fault_descriptions")
      .select("id, description, sort_order")
      .eq("equipment_type_id", typeId)
      .order("sort_order")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setFaults(data || []);
      });
  }

  useEffect(() => {
    refreshFaults(selectedTypeId);
  }, [selectedTypeId]);

  async function addFault(e) {
    e.preventDefault();
    const description = newFault.trim();
    if (!description || !selectedTypeId) return;
    const nextSortOrder = faults.length > 0 ? Math.max(...faults.map((f) => f.sort_order)) + 1 : 0;
    const { error: err } = await supabase
      .from("common_fault_descriptions")
      .insert({ org_id: org.id, equipment_type_id: selectedTypeId, description, sort_order: nextSortOrder });
    if (err) setError(err.message);
    else {
      setNewFault("");
      refreshFaults(selectedTypeId);
    }
  }

  function editFaultLocal(index, text) {
    setFaults((prev) => prev.map((f, i) => (i === index ? { ...f, description: text } : f)));
  }

  async function persistFault(fault) {
    const { error: err } = await supabase
      .from("common_fault_descriptions")
      .update({ description: fault.description })
      .eq("id", fault.id);
    if (err) setError(err.message);
  }

  async function removeFault(id) {
    const { error: err } = await supabase.from("common_fault_descriptions").delete().eq("id", id);
    if (err) setError(err.message);
    else refreshFaults(selectedTypeId);
  }

  async function moveFault(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= faults.length) return;
    const a = faults[index];
    const b = faults[target];
    const [{ error: err1 }, { error: err2 }] = await Promise.all([
      supabase.from("common_fault_descriptions").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("common_fault_descriptions").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    if (err1 || err2) setError((err1 || err2).message);
    else refreshFaults(selectedTypeId);
  }

  return (
    <div>
      <PageHeader title="Common faults" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        The picklist staff choose from when reporting an issue with a piece of kit on the workshop kiosk, per equipment type.
      </p>

      {types.length === 0 && (
        <EmptyState
          title="No equipment types yet"
          action={
            <Button as={Link} to="/admin/equipmentTypes" variant="primary">
              Go to Equipment types
            </Button>
          }
        >
          Add some there first.
        </EmptyState>
      )}

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-4)" }}>
        {types.map((t) => (
          <Chip
            key={t.id}
            active={selectedTypeId === t.id}
            onClick={() => setSelectedTypeId(t.id)}
          >
            {t.name}
          </Chip>
        ))}
      </div>

      {error && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      {selectedTypeId && (
        <Card pad="md" style={{ maxWidth: "480px" }}>
          {faults.length === 0 && <EmptyState title="No common faults listed yet" />}
          {faults.map((f, i) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-1) 0" }}>
              <Input value={f.description} onChange={(e) => editFaultLocal(i, e.target.value)} onBlur={() => persistFault(faults[i])} />
              <IconButton size="sm" label="Move up" onClick={() => moveFault(i, -1)} disabled={i === 0}><IconArrowUp size={14} /></IconButton>
              <IconButton size="sm" label="Move down" onClick={() => moveFault(i, 1)} disabled={i === faults.length - 1}><IconArrowDown size={14} /></IconButton>
              <IconButton size="sm" label="Remove" onClick={() => removeFault(f.id)} style={{ color: colors.immediate }}><IconClose size={14} /></IconButton>
            </div>
          ))}

          <form onSubmit={addFault} style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
            <Input value={newFault} onChange={(e) => setNewFault(e.target.value)} placeholder="Add a common fault…" />
            <Button type="submit">Add</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
