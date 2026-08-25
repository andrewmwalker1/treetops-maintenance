import { useEffect, useRef } from "react";

// RFID/barcode "keyboard wedge" readers act like an extremely fast typist:
// they emit a tag's UID as a burst of individual keydown events just a few
// ms apart, terminated by Enter. A real person never types that fast, so a
// scan can be told apart from normal typing by timing alone -- which means
// this can listen at the document level instead of needing a hidden
// focused <input>, and keeps working no matter what's focused on the page
// (a search box, a filter button, nothing at all).
//
// The previous version used a hidden always-focused <input> instead. That
// broke as soon as focus moved to any other control on the page and never
// came back -- e.g. KeyTagsTab.jsx's search box or its filter chips -- so
// a scan right after using either of those silently did nothing. First
// reported there (2026-08-25): the very first tag registered worked
// (fresh page load, hidden input still had default focus), the next one
// didn't (focus had since moved to a filter chip and nothing gave it
// back). This version doesn't depend on focus at all, so that whole class
// of bug can't recur.
const BURST_GAP_MS = 75; // max gap between keystrokes to still count as one scan
const MIN_SCAN_LENGTH = 4; // shortest plausible tag UID; filters out short fast human bursts

export default function RfidScanListener({ onScan, disabled = false }) {
  const bufferRef = useRef("");
  const lastKeyTimeRef = useRef(0);
  const burstRef = useRef(false); // true once the current run looks like a scan, not typing

  useEffect(() => {
    if (disabled) return;

    function handleKeyDown(e) {
      const now = performance.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const isScan = burstRef.current && bufferRef.current.length >= MIN_SCAN_LENGTH;
        if (isScan) e.preventDefault();
        const uid = bufferRef.current;
        bufferRef.current = "";
        burstRef.current = false;
        if (isScan) onScan(uid);
        return;
      }

      // Only single printable characters count towards a scan -- modifier
      // keys, arrows, Backspace, Tab etc. reset the buffer rather than
      // corrupting it, and are never interfered with.
      if (e.key.length !== 1) {
        bufferRef.current = "";
        burstRef.current = false;
        return;
      }

      if (gap < BURST_GAP_MS && bufferRef.current.length >= 1) {
        // Fast enough to be part of a scan burst. Once confident, stop the
        // keystroke reaching whatever's actually focused (e.g. a search
        // box) -- the first character of a burst still gets through since
        // there's no way to know it's a scan until the second one arrives
        // this fast.
        burstRef.current = true;
        e.preventDefault();
        bufferRef.current += e.key;
      } else {
        bufferRef.current = e.key;
        burstRef.current = false;
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [disabled, onScan]);

  return null;
}
