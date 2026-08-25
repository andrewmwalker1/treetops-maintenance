import { useEffect, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import RfidScanListener from "../../components/RfidScanListener.jsx";
import PitchPicker from "../../components/PitchPicker.jsx";
import { colors, fonts, cardStyle, buttonStyle } from "../../lib/theme.js";

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.lineStrong}`,
  fontFamily: fonts.body,
  marginBottom: "10px",
};

function locationLabel(tag, pitches, specialLocations) {
  if (tag.pitch_id) return pitches.find((p) => p.id === tag.pitch_id)?.pitch_number_or_name || "Unknown pitch";
  if (tag.special_location_id) return specialLocations.find((s) => s.id === tag.special_location_id)?.label || "Unknown location";
  return "Unallocated (spare)";
}

// Shared by the "register a new tag" form and each row's "move" form --
// both need the same pitch-or-special-location choice NewJob.jsx already
// establishes for job locations (pitch vs. area), just with key_tags'
// two location columns instead.
function LocationPicker({ pitches, specialLocations, kind, setKind, pitchId, setPitchId, specialLocationId, setSpecialLocationId }) {
  return (
    <>
      <div style={{ display: "flex", gap: "16px", marginBottom: "10px" }}>
        <label style={{ fontSize: "13px" }}>
          <input type="radio" checked={kind === "pitch"} onChange={() => setKind("pitch")} /> Pitch
        </label>
        <label style={{ fontSize: "13px" }}>
          <input type="radio" checked={kind === "special"} onChange={() => setKind("special")} /> Special location
        </label>
      </div>
      {kind === "pitch" ? (
        <PitchPicker pitches={pitches} value={pitchId} onChange={setPitchId} style={fieldStyle} />
      ) : (
        <select required value={specialLocationId} onChange={(e) => setSpecialLocationId(e.target.value)} style={fieldStyle}>
          <option value="">—</option>
          {specialLocations.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      )}
    </>
  );
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "allocated", label: "Allocated" },
  { key: "spare", label: "Spare" },
  { key: "lost", label: "Lost" },
];

export default function KeyTagsTab() {
  const { org, activeSite } = useAuth();
  const [keyTags, setKeyTags] = useState([]);
  const [pitches, setPitches] = useState([]);
  const [specialLocations, setSpecialLocations] = useState([]);
  const [openTagIds, setOpenTagIds] = useState(new Set());
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [scannedUid, setScannedUid] = useState(null);
  const [assignKind, setAssignKind] = useState("pitch");
  const [assignPitchId, setAssignPitchId] = useState("");
  const [assignSpecialLocationId, setAssignSpecialLocationId] = useState("");

  const [movingTagId, setMovingTagId] = useState(null);
  const [moveKind, setMoveKind] = useState("pitch");
  const [movePitchId, setMovePitchId] = useState("");
  const [moveSpecialLocationId, setMoveSpecialLocationId] = useState("");

  const [newLocationLabel, setNewLocationLabel] = useState("");

  function refresh() {
    if (!org || !activeSite) return;
    Promise.all([
      supabase.from("key_tags").select("id, tag_uid, pitch_id, special_location_id, status, created_at").eq("site_id", activeSite.id).order("created_at"),
      supabase.from("pitches").select("id, pitch_number_or_name").eq("site_id", activeSite.id).order("pitch_number_or_name"),
      supabase.from("key_special_locations").select("id, label").eq("site_id", activeSite.id).order("label"),
      supabase.from("key_checkouts").select("key_tag_id").is("checked_in_at", null),
    ]).then(([{ data: kt, error: err }, { data: p }, { data: s }, { data: open }]) => {
      if (err) setError(err.message);
      else setKeyTags(kt || []);
      setPitches(p || []);
      setSpecialLocations(s || []);
      setOpenTagIds(new Set((open || []).map((o) => o.key_tag_id)));
    });
  }

  useEffect(refresh, [org, activeSite]);

  const visibleTags = keyTags.filter((tag) => {
    if (statusFilter === "lost" && tag.status !== "lost") return false;
    if (statusFilter === "allocated" && (tag.status === "lost" || !(tag.pitch_id || tag.special_location_id))) return false;
    if (statusFilter === "spare" && (tag.status === "lost" || tag.pitch_id || tag.special_location_id)) return false;
    if (!search.trim()) return true;
    const haystack = `${locationLabel(tag, pitches, specialLocations)} ${tag.tag_uid}`.toLowerCase();
    return haystack.includes(search.trim().toLowerCase());
  });

  async function handleMarkLost(tag) {
    const notePrompt = window.prompt(
      `Mark ${locationLabel(tag, pitches, specialLocations)}'s key tag as lost. Add a note (optional):`,
      ""
    );
    if (notePrompt === null) return; // cancelled
    const { error: err } = await supabase
      .from("key_tags")
      .update({ status: "lost", lost_at: new Date().toISOString(), lost_notes: notePrompt.trim() || null })
      .eq("id", tag.id);
    if (err) setError(err.message);
    else refresh();
  }

  async function handleReinstate(tag) {
    const proceed = window.confirm(`Mark this key tag as found again? It'll go back to being usable at ${locationLabel(tag, pitches, specialLocations)}.`);
    if (!proceed) return;
    const { error: err } = await supabase.from("key_tags").update({ status: "active", lost_at: null, lost_notes: null }).eq("id", tag.id);
    if (err) setError(err.message);
    else refresh();
  }

  function handleScan(uid) {
    setError(null);
    setScannedUid(uid);
    setAssignKind("pitch");
    setAssignPitchId("");
    setAssignSpecialLocationId("");
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!scannedUid) return;
    // PitchPicker only resolves to a real id on an exact match -- a select
    // enforced this with the required attribute, but a free-typed search
    // box needs the same check done explicitly.
    if (assignKind === "pitch" && !assignPitchId) {
      setError("Pick a pitch from the list before saving.");
      return;
    }
    const { error: err } = await supabase.from("key_tags").insert({
      org_id: org.id,
      site_id: activeSite.id,
      tag_uid: scannedUid,
      pitch_id: assignKind === "pitch" ? assignPitchId : null,
      special_location_id: assignKind === "special" ? assignSpecialLocationId : null,
    });
    if (err) {
      if (err.code === "23505") {
        const existing = keyTags.find((t) => t.tag_uid === scannedUid);
        setError(`This tag is already registered${existing ? ` (currently: ${locationLabel(existing, pitches, specialLocations)})` : ""}.`);
      } else {
        setError(err.message);
      }
      return;
    }
    setScannedUid(null);
    refresh();
  }

  function startMove(tag) {
    setMovingTagId(tag.id);
    setMoveKind(tag.special_location_id ? "special" : "pitch");
    setMovePitchId(tag.pitch_id || "");
    setMoveSpecialLocationId(tag.special_location_id || "");
  }

  async function handleMove(e) {
    e.preventDefault();
    if (moveKind === "pitch" && !movePitchId) {
      setError("Pick a pitch from the list before saving.");
      return;
    }
    const tag = keyTags.find((t) => t.id === movingTagId);
    if (tag && openTagIds.has(tag.id)) {
      const proceed = window.confirm(
        "This key is currently checked out. Moving it only changes where it normally lives — it won't check it in or affect the open checkout. The key could just be out being used to get the caravan ready. Continue?"
      );
      if (!proceed) return;
    }
    const { error: err } = await supabase
      .from("key_tags")
      .update({
        pitch_id: moveKind === "pitch" ? movePitchId : null,
        special_location_id: moveKind === "special" ? moveSpecialLocationId : null,
      })
      .eq("id", movingTagId);
    if (err) {
      setError(err.message);
      return;
    }
    setMovingTagId(null);
    refresh();
  }

  async function handleRemove(tag) {
    const checkoutWarning = openTagIds.has(tag.id)
      ? " This key is currently checked out — it could just be out being used to get the caravan ready, so removing it here won't check it in or affect that open checkout."
      : "";
    const proceed = window.confirm(
      `Remove this key tag from ${locationLabel(tag, pitches, specialLocations)}? The tag itself stays registered and can be allocated elsewhere later.${checkoutWarning}`
    );
    if (!proceed) return;
    const { error: err } = await supabase.from("key_tags").update({ pitch_id: null, special_location_id: null }).eq("id", tag.id);
    if (err) setError(err.message);
    else refresh();
  }

  async function handleAddLocation(e) {
    e.preventDefault();
    const label = newLocationLabel.trim();
    if (!label) return;
    const { error: err } = await supabase.from("key_special_locations").insert({ org_id: org.id, site_id: activeSite.id, label });
    if (err) {
      setError(err.message);
      return;
    }
    setNewLocationLabel("");
    refresh();
  }

  return (
    <div>
      <h2 style={{ fontFamily: fonts.display, fontSize: "16px", color: colors.mossDark, marginTop: 0 }}>Key RFID tags</h2>
      <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
        Scan a tag to register it against a pitch or a special location. Multiple tags can share the same pitch (a caravan with more than one key).
      </p>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusFilter(s.key)}
            style={{
              border: `1px solid ${statusFilter === s.key ? colors.mossDark : colors.lineStrong}`,
              background: statusFilter === s.key ? colors.mossDark : "transparent",
              color: statusFilter === s.key ? "#FFFFFF" : colors.inkSoft,
              borderRadius: "999px",
              padding: "6px 14px",
              fontFamily: fonts.body,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by pitch, location, or tag UID…"
        style={{ ...fieldStyle, maxWidth: "360px" }}
      />

      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

      {visibleTags.map((tag) => (
        <div key={tag.id} style={{ ...cardStyle, padding: "12px 16px", marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {locationLabel(tag, pitches, specialLocations)}
                {tag.status === "lost" && (
                  <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: "#FFFFFF", background: colors.immediate, borderRadius: "999px", padding: "2px 10px" }}>
                    LOST
                  </span>
                )}
                {openTagIds.has(tag.id) && (
                  <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: colors.mossDark, background: colors.line, borderRadius: "999px", padding: "2px 10px" }}>
                    CHECKED OUT
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: colors.inkSoft, fontFamily: fonts.mono }}>{tag.tag_uid}</div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {tag.status === "lost" ? (
                <button onClick={() => handleReinstate(tag)} style={buttonStyle.secondary}>Reinstate</button>
              ) : (
                <>
                  <button onClick={() => startMove(tag)} style={buttonStyle.secondary}>Move</button>
                  <button onClick={() => handleRemove(tag)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Remove</button>
                  <button onClick={() => handleMarkLost(tag)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Mark as lost</button>
                </>
              )}
            </div>
          </div>
          {movingTagId === tag.id && (
            <form onSubmit={handleMove} style={{ marginTop: "12px", borderTop: `1px solid ${colors.lineStrong}`, paddingTop: "12px" }}>
              <LocationPicker
                pitches={pitches}
                specialLocations={specialLocations}
                kind={moveKind}
                setKind={setMoveKind}
                pitchId={movePitchId}
                setPitchId={setMovePitchId}
                specialLocationId={moveSpecialLocationId}
                setSpecialLocationId={setMoveSpecialLocationId}
              />
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" style={buttonStyle.primary}>Save</button>
                <button type="button" onClick={() => setMovingTagId(null)} style={buttonStyle.secondary}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      ))}
      {keyTags.length === 0 && <p style={{ color: colors.inkSoft }}>No key tags registered yet.</p>}
      {keyTags.length > 0 && visibleTags.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing matches this filter.</p>}

      <div style={{ ...cardStyle, padding: "16px", maxWidth: "440px", marginTop: "16px" }}>
        <h3 style={{ fontFamily: fonts.display, fontSize: "14px", color: colors.mossDark, marginTop: 0 }}>Register a new tag</h3>
        <RfidScanListener onScan={handleScan} />
        {!scannedUid && (
          <p style={{ color: colors.inkSoft, fontSize: "13px" }}>
            Scan a tag on the reader connected to this computer.
          </p>
        )}
        {scannedUid && (
          <form onSubmit={handleAssign}>
            <p style={{ fontSize: "13px", fontFamily: fonts.mono }}>Scanned tag: {scannedUid}</p>
            <LocationPicker
              pitches={pitches}
              specialLocations={specialLocations}
              kind={assignKind}
              setKind={setAssignKind}
              pitchId={assignPitchId}
              setPitchId={setAssignPitchId}
              specialLocationId={assignSpecialLocationId}
              setSpecialLocationId={setAssignSpecialLocationId}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" style={buttonStyle.primary}>Save</button>
              <button type="button" onClick={() => setScannedUid(null)} style={buttonStyle.secondary}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div style={{ ...cardStyle, padding: "16px", maxWidth: "440px", marginTop: "16px" }}>
        <h3 style={{ fontFamily: fonts.display, fontSize: "14px", color: colors.mossDark, marginTop: 0 }}>Special locations</h3>
        <p style={{ fontSize: "13px", color: colors.inkSoft, marginTop: 0 }}>
          Fixed places a key can live besides a pitch, e.g. the sales keyring.
        </p>
        {specialLocations.map((s) => (
          <div key={s.id} style={{ fontSize: "13px", padding: "4px 0" }}>{s.label}</div>
        ))}
        <form onSubmit={handleAddLocation} style={{ marginTop: "8px" }}>
          <input
            type="text"
            required
            value={newLocationLabel}
            onChange={(e) => setNewLocationLabel(e.target.value)}
            placeholder="e.g. Sales keyring"
            style={fieldStyle}
          />
          <button type="submit" style={buttonStyle.primary}>Add location</button>
        </form>
      </div>
    </div>
  );
}
