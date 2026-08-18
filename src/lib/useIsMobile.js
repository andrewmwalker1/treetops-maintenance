import { useEffect, useState } from "react";

const QUERY = "(max-width: 640px)";

// No CSS stylesheet/media-queries anywhere in this codebase -- every
// other responsive decision already lives in JS/JSX (styles are plain
// objects throughout), so this keeps that pattern rather than
// introducing a stylesheet just to collapse a couple of header/filter
// elements on narrow screens.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}
