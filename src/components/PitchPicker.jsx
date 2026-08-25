import { useEffect, useRef, useState } from "react";
import { colors, fonts } from "../lib/theme.js";

// A searchable, keyboard-navigable dropdown for picking one pitch out of a
// (100-200+) list -- a plain <select> that long makes finding one tedious.
// Type to filter, arrow keys to move, Enter to pick -- one implementation
// shared by every screen that needs to pick a pitch, rather than a giant
// <select> duplicated in each one. Pitches are a fixed reference table (not
// something a user can type a new one into), so the input always resolves
// back to a real pitch id or nothing -- never a free-typed string.
const MAX_RESULTS = 50; // plenty to scroll through; keeps the DOM light with 200+ pitches

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

export default function PitchPicker({ pitches, value, onChange, placeholder = "Type to search…", style, autoFocus = false }) {
  const selected = pitches.find((p) => p.id === value);
  const [query, setQuery] = useState(selected?.pitch_number_or_name || "");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  // For screens where this appears right after a triggering action (e.g.
  // scanning an RFID tag) -- lets the user start typing the pitch straight
  // away instead of having to click into the box first.
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the visible text in sync when the selection changes from outside
  // (parent resets it, or switches which record is being edited) -- keyed
  // only on `value`, never on `pitches`/`selected` recomputing, or this
  // would fight the user's cursor on every keystroke.
  useEffect(() => {
    setQuery(selected?.pitch_number_or_name || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const matches = query.trim()
    ? pitches.filter((p) => p.pitch_number_or_name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, MAX_RESULTS)
    : pitches.slice(0, MAX_RESULTS);

  function selectPitch(p) {
    setQuery(p.pitch_number_or_name);
    setOpen(false);
    onChange(p.id);
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setOpen(true);
    setHighlightedIndex(0);
    // Only resolves to an id on an exact match -- otherwise this is a
    // partial, not-yet-a-real-pitch string, so the selection clears until
    // the user actually picks something.
    onChange("");
  }

  function handleKeyDown(e) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectPitch(matches[highlightedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(selected?.pitch_number_or_name || "");
    }
  }

  // Close on any click outside this component -- a real selection has
  // already been committed via selectPitch/onChange by then, so there's
  // nothing to lose by just dropping the open list.
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
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={style}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
      />
      {open && matches.length > 0 && (
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
          {matches.map((p, i) => (
            <div
              key={p.id}
              // Prevents the input from blurring on click at all, so the
              // dropdown never closes out from under the click before this
              // handler runs (the standard fix for the combobox blur race).
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectPitch(p)}
              onMouseEnter={() => setHighlightedIndex(i)}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                fontFamily: fonts.body,
                fontSize: style?.fontSize || "14px",
                color: colors.ink,
                background: i === highlightedIndex ? colors.line : "transparent",
              }}
            >
              {highlightMatch(p.pitch_number_or_name, query.trim())}
            </div>
          ))}
          {pitches.length > MAX_RESULTS && matches.length === MAX_RESULTS && (
            <div style={{ padding: "6px 12px", fontSize: "12px", color: colors.inkSoft, fontStyle: "italic" }}>
              Keep typing to narrow it down…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
