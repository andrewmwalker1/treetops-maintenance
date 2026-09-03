import { useNavigate } from "react-router-dom";
import { useKeyLookup, summarizeKeyEvent } from "../lib/useKeyLookup.js";
import KeySelector, { locationLabel } from "../keys/KeySelector.jsx";
import { colors } from "../lib/theme.js";
import { Alert, Button, Card, IconArrowLeft, PageHeader, SkeletonList } from "../ui/index.js";

export default function FindKey() {
  const navigate = useNavigate();
  const { keyTags, selectedTag, lastEvent, error, pickTag, backToSelect } = useKeyLookup();

  if (selectedTag) {
    return (
      <div style={{ maxWidth: "560px" }}>
        <Button onClick={backToSelect} icon={<IconArrowLeft size={15} />}>
          Back
        </Button>
        <PageHeader title={locationLabel(selectedTag)} />
        <Card pad="md">
          {error && (
          <Alert tone="danger" title="Something went wrong">
            {error}
          </Alert>
        )}
          {selectedTag.isHistorical ? (
            <p style={{ fontSize: "var(--text-base)", margin: 0 }}>
              Handed over to {selectedTag.handed_over_to || "—"} on {new Date(selectedTag.created_at).toLocaleDateString("en-GB")}.
              {selectedTag.handed_over_notes && <> {selectedTag.handed_over_notes}</>}
              <br />
              <span style={{ color: colors.inkSoft, fontSize: "var(--text-sm)" }}>This key is gone — no tag on file for it anymore. Other keys for this pitch, if any, are separate results in the search list.</span>
            </p>
          ) : (
            <>
              {lastEvent === undefined && !error && <SkeletonList rows={3} />}
              {lastEvent !== undefined && <p style={{ fontSize: "var(--text-base)", margin: 0 }}>{summarizeKeyEvent(lastEvent)}</p>}
            </>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "560px" }}>
      <Button onClick={() => navigate("/key-register")} icon={<IconArrowLeft size={15} />}>
        Keys
      </Button>
      <PageHeader title="Find a key" />
      <KeySelector size="normal" tags={keyTags} onPick={pickTag} notFoundMessage="That tag isn't recognised." />
    </div>
  );
}
