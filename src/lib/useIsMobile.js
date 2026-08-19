import { useEffect, useState } from "react";

// A phone's longest side, in CSS px, regardless of which way it's held --
// screen.width/height individually swap on rotation, but the larger of
// the two doesn't. The biggest current phones (iPhone 14 Pro Max: 932,
// Galaxy S23 Ultra: ~915) sit well under this; the smallest common
// tablets (iPad Mini: 1133) sit well over it, so there's a clean gap to
// draw the line in.
const PHONE_MAX_DIMENSION = 1000;

// Andy: turning his iPhone 14 Pro Max sideways (932x430 in landscape)
// used to fall back to the desktop layout, because the old check
// (matchMedia("(max-width: 640px)")) only ever looked at the current
// viewport width -- which is exactly what rotates out from under it. The
// device itself hasn't changed, so this now asks "is the screen this
// device actually has small enough to be a phone" instead of "is the
// window narrow right now" -- a phone stays the mobile layout in either
// orientation; a desktop browser window resized narrow stays the desktop
// layout, since its screen is still a full monitor regardless of how
// small the window's been dragged.
function detectIsPhoneDevice() {
  if (typeof window === "undefined" || !window.screen) return false;
  return Math.max(window.screen.width, window.screen.height) <= PHONE_MAX_DIMENSION;
}

// No CSS stylesheet/media-queries anywhere in this codebase -- every
// other responsive decision already lives in JS/JSX (styles are plain
// objects throughout), so this keeps that pattern rather than
// introducing a stylesheet just to collapse a couple of header/filter
// elements on phone screens.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(detectIsPhoneDevice);
  useEffect(() => {
    // The device's own screen size can't change mid-session, but this
    // still re-checks on rotation/resize (rather than computing once and
    // never again) as a cheap safety net -- e.g. a browser window dragged
    // across monitors of different resolutions.
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
