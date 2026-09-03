import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyRelocate } from "../lib/useKeyRelocate.js";
import KeySelector, { locationLabel, formatKeyLocation } from "./KeySelector.jsx";
import PitchPicker from "../components/PitchPicker.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, Field, IconArrowLeft, PageHeader, Select } from "../ui/index.js";

// can_manage_keys-gated (Andy: "selected users only") -- lets someone like
// Sam move a key to a different pitch or special location from the key
// station itself, not just from the desktop Admin > Key Tags "Move"
// button. Writes through the same key_tags table and log_key_tag_event
// trigger, so it shows up in the admin activity log exactly like a
// desktop-initiated move would.
export default function KeyStationRelocate() {
  const navigate = useNavigate();
  const permissions = usePermissions();
  const {
    view,
    keyTags,
    pitches,
    specialLocations,
    openTagIds,
    selectedTag,
    pitchId,
    setPitchId,
    specialLocationId,
    setSpecialLocationId,
    submitting,
    error,
    canSubmit,
    pickTag,
    backToSelect,
    handleSubmit,
  } = useKeyRelocate();

  if (permissions.size > 0 && !permissions.has("can_manage_keys")) {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <p style={{ color: colors.inkSoft, fontSize: "var(--text-md)" }}>This account doesn't have access to relocate keys.</p>
        <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />}>Menu</Button>
      </div>
    );
  }

  if (view === "done") {
    const newLabel = formatKeyLocation(
      pitches.find((p) => p.id === pitchId)?.pitch_number_or_name,
      specialLocations.find((s) => s.id === specialLocationId)?.label
    );
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <PageHeader title="Relocated" />
        <p style={{ fontSize: "var(--text-md)" }}>Moved to {newLabel}.</p>
        <Button variant="primary" size="kiosk" onClick={() => navigate("/keys")}>Done</Button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Back
        </Button>
        <PageHeader title={locationLabel(selectedTag)} />

        {openTagIds.has(selectedTag.id) && (
          <Card pad="lg" style={{ marginBottom: "var(--space-4)", borderColor: colors.gold }}>
            <p style={{ margin: 0, fontSize: "var(--text-base)" }}>
              This key is currently checked out — it could just be out being used to get the caravan ready. Moving it only changes where it normally
              lives; it won't check it in.
            </p>
          </Card>
        )}

        <Card pad="lg" style={{ marginBottom: "var(--space-4)" }}>
          <Field label="Home pitch" style={{ marginBottom: "var(--space-4)" }}>
            <PitchPicker pitches={pitches} value={pitchId} onChange={setPitchId} style={{ minHeight: "72px" }} />
          </Field>
          <Field label="Currently at a special location">
            {({ id }) => (
              <Select id={id} value={specialLocationId} onChange={(e) => setSpecialLocationId(e.target.value)} className="tt-input--kiosk">
                <option value="">— in the cupboard at its pitch —</option>
                {specialLocations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </Card>

        {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}

        <Button variant="primary" size="kiosk" onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
      <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <PageHeader title="Relocate a key" />
      <KeySelector tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised." />
    </div>
  );
}
