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

// No CSS stylesheet/media-queries anywhere in this codebase -- every
// other responsive decision already lives in JS/JSX (styles are plain
// objects throughout), so this keeps that pattern rather than
// introducing a stylesheet just to collapse a couple of header/filter
// elements on phone screens.
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
