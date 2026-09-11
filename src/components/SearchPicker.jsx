import { useEffect, useRef, useState } from "react";
import { colors, fonts, radius, shadow } from "../lib/theme.js";

// A generic searchable, keyboard-navigable combobox for picking one item out
// of a longer list than a plain <select> is comfortable with (type to
// filter, arrow keys to move, Enter to pick). The one picker used
// throughout the app for every "pick 1 of many" field -- pitches, job
// templates, and anything else that would otherwise be a giant <select>.
const MAX_RESULTS = 50;

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

export default function SearchPicker({
  items,
  getId = (item) => item.id,
  getLabel = (item) => item.name,
  value,
  onChange,
  placeholder = "Type to search…",
  ariaLabel,
  id,
  style,
  autoFocus = false,
}) {
  const selected = items.find((item) => getId(item) === value);
  const [query, setQuery] = useState(selected ? getLabel(selected) : "");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the visible text in sync when the selection changes from outside
  // (parent resets it, or a "recent" chip sets it directly) -- keyed only on
  // `value`, never on `items`/`selected` recomputing, or this would fight
  // the user's cursor on every keystroke.
  useEffect(() => {
    const match = items.find((item) => getId(item) === value);
    setQuery(match ? getLabel(match) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const matches = query.trim()
    ? items.filter((item) => getLabel(item).toLowerCase().includes(query.trim().toLowerCase())).slice(0, MAX_RESULTS)
    : items.slice(0, MAX_RESULTS);

  function selectItem(item) {
    setQuery(getLabel(item));
    setOpen(false);
    onChange(getId(item));
  }

  function handleChange(e) {
    setQuery(e.target.value);
    setOpen(true);
    setHighlightedIndex(0);
    // Only resolves to an id on an exact match -- otherwise this is a
    // partial, not-yet-a-real-selection string, so the selection clears
    // until the user actually picks something.
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
      selectItem(matches[highlightedIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(selected ? getLabel(selected) : "");
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
        id={id}
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="tt-input"
        style={style}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-label={ariaLabel}
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            zIndex: 20,
            marginTop: "var(--space-1)",
            maxHeight: "var(--scrollbox-max-h)",
            overflowY: "auto",
            background: colors.paper,
            border: `1px solid ${colors.lineStrong}`,
            borderRadius: radius.sm,
            boxShadow: shadow.overlay,
          }}
        >
          {matches.map((item, i) => (
            <div
              key={getId(item)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setHighlightedIndex(i)}
              style={{
                padding: "var(--space-3) var(--space-3)",
                cursor: "pointer",
                fontFamily: fonts.body,
                fontSize: style?.fontSize || "var(--text-base)",
                color: colors.ink,
                background: i === highlightedIndex ? colors.line : "transparent",
              }}
            >
              {highlightMatch(getLabel(item), query.trim())}
            </div>
          ))}
          {items.length > MAX_RESULTS && matches.length === MAX_RESULTS && (
            <div style={{ padding: "var(--space-2) var(--space-3)", fontSize: "var(--text-xs)", color: colors.inkSoft, fontStyle: "italic" }}>
              Keep typing to narrow it down…
            </div>
          )}
        </div>
      )}
    </div>
  );
}
