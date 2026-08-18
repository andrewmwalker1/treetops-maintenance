import { useEffect, useRef, useState } from "react";

// A visually-hidden, always-focused text input that catches HID
// keyboard-emulation scans from an RFID reader (it types the tag's UID
// then Enter, indistinguishable from someone typing on a real keyboard --
// which is exactly how this can be tested before hardware arrives).
// Used by both the kiosk sign-in screen and the office fob-registration
// admin tab (RfidTagsTab.jsx) -- one implementation, not two.
export default function RfidScanListener({ onScan, disabled = false }) {
  const inputRef = useRef(null);
  const [buffer, setBuffer] = useState("");

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled]);

  return (
    <input
      ref={inputRef}
      value={buffer}
      onChange={(e) => setBuffer(e.target.value)}
      onBlur={(e) => {
        // Re-grab focus after losing it to nowhere in particular (e.g. a
        // click on a plain <div>) so a scan right after page load still
        // works without the user having to click first -- but NOT after
        // losing it to another real input on the same screen (relatedTarget
        // is that element), or this fights the user for focus and blocks
        // them from typing anywhere else. First surfaced on KeyTagsTab.jsx,
        // the first screen to combine this with a real text field
        // elsewhere on the page -- RfidTagsTab.jsx's screen has none, so
        // the same bug was there unnoticed since this component shipped.
        if (!disabled && !e.relatedTarget) inputRef.current?.focus();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const uid = buffer.trim();
        setBuffer("");
        if (uid && !disabled) onScan(uid);
      }}
      disabled={disabled}
      aria-hidden="true"
      tabIndex={-1}
      autoComplete="off"
      style={{ position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" }}
    />
  );
}
