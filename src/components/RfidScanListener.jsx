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
      onBlur={() => {
        if (!disabled) inputRef.current?.focus();
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
