import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { getHolidaySettings, upsertHolidaySettings } from "../../lib/holidayQueries.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Card, Field, Input, PageHeader, Select } from "../../ui/index.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function HolidaySettingsTab() {
  const { org } = useAuth();
  const [settings, setSettings] = useState({
    holiday_year_start_month: 4,
    baseline_annual_days: 28,
    baseline_weekly_hours: 35,
    baseline_daily_hours: 7,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!org) return;
    getHolidaySettings()
      .then((data) => {
        if (data) setSettings(data);
      })
      .catch((err) => setError(err.message || String(err)));
  }, [org]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    if (!(settings.baseline_weekly_hours > 0)) {
      setError("Baseline weekly hours must be greater than 0 -- entitlement and accrual divide by it.");
      setSaving(false);
      return;
    }
    try {
      await upsertHolidaySettings(org.id, settings);
      setSaved(true);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  const entitlementWeeks = (settings.baseline_annual_days * settings.baseline_daily_hours) / settings.baseline_weekly_hours;
  const ratio = entitlementWeeks / (52 - entitlementWeeks);

  return (
    <div>
      <PageHeader title="Holiday settings" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        The baseline everyone's entitlement is pro-rated from, and when the holiday year starts.
      </p>

      <Card pad="md" style={{ maxWidth: 480 }}>
        {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
        {saved && (
          <div style={{ fontSize: "var(--text-sm)", padding: "8px 12px", background: colors.okSurface, border: `1px solid ${colors.okBorder}`, color: colors.okInk, borderRadius: "var(--radius-sm)", marginBottom: 14 }}>
            Saved.
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <Field label="Holiday year starts">
            <Select
              value={settings.holiday_year_start_month}
              onChange={(e) => setSettings({ ...settings, holiday_year_start_month: Number(e.target.value) })}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          <Field label="Baseline annual days">
            <Input
              type="number" step="0.1" min="0"
              value={settings.baseline_annual_days}
              onChange={(e) => setSettings({ ...settings, baseline_annual_days: Number(e.target.value) })}
            />
          </Field>
          <Field label="Baseline weekly hours">
            <Input
              type="number" step="0.5" min="0.5"
              value={settings.baseline_weekly_hours}
              onChange={(e) => setSettings({ ...settings, baseline_weekly_hours: Number(e.target.value) })}
            />
          </Field>
          <Field label="Baseline daily hours">
            <Input
              type="number" step="0.5" min="0"
              value={settings.baseline_daily_hours}
              onChange={(e) => setSettings({ ...settings, baseline_daily_hours: Number(e.target.value) })}
            />
          </Field>
        </div>

        <p style={{ fontSize: "var(--text-xs)", color: colors.inkSoft, marginBottom: 16 }}>
          Everyone's entitlement is pro-rated linearly from this baseline, which means the accrual ratio applied to
          everyone's hours worked comes out the same regardless of their own weekly hours: currently{" "}
          <strong>{(ratio * 100).toFixed(2)}%</strong> ({entitlementWeeks.toFixed(2)} weeks of entitlement).
        </p>

        <Button variant="primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
      </Card>
    </div>
  );
}
