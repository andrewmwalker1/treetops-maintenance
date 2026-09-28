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
export function detectIsPhoneDevice() {
  if (typeof window === "undefined") return false;
  return Math.max(window.innerWidth, window.innerHeight) <= PHONE_MAX_DIMENSION;
}

// Andy (2026-09-28): iPads should get the phone layout -- bottom tab bar,
// collapsible admin groups -- not the desktop sidebar, unless the person
// asks for the desktop layout. They're held in the hand and prodded with a
// finger like a phone, just bigger.
//
// Width alone can't tell an iPad from a laptop (an iPad Pro is 1366 wide),
// and since iPadOS 13 Safari identifies itself as a Mac by default, so the
// user agent alone can't either. Any one of these is enough:
//   - an older iPad, or Safari set to "Request Mobile Website", says iPad;
//   - an iPad masquerading as a Mac still reports touch points, which no
//     real Mac does;
//   - any device whose main pointer is a finger with no hover (Android
//     tablets) matches the media query. A touchscreen laptop doesn't: its
//     primary pointer is still the trackpad/mouse.
// The kiosk and key-station terminals are touch screens too, but they
// render their own full-screen apps and never read this hook.
export function detectIsTabletDevice() {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad/.test(ua)) return true;
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) return true;
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

// "Request desktop site" for this app. Safari's own toggle can't be used
// for it: on an iPad, Safari *already* requests the desktop site by
// default, so the two states are indistinguishable from here. Per device,
// so it lives in localStorage rather than on the profile -- someone may
// want the desktop layout on the office iPad but not on their own. Only
// offered on a tablet; a phone is too narrow for the sidebar layout.
const DESKTOP_LAYOUT_KEY = "tt.tabletUsesDesktopLayout";
const LAYOUT_CHANGE_EVENT = "tt-layout-preference-change";

export function getTabletUsesDesktopLayout() {
  try {
    return window.localStorage.getItem(DESKTOP_LAYOUT_KEY) === "1";
  } catch {
    return false;
  }
}

export function setTabletUsesDesktopLayout(on) {
  try {
    if (on) window.localStorage.setItem(DESKTOP_LAYOUT_KEY, "1");
    else window.localStorage.removeItem(DESKTOP_LAYOUT_KEY);
  } catch {
    // Private mode / blocked storage: the choice just won't stick.
  }
  window.dispatchEvent(new Event(LAYOUT_CHANGE_EVENT));
}

function detectIsMobile() {
  if (detectIsPhoneDevice()) return true;
  return detectIsTabletDevice() && !getTabletUsesDesktopLayout();
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
// or tablet (Layout's bottom tab bar vs the desktop sidebar, Admin's collapsible
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
  const [isMobile, setIsMobile] = useState(detectIsMobile);
  useEffect(() => {
    function handler() {
      setIsMobile(detectIsMobile());
    }
    window.addEventListener("resize", handler);
    window.addEventListener("orientationchange", handler);
    window.addEventListener(LAYOUT_CHANGE_EVENT, handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("orientationchange", handler);
      window.removeEventListener(LAYOUT_CHANGE_EVENT, handler);
    };
  }, []);
  return isMobile;
}
