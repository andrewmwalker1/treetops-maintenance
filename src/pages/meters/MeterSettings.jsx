import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import { colors } from "../../lib/theme.js";
import { Button, Card, PageHeader } from "../../ui/index.js";

export default function MeterSettings() {
  const { activeSite } = useAuth();
  const [electricCost, setElectricCost] = useState("");
  const [gasCost, setGasCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!activeSite) return;
    supabase
      .from("meter_reading_settings")
      .select("electric_unit_cost, gas_unit_cost")
      .eq("site_id", activeSite.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setElectricCost(data.electric_unit_cost ?? "");
          setGasCost(data.gas_unit_cost ?? "");
        }
      });
  }, [activeSite]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const { error } = await supabase
      .from("meter_reading_settings")
      .upsert({ site_id: activeSite.id, electric_unit_cost: electricCost || null, gas_unit_cost: gasCost || null }, { onConflict: "site_id" });
    setSaving(false);
    if (error) {
      console.error("Failed to save unit costs", error);
    } else {
      setSaved(true);
    }
  }

  if (!activeSite) return null;

  return (
    <div style={{ maxWidth: "480px" }}>
      <PageHeader title="Unit cost settings" />
      <p style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>
        Used only for the estimated £ shown on the confirm screen as a sanity check — not for actual billing.
      </p>
      <Card pad="lg">
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <label style={{ fontSize: "var(--text-sm)", flex: 1 }}>
            Electric £/unit
            <input type="number" step="0.01" value={electricCost} onChange={(e) => setElectricCost(e.target.value)} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", border: `1px solid ${colors.lineStrong}`, marginTop: "var(--space-1)" }} />
          </label>
          <label style={{ fontSize: "var(--text-sm)", flex: 1 }}>
            Gas £/unit
            <input type="number" step="0.01" value={gasCost} onChange={(e) => setGasCost(e.target.value)} style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "var(--space-2) var(--space-3)", borderRadius: "var(--radius-sm)", border: `1px solid ${colors.lineStrong}`, marginTop: "var(--space-1)" }} />
          </label>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </Button>
      </Card>
    </div>
  );
}
