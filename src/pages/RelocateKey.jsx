import { useNavigate } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useKeyRelocate } from "../lib/useKeyRelocate.js";
import KeySelector, { locationLabel, formatKeyLocation } from "../keys/KeySelector.jsx";
import PitchPicker from "../components/PitchPicker.jsx";
import { colors, fonts } from "../lib/theme.js";
import { Alert, Button, Card, Field, IconArrowLeft, PageHeader, Select } from "../ui/index.js";

// Same key-relocate logic as the key-cupboard kiosk (useKeyRelocate.js),
// matching CheckInKey.jsx's relationship to KeyStationCheckIn.jsx --
// can_manage_keys-gated same as the kiosk's own version, not open to
// everyone with can_use_key_system.
export default function RelocateKey() {
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
      <div style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "var(--text-base)", color: colors.inkSoft, maxWidth: "var(--width-sm)", margin: "0 auto" }}>
          This account doesn't have access to relocate keys.
        </p>
      </div>
    );
  }

  if (view === "done") {
    const newLabel = formatKeyLocation(
      pitches.find((p) => p.id === pitchId)?.pitch_number_or_name,
      specialLocations.find((s) => s.id === specialLocationId)?.label
    );
    return (
      <div style={{ maxWidth: "var(--width-xl)" }}>
        <PageHeader title="Relocated" />
        <p style={{ fontSize: "var(--text-base)" }}>Moved to {newLabel}.</p>
        <Button variant="primary" onClick={() => navigate("/key-register")}>Done</Button>
      </div>
    );
  }

  if (view === "confirm") {
    return (
      <div style={{ maxWidth: "var(--width-xl)" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={15} />}>
          Back
        </Button>
        <PageHeader title={locationLabel(selectedTag)} />

        {openTagIds.has(selectedTag.id) && (
          <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
            <p style={{ margin: 0, fontSize: "var(--text-base)" }}>
              This key is currently checked out — it could just be out being used to get the caravan ready. Moving it only changes where it normally
              lives; it won't check it in.
            </p>
          </Card>
        )}

        <Card pad="md" style={{ marginBottom: "var(--space-4)" }}>
          <Field label="Home pitch" style={{ marginBottom: "var(--space-4)" }}>
            <PitchPicker pitches={pitches} value={pitchId} onChange={setPitchId} />
          </Field>
          <Field label="Currently at a special location">
            {({ id }) => (
              <Select id={id} value={specialLocationId} onChange={(e) => setSpecialLocationId(e.target.value)}>
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

        <Button variant="primary" block onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "var(--width-xl)" }}>
      <Button onClick={() => navigate("/key-register")} icon={<IconArrowLeft size={15} />}>
        Keys
      </Button>
      <PageHeader title="Relocate a key" />
      <KeySelector size="normal" tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised." />
    </div>
  );
}
