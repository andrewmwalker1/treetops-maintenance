import { useEffect, useRef, useState } from "react";
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

const SEARCH_MAX_SUGGESTIONS = 50;

function highlightMatch(text, query) {
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <strong style={{ color: colors.mossDark }}>{text.slice(i, i + query.length)}</strong>
      {text.slice(i + query.length)}
    </>
  );
}

// The pitch codes already carry their area prefix (e.g. "YH-D6" is the
// full pitch_number_or_name, not "D6" with area stored separately), so a
// plain substring match against these already supports searching by area
// ("YH"), area + row ("YH-D"), or one exact pitch ("YH-D6") with no extra
// parsing needed -- what's here just surfaces suggestions as you type,
// same look as PitchPicker.jsx, but picking one only fills in the text
// (there's no single id to resolve to -- a prefix like "YH-D" is a valid,
// useful search all on its own, matching many tags at once).
function locationSuggestions(pitches, specialLocations, query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const pitchMatches = pitches.filter((p) => p.pitch_number_or_name.toLowerCase().includes(q)).map((p) => ({ key: `pitch:${p.id}`, label: p.pitch_number_or_name }));
  const specialMatches = specialLocations.filter((s) => s.label.toLowerCase().includes(q)).map((s) => ({ key: `special:${s.id}`, label: s.label }));
  return [...pitchMatches, ...specialMatches].slice(0, SEARCH_MAX_SUGGESTIONS);
}

// Replaces a plain text search box -- with 100-200+ tags, browsing the
// full list at once made the screen unmanageably long (Andy, 2026-08-25),
// so tags are now only ever shown in response to a search. This is that
// search box: type-ahead suggestions like PitchPicker.jsx, but `onChange`
// always receives the raw typed text (never clears on a partial match) --
// the parent filters its list off whatever's currently typed, suggestion
// picked or not.
function LocationSearchBox({ pitches, specialLocations, value, onChange, style }) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);

  const suggestions = locationSuggestions(pitches, specialLocations, value);

  function selectSuggestion(s) {
    onChange(s.label);
    setOpen(false);
  }

  function handleChange(e) {
    onChange(e.target.value);
    setOpen(true);
    setHighlightedIndex(0);
  }

  function handleKeyDown(e) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectSuggestion(suggestions[highlightedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    function handleDocClick(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    return () => document.removeEventListener("mousedown", handleDocClick);
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <input
        value={value}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Search by pitch, area, location, or tag ID…"
        style={style}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: "4px",
            maxHeight: "260px",
            overflowY: "auto",
            background: colors.paper,
            border: `1px solid ${colors.lineStrong}`,
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(27, 36, 48, 0.16)",
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.key}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectSuggestion(s)}
              onMouseEnter={() => setHighlightedIndex(i)}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                fontFamily: fonts.body,
                fontSize: "13px",
                color: colors.ink,
                background: i === highlightedIndex ? colors.line : "transparent",
              }}
            >
              {highlightMatch(s.label, value.trim())}
            </div>
          ))}
          {(pitches.length + specialLocations.length) > SEARCH_MAX_SUGGESTIONS && suggestions.length === SEARCH_MAX_SUGGESTIONS && (
            <div style={{ padding: "6px 12px", fontSize: "12px", color: colors.inkSoft, fontStyle: "italic" }}>
              Keep typing to narrow it down…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Shared by the "register a new tag" form and each row's "move" form --
// both need the same pitch-or-special-location choice NewJob.jsx already
// establishes for job locations (pitch vs. area), just with key_tags'
// two location columns instead.
function LocationPicker({ pitches, specialLocations, kind, setKind, pitchId, setPitchId, specialLocationId, setSpecialLocationId, autoFocus = false }) {
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
        <PitchPicker pitches={pitches} value={pitchId} onChange={setPitchId} style={fieldStyle} autoFocus={autoFocus} />
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

  // Lost tags are rare enough to just browse -- unlike "Allocated"/"Spare",
  // which are close to the whole list and are exactly the size problem a
  // search box exists to solve, so those still need a typed query.
  const visibleTags =
    !search.trim() && statusFilter !== "lost"
      ? []
      : keyTags.filter((tag) => {
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

      {/* Up here, not below the tag list, so scanning a tag doesn't mean
          scrolling past a long (100-200+) list to reach where you actually
          enter its location. */}
      <div style={{ ...cardStyle, padding: "16px", maxWidth: "440px", marginBottom: "20px" }}>
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
              autoFocus
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" style={buttonStyle.primary}>Save</button>
              <button type="button" onClick={() => setScannedUid(null)} style={buttonStyle.secondary}>Cancel</button>
            </div>
          </form>
        )}
      </div>

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
      <div style={{ maxWidth: "360px" }}>
        <LocationSearchBox pitches={pitches} specialLocations={specialLocations} value={search} onChange={setSearch} style={fieldStyle} />
      </div>

      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

      {keyTags.length === 0 && <p style={{ color: colors.inkSoft }}>No key tags registered yet.</p>}
      {keyTags.length > 0 && !search.trim() && statusFilter !== "lost" && (
        <p style={{ color: colors.inkSoft, fontSize: "13px" }}>Type a pitch, area, location, or tag ID above to see its key tags.</p>
      )}

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
      {search.trim() && visibleTags.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing matches this search.</p>}
      {!search.trim() && statusFilter === "lost" && keyTags.length > 0 && visibleTags.length === 0 && (
        <p style={{ color: colors.inkSoft }}>No tags are currently marked lost.</p>
      )}

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
