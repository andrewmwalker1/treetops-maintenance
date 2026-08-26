import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../lib/AuthContext.jsx";
import { supabase } from "../../lib/supabaseClient.js";
import RfidScanListener from "../../components/RfidScanListener.jsx";
import PitchPicker from "../../components/PitchPicker.jsx";
import { formatKeyLocation } from "../../keys/KeySelector.jsx";
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
  const pitchLabel = tag.pitch_id ? pitches.find((p) => p.id === tag.pitch_id)?.pitch_number_or_name || "Unknown pitch" : null;
  const specialLabel = tag.special_location_id ? specialLocations.find((s) => s.id === tag.special_location_id)?.label || "Unknown location" : null;
  return formatKeyLocation(pitchLabel, specialLabel, "Unallocated (spare)");
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

// Shared by the "register a new tag" form and each row's "move" form.
// Pitch and special location are independent fields (47-key-tags-pitch-
// persists-through-special-location.sql), not a pick-one choice: a key
// keeps its home pitch the whole time it's sitting at a special location
// (e.g. the caravan prep ring), so both are always editable together --
// clearing the special-location field alone is "moved back to the main
// cupboard".
function LocationPicker({ pitches, specialLocations, pitchId, setPitchId, specialLocationId, setSpecialLocationId, autoFocus = false }) {
  return (
    <>
      <label style={{ fontSize: "12px", color: colors.inkSoft, display: "block", marginBottom: "4px" }}>Home pitch</label>
      <PitchPicker pitches={pitches} value={pitchId} onChange={setPitchId} style={fieldStyle} autoFocus={autoFocus} />
      <label style={{ fontSize: "12px", color: colors.inkSoft, display: "block", marginBottom: "4px" }}>Currently at a special location</label>
      <select value={specialLocationId} onChange={(e) => setSpecialLocationId(e.target.value)} style={fieldStyle}>
        <option value="">— in the cupboard at its pitch —</option>
        {specialLocations.map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
    </>
  );
}

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "allocated", label: "Allocated" },
  { key: "spare", label: "Spare" },
  { key: "lost", label: "Lost" },
  { key: "handed_over", label: "Handed over" },
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
  const [assignPitchId, setAssignPitchId] = useState("");
  const [assignSpecialLocationId, setAssignSpecialLocationId] = useState("");

  const [movingTagId, setMovingTagId] = useState(null);
  const [movePitchId, setMovePitchId] = useState("");

  const [handingOverTagId, setHandingOverTagId] = useState(null);
  const [handoverTo, setHandoverTo] = useState("");
  const [handoverNotes, setHandoverNotes] = useState("");
  const [handoverFobConfirmed, setHandoverFobConfirmed] = useState(false);

  const [newLocationLabel, setNewLocationLabel] = useState("");

  function refresh() {
    if (!org || !activeSite) return;
    Promise.all([
      supabase
        .from("key_tags")
        .select("id, tag_uid, pitch_id, special_location_id, status, handed_over_at, handed_over_to, handed_over_notes, created_at")
        .eq("site_id", activeSite.id)
        .order("created_at"),
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

  // Restricted to locations that actually have a tag -- suggesting from the
  // full pitches/specialLocations reference tables (as LocationPicker does,
  // correctly, when registering a brand new tag) meant the search could
  // suggest a real pitch with no tag at all yet, which then "found" it in
  // the dropdown but showed nothing below -- confusing, since typing the
  // exact same text without picking the suggestion looked identical.
  // 79 of 206 pitches currently have a tag (2026-08-25), so this isn't rare.
  const pitchIdsWithTags = new Set(keyTags.map((t) => t.pitch_id).filter(Boolean));
  const specialLocationIdsWithTags = new Set(keyTags.map((t) => t.special_location_id).filter(Boolean));
  const searchablePitches = pitches.filter((p) => pitchIdsWithTags.has(p.id));
  const searchableSpecialLocations = specialLocations.filter((s) => specialLocationIdsWithTags.has(s.id));

  // Lost and handed-over tags are rare enough to just browse -- unlike
  // "Allocated"/"Spare", which are close to the whole list and are exactly
  // the size problem a search box exists to solve, so those still need a
  // typed query.
  const visibleTags =
    !search.trim() && statusFilter !== "lost" && statusFilter !== "handed_over"
      ? []
      : keyTags.filter((tag) => {
          if (statusFilter === "lost" && tag.status !== "lost") return false;
          if (statusFilter === "handed_over" && tag.status !== "handed_over") return false;
          if (statusFilter === "allocated" && (tag.status !== "active" || !(tag.pitch_id || tag.special_location_id))) return false;
          if (statusFilter === "spare" && (tag.status !== "active" || tag.pitch_id || tag.special_location_id)) return false;
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

  // The RFID fob itself gets recovered before a handed-over key's physical
  // blank leaves the building (see startHandover/handleHandover below), so
  // the same fob can end up back in service on a different pitch's key
  // later -- a plain status flip back to 'active' (no side effect to
  // undo, unlike the handover itself), same shape as handleReinstate.
  async function handleReturnToPool(tag) {
    const proceed = window.confirm(
      `Put this tag back into service? It'll show as an active key for ${locationLabel(tag, pitches, specialLocations)} again -- only do this if the RFID fob has actually been recovered and is being reused.`
    );
    if (!proceed) return;
    const { error: err } = await supabase
      .from("key_tags")
      .update({ status: "active", handed_over_at: null, handed_over_to: null, handed_over_notes: null })
      .eq("id", tag.id);
    if (err) setError(err.message);
    else refresh();
  }

  // Physical key tags carry no visible number -- an RFID scan is the only
  // way to know which key_tags row a key in your hand actually is. A new
  // (unregistered) UID opens "Register a new tag" as before; a UID that's
  // already on file jumps straight to that row's Move form instead of
  // erroring, since that's exactly the case Andy needs for fixing up keys
  // sitting in a special location with no home pitch attached yet --
  // scan the key, its row appears already selected for editing. The
  // search box is set to the tag's own UID (unique) so that row is the
  // only one showing, regardless of what was typed/filtered before.
  //
  // A fob recovered from a lost or handed-over key keeps its tag_uid, so
  // reusing it on a new key later means scanning that *same* UID again --
  // it'll never hit "Register a new tag" (the row already exists) and,
  // without this, Move alone would leave status stuck on 'lost'/
  // 'handed_over' forever, invisibly excluding it from every checkout/
  // relocate/find-a-key picker even once it's back in daily use. Scanning
  // it is exactly the signal that it's physically in hand again, so this
  // reactivates it (after confirming) as part of the same scan, then
  // opens Move so the new pitch can be picked straight away.
  async function handleScan(uid) {
    setError(null);
    const existing = keyTags.find((t) => t.tag_uid === uid);
    if (existing) {
      if (existing.status !== "active") {
        const reason = existing.status === "lost" ? "marked lost" : "handed over";
        const proceed = window.confirm(
          `This tag was ${reason} (for ${locationLabel(existing, pitches, specialLocations)}). Scanning it now puts it back into service so you can move it to its new pitch — continue?`
        );
        if (!proceed) return;
        const { error: err } = await supabase
          .from("key_tags")
          .update({ status: "active", lost_at: null, lost_notes: null, handed_over_at: null, handed_over_to: null, handed_over_notes: null })
          .eq("id", existing.id);
        if (err) {
          setError(err.message);
          return;
        }
        refresh();
      }
      setStatusFilter("all");
      setSearch(existing.tag_uid);
      startMove({ ...existing, status: "active" });
      setScannedUid(null);
      return;
    }
    setScannedUid(uid);
    setAssignPitchId("");
    setAssignSpecialLocationId("");
  }

  async function handleAssign(e) {
    e.preventDefault();
    if (!scannedUid) return;
    const { error: err } = await supabase.from("key_tags").insert({
      org_id: org.id,
      site_id: activeSite.id,
      tag_uid: scannedUid,
      pitch_id: assignPitchId || null,
      special_location_id: assignSpecialLocationId || null,
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
    setMovePitchId(tag.pitch_id || "");
  }

  // Move is specifically "this key belongs to a different pitch now" --
  // Andy: it happens because a caravan physically moved pitches, or
  // because staff are correcting a mistaken pitch, never because the key
  // itself is being carried somewhere else. So it only ever touches
  // pitch_id; special_location_id is left exactly as it was (moving a
  // key's physical location, e.g. into the prep ring, is Relocate's job).
  // A pitch usually has more than one key (the original design allows
  // several rows per pitch_id for exactly this), so moving just the one
  // row you happened to click would leave a duplicate still pointing at
  // the old pitch -- every other active key currently on the same origin
  // pitch, wherever it's physically sitting, is offered the same move.
  async function handleMove(e) {
    e.preventDefault();
    const tag = keyTags.find((t) => t.id === movingTagId);
    if (!tag) return;
    if (!movePitchId) {
      setError("Pick a pitch from the list before saving.");
      return;
    }
    if (openTagIds.has(tag.id)) {
      const proceed = window.confirm(
        "This key is currently checked out. Moving it only changes which pitch it belongs to — it won't check it in or affect the open checkout. Continue?"
      );
      if (!proceed) return;
    }

    const oldPitchId = tag.pitch_id;
    const siblingIds =
      oldPitchId && oldPitchId !== movePitchId
        ? keyTags.filter((t) => t.id !== tag.id && t.pitch_id === oldPitchId && t.status === "active").map((t) => t.id)
        : [];

    if (siblingIds.length > 0) {
      const proceed = window.confirm(
        `${siblingIds.length} other key${siblingIds.length > 1 ? "s" : ""} also belong${siblingIds.length > 1 ? "" : "s"} to this pitch. Move ` +
          `${siblingIds.length > 1 ? "them" : "it"} to the new pitch too? Each one stays exactly where it's physically sitting -- only the pitch ` +
          `changes. Press Cancel to move only this one key.`
      );
      if (proceed) {
        const { error: err } = await supabase.from("key_tags").update({ pitch_id: movePitchId }).in("id", [tag.id, ...siblingIds]);
        if (err) {
          setError(err.message);
          return;
        }
        setMovingTagId(null);
        refresh();
        return;
      }
    }

    const { error: err } = await supabase.from("key_tags").update({ pitch_id: movePitchId }).eq("id", tag.id);
    if (err) {
      setError(err.message);
      return;
    }
    setMovingTagId(null);
    refresh();
  }

  function startHandover(tag) {
    setHandingOverTagId(tag.id);
    setHandoverTo("");
    setHandoverNotes("");
    setHandoverFobConfirmed(false);
  }

  // Goes through handover_key_tag (48-key-tags-handover.sql) rather than a
  // plain update -- it force-closes any open checkout on this tag in the
  // same transaction, which a client-side update can't do. The fob
  // checkbox is a reminder, not data the server checks: the only way this
  // system knows about a physical key is via its RFID tag, so if the fob
  // travels with the key to the customer, the tag itself effectively
  // leaves too and can never be reused on a future key.
  async function handleHandover(e) {
    e.preventDefault();
    if (!handoverTo.trim() || !handoverFobConfirmed) return;
    const { error: err } = await supabase.rpc("handover_key_tag", {
      p_key_tag_id: handingOverTagId,
      p_handed_over_to: handoverTo.trim(),
      p_notes: handoverNotes.trim() || null,
    });
    if (err) {
      setError(err.message);
      return;
    }
    setHandingOverTagId(null);
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
        Scan a tag to register a new one, or to jump straight to an existing tag's own Move form below (physical keys carry no visible number, so
        scanning is the only reliable way to find the right row). Multiple tags can share the same pitch (a caravan with more than one key).
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
        <LocationSearchBox pitches={searchablePitches} specialLocations={searchableSpecialLocations} value={search} onChange={setSearch} style={fieldStyle} />
      </div>

      {error && <p style={{ color: colors.immediate, fontSize: "13px" }}>{error}</p>}

      {keyTags.length === 0 && <p style={{ color: colors.inkSoft }}>No key tags registered yet.</p>}
      {keyTags.length > 0 && !search.trim() && statusFilter !== "lost" && statusFilter !== "handed_over" && (
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
                {tag.status === "handed_over" && (
                  <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: "#FFFFFF", background: colors.mossDark, borderRadius: "999px", padding: "2px 10px" }}>
                    HANDED OVER
                  </span>
                )}
                {openTagIds.has(tag.id) && (
                  <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, color: colors.mossDark, background: colors.line, borderRadius: "999px", padding: "2px 10px" }}>
                    CHECKED OUT
                  </span>
                )}
              </div>
              <div style={{ fontSize: "12px", color: colors.inkSoft, fontFamily: fonts.mono }}>{tag.tag_uid}</div>
              {tag.status === "handed_over" && (
                <div style={{ fontSize: "12px", color: colors.inkSoft, marginTop: "4px" }}>
                  To {tag.handed_over_to} on {new Date(tag.handed_over_at).toLocaleDateString("en-GB")}
                  {tag.handed_over_notes ? ` — ${tag.handed_over_notes}` : ""}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              {tag.status === "lost" && <button onClick={() => handleReinstate(tag)} style={buttonStyle.secondary}>Reinstate</button>}
              {tag.status === "handed_over" && <button onClick={() => handleReturnToPool(tag)} style={buttonStyle.secondary}>Return to pool</button>}
              {tag.status === "active" && (
                <>
                  <button onClick={() => startMove(tag)} style={buttonStyle.secondary}>Move</button>
                  {tag.pitch_id && <button onClick={() => startHandover(tag)} style={buttonStyle.secondary}>Handover</button>}
                  <button onClick={() => handleRemove(tag)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Remove</button>
                  <button onClick={() => handleMarkLost(tag)} style={{ ...buttonStyle.secondary, color: colors.immediate }}>Mark as lost</button>
                </>
              )}
            </div>
          </div>
          {movingTagId === tag.id && (
            <form onSubmit={handleMove} style={{ marginTop: "12px", borderTop: `1px solid ${colors.lineStrong}`, paddingTop: "12px" }}>
              <p style={{ fontSize: "12px", color: colors.inkSoft, marginTop: 0, marginBottom: "8px" }}>
                Currently at: {tag.special_location_id ? specialLocations.find((s) => s.id === tag.special_location_id)?.label || "Unknown location" : "the cupboard"}.
                Moving only changes which pitch this key belongs to — it stays exactly where it's physically sitting. To move it somewhere else
                physically, use Relocate instead.
              </p>
              <label style={{ fontSize: "12px", color: colors.inkSoft, display: "block", marginBottom: "4px" }}>New pitch</label>
              <PitchPicker pitches={pitches} value={movePitchId} onChange={setMovePitchId} style={fieldStyle} autoFocus />
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" style={buttonStyle.primary}>Save</button>
                <button type="button" onClick={() => setMovingTagId(null)} style={buttonStyle.secondary}>Cancel</button>
              </div>
            </form>
          )}
          {handingOverTagId === tag.id && (
            <form onSubmit={handleHandover} style={{ marginTop: "12px", borderTop: `1px solid ${colors.lineStrong}`, paddingTop: "12px" }}>
              <p style={{ fontSize: "13px", marginTop: 0 }}>
                This key is leaving for good, to the new owner of {locationLabel(tag, pitches, specialLocations)} — it'll drop off every
                checkout/relocate screen and won't come back into the cupboard.
              </p>
              {openTagIds.has(tag.id) && (
                <p style={{ fontSize: "13px", color: colors.inkSoft }}>
                  This key is currently checked out — completing the handover will automatically check it back in, since it's not coming back.
                </p>
              )}
              <label style={{ fontSize: "12px", color: colors.inkSoft, display: "block", marginBottom: "4px" }}>Handed over to</label>
              <input
                type="text"
                required
                autoFocus
                value={handoverTo}
                onChange={(e) => setHandoverTo(e.target.value)}
                placeholder="Customer name"
                style={fieldStyle}
              />
              <label style={{ fontSize: "12px", color: colors.inkSoft, display: "block", marginBottom: "4px" }}>Notes (optional)</label>
              <textarea
                value={handoverNotes}
                onChange={(e) => setHandoverNotes(e.target.value)}
                rows={2}
                style={{ ...fieldStyle, resize: "vertical" }}
              />
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  fontSize: "13px",
                  padding: "10px 12px",
                  marginBottom: "12px",
                  borderRadius: "8px",
                  border: `1px solid ${colors.gold}`,
                  background: colors.paper,
                }}
              >
                <input
                  type="checkbox"
                  checked={handoverFobConfirmed}
                  onChange={(e) => setHandoverFobConfirmed(e.target.checked)}
                  style={{ marginTop: "2px" }}
                />
                I've removed the RFID fob from this key — only the physical key goes to the customer, the fob stays with us.
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="submit" style={{ ...buttonStyle.primary, opacity: handoverTo.trim() && handoverFobConfirmed ? 1 : 0.5 }} disabled={!handoverTo.trim() || !handoverFobConfirmed}>
                  Complete handover
                </button>
                <button type="button" onClick={() => setHandingOverTagId(null)} style={buttonStyle.secondary}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      ))}
      {search.trim() && visibleTags.length === 0 && <p style={{ color: colors.inkSoft }}>Nothing matches this search.</p>}
      {!search.trim() && statusFilter === "lost" && keyTags.length > 0 && visibleTags.length === 0 && (
        <p style={{ color: colors.inkSoft }}>No tags are currently marked lost.</p>
      )}
      {!search.trim() && statusFilter === "handed_over" && keyTags.length > 0 && visibleTags.length === 0 && (
        <p style={{ color: colors.inkSoft }}>No tags have been handed over.</p>
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
