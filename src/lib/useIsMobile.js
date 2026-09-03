import { useEffect, useState } from "react";

// A phone's longest side, in CSS px, regardless of which way it's held.
// The biggest current phones (iPhone 14 Pro Max: 932, Galaxy S23 Ultra:
// ~915) sit well under this; the smallest common tablets (iPad Mini:
// ~1050 with browser chrome subtracted) sit at or above it, so there's a
// workable gap to draw the line in.
const PHONE_MAX_DIMENSION = 1000;

// Andy: turning his iPhone 14 Pro Max sideways used to fall back to the
// desktop layout, because the original check (matchMedia("(max-width:
// 640px)")) only ever looked at the current viewport WIDTH -- exactly
// what swaps with innerHeight on rotation. The first fix here tried
// window.screen.width/height instead (reasoning: screen dimensions don't
// rotate the way viewport ones do) -- wrong call: those two are
// unreliable across iOS Safari/WKWebView versions and standalone-PWA
// mode specifically (Andy runs this from a home-screen shortcut), and in
// his case just came back oversized, misclassifying the phone as desktop
// in BOTH orientations, not just landscape.
//
// This still solves the same problem (a phone should read as "mobile" in
// either orientation) but by taking the max of the two viewport
// dimensions that DO reliably swap on rotation on every browser --
// window.innerWidth/innerHeight, the same metric the original working
// portrait-only check was already built on. Landscape: innerWidth is the
// long side. Portrait: innerHeight is. Either way the max lands in
// roughly the same place, so which orientation you're holding it in
// stops mattering.
function detectIsPhoneDevice() {
  if (typeof window === "undefined") return false;
  return Math.max(window.innerWidth, window.innerHeight) <= PHONE_MAX_DIMENSION;
}

// This used to be the app's ONLY responsive mechanism, back when there was
// no stylesheet at all. There is one now (src/styles/), so prefer a plain
// CSS media query for anything that is purely a layout or sizing decision
// -- and prefer `@media (pointer: coarse)` over this hook for touch-target
// sizing specifically, since the wall-mounted kiosk and key-station screens
// are touch devices that this width check classifies as desktop.
//
// This hook remains the right tool for the cases CSS genuinely cannot
// reach: rendering a structurally *different* component tree on a phone
// (Layout's bottom tab bar vs the desktop nav row, Admin's collapsible
// group list vs its sidebar) rather than restyling the same one.
// For the cases where the deciding factor is the viewport width itself
// rather than "is this a phone" -- the permission matrices, which stop
// working as a grid somewhere around 900px on a half-width desktop window
// just as surely as they do on a phone.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => (typeof window === "undefined" ? false : window.matchMedia(query).matches));
  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);
  return matches;
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(detectIsPhoneDevice);
  useEffect(() => {
    function handler() {
      setIsMobile(detectIsPhoneDevice());
    }
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
    };
  }, []);
  return isMobile;
}
