import { useNavigate } from "react-router-dom";
import { useKeyLookup, summarizeKeyEvent } from "../lib/useKeyLookup.js";
import KeySelector, { locationLabel } from "./KeySelector.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, IconArrowLeft, PageHeader, SkeletonList } from "../ui/index.js";

// The non-admin "where's this key" view Andy asked for: shows only the
// single most recent event, not the full history (that's the admin
// activity log, gated can_manage_keys, elsewhere).
export default function KeyStationLookup() {
  const navigate = useNavigate();
  const { keyTags, selectedTag, lastEvent, error, pickTag, backToSelect } = useKeyLookup();

  if (selectedTag) {
    return (
      <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
          Back
        </Button>
        <PageHeader title={locationLabel(selectedTag)} />
        <Card pad="lg">
          {error && (
            <Alert tone="danger" title="Something went wrong">
              {error}
            </Alert>
          )}
          {selectedTag.isHistorical ? (
            <p style={{ fontSize: "var(--text-md)", margin: 0 }}>
              Handed over to {selectedTag.handed_over_to || "—"} on {new Date(selectedTag.created_at).toLocaleDateString("en-GB")}.
              {selectedTag.handed_over_notes && <> {selectedTag.handed_over_notes}</>}
              <br />
              <span style={{ color: colors.inkSoft, fontSize: "var(--text-base)" }}>This key is gone — no tag on file for it anymore. Other keys for this pitch, if any, are separate results in the search list.</span>
            </p>
          ) : (
            <>
              {lastEvent === undefined && !error && <SkeletonList rows={1} height={24} />}
              {lastEvent !== undefined && <p style={{ fontSize: "var(--text-md)", margin: 0 }}>{summarizeKeyEvent(lastEvent)}</p>}
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--space-6)", maxWidth: "var(--width-2xl)", margin: "0 auto" }}>
      <Button onClick={() => navigate("/keys")} icon={<IconArrowLeft size={16} />} style={{ marginBottom: "var(--space-5)" }}>
        Menu
      </Button>
      <PageHeader title="Find a key" />
      <KeySelector tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised." />
    </div>
  );
}
