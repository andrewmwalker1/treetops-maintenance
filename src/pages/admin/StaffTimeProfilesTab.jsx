import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { getHolidaySettings, getProfilesForTimeProfileAdmin, upsertStaffTimeProfile } from "../../lib/holidayQueries.js";
import { colors } from "../../lib/theme.js";
import { Alert, Button, Field, Input, PageHeader, Select } from "../../ui/index.js";

const DAYS = [
  ["works_monday", "Mon"], ["works_tuesday", "Tue"], ["works_wednesday", "Wed"], ["works_thursday", "Thu"],
  ["works_friday", "Fri"], ["works_saturday", "Sat"], ["works_sunday", "Sun"],
];

const DEFAULT_PATTERN = {
  pay_basis: "hourly_daily",
  weekly_hours: 35,
  has_fixed_pattern: true,
  works_monday: true, works_tuesday: true, works_wednesday: true, works_thursday: true, works_friday: true,
  works_saturday: false, works_sunday: false,
  has_fixed_entitlement: true,
};

function entitlementHours(pattern, settings) {
  if (!settings) return null;
  return (settings.baseline_annual_days * settings.baseline_daily_hours / settings.baseline_weekly_hours) * pattern.weekly_hours;
}

function PersonRow({ profileId, displayName, initial, settings, onSave }) {
  const [pattern, setPattern] = useState(() => ({ ...DEFAULT_PATTERN, ...initial }));
  const [saving, setSaving] = useState(false);
  const isStandard = !pattern.has_fixed_pattern
    ? false
    : pattern.works_monday && pattern.works_tuesday && pattern.works_wednesday && pattern.works_thursday && pattern.works_friday
      && !pattern.works_saturday && !pattern.works_sunday;
  const entHours = entitlementHours(pattern, settings);

  async function persist(next) {
    setPattern(next);
    setSaving(true);
    try {
      await onSave(profileId, next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ background: colors.surfaceHover, border: `1px solid ${colors.line}`, borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <span style={{ fontWeight: 600 }}>{displayName}</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "var(--text-xs)", color: colors.inkSoft, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={!pattern.has_fixed_pattern}
            onChange={(e) => persist({ ...pattern, has_fixed_pattern: !e.target.checked })}
          />
          Varies week to week
        </label>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {DAYS.map(([key, label]) => {
          const active = pattern.has_fixed_pattern && pattern[key];
          return (
            <Button
              key={key}
              disabled={!pattern.has_fixed_pattern}
              onClick={() => persist({ ...pattern, [key]: !pattern[key] })}
              style={{
                width: 48, height: 32, fontSize: "var(--text-xs)", padding: 0,
                background: active ? colors.moss : undefined,
                color: active ? colors.onDark : undefined,
                borderColor: active ? colors.moss : undefined,
              }}
            >
              {label}
            </Button>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Field label="Weekly hours">
          <Input
            type="number" step="0.5" min="0"
            value={pattern.weekly_hours}
            onChange={(e) => persist({ ...pattern, weekly_hours: Number(e.target.value) || 0 })}
            style={{ width: 90 }}
          />
        </Field>
        <Field label="Pay basis">
          <Select
            value={pattern.pay_basis}
            onChange={(e) => persist({ ...pattern, pay_basis: e.target.value })}
            style={{ width: 160 }}
          >
            <option value="hourly_daily">Hourly (daily grid)</option>
            <option value="fixed_weekly">Fixed weekly hours</option>
          </Select>
        </Field>
        <div style={{ background: colors.surfaceHover, borderRadius: "var(--radius-sm)", padding: "8px 10px", fontSize: "var(--text-xs)" }}>
          Entitlement: <strong>{entHours != null ? `${entHours.toFixed(1)} hrs` : "—"}</strong>
        </div>
        <div style={{ background: isStandard ? colors.okSurface : colors.surfaceHover, color: isStandard ? colors.okInk : colors.inkSoft, borderRadius: "var(--radius-sm)", padding: "8px 10px", fontSize: "var(--text-xs)" }}>
          {isStandard ? "Bank holidays auto-booked" : "Bank holidays not auto-booked"}
        </div>
        {saving && <span style={{ fontSize: "var(--text-xs)", color: colors.inkSoft }}>Saving…</span>}
      </div>
    </div>
  );
}

export default function StaffTimeProfilesTab() {
  const { org } = useAuth();
  const [people, setPeople] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!org) return;
    Promise.all([getProfilesForTimeProfileAdmin(org.id), getHolidaySettings()])
      .then(([profiles, holidaySettings]) => {
        setPeople(profiles);
        setSettings(holidaySettings);
      })
      .catch((err) => setError(err.message || String(err)))
      .finally(() => setLoading(false));
  }, [org]);

  async function handleSave(profileId, pattern) {
    setError("");
    try {
      await upsertStaffTimeProfile(profileId, org.id, pattern);
    } catch (err) {
      setError(err.message || String(err));
    }
  }

  return (
    <div>
      <PageHeader title="Work patterns" level={2} />
      <p style={{ fontSize: "var(--text-sm)", color: colors.inkSoft, marginTop: 0 }}>
        Baseline: {settings ? `${settings.baseline_annual_days} days at ${settings.baseline_weekly_hours} hrs/week` : "…"}.
        Everyone else is pro-rated from this. Which days someone works drives bank-holiday auto-booking and which
        days are greyed out as non-working on their booking calendar.
      </p>
      {error && <Alert tone="danger" title="Something went wrong">{error}</Alert>}
      {!loading && people.map((p) => (
        <PersonRow
          key={p.profileId}
          profileId={p.profileId}
          displayName={p.displayName}
          initial={p.timeProfile}
          settings={settings}
          onSave={handleSave}
        />
      ))}
    </div>
  );
}
