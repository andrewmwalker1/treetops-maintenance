// A small hand-rolled icon set. Deliberately not a dependency: the app has
// ten of those and should keep it that way, and this is a couple of dozen
// paths.
//
// All icons are stroke-based on a 24x24 grid and inherit `currentColor`, so
// they take the colour of whatever they sit inside (a nav link, a button, a
// disabled control) with no extra wiring.
//
// NOT for job priority -- that stays a solid colour bar. An icon-based
// priority indicator was explicitly rejected (BUILD-BRIEF.md section 8).

function Svg({ size = 16, children, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---- Navigation ---- */
export const IconOverview = (p) => (
  <Svg {...p}>
    <path d="M12 20a8 8 0 10-8-8" />
    <path d="M4 20h16" />
    <path d="M12 14l4-4" />
  </Svg>
);
export const IconJobs = (p) => (
  <Svg {...p}>
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
  </Svg>
);
export const IconEquipment = (p) => (
  <Svg {...p}>
    <path d="M14.7 6.3a4 4 0 105.4 5.4l-9.4 9.4a2 2 0 01-2.8 0l-2.6-2.6a2 2 0 010-2.8z" />
    <path d="M6 6l2 2" />
  </Svg>
);
export const IconKeys = (p) => (
  <Svg {...p}>
    <path d="M7 11a5 5 0 115 5H9v3H6v3H2v-4l6.6-6.6A5 5 0 017 11z" />
    <path d="M16.5 7.5h.01" />
  </Svg>
);
export const IconMeters = (p) => (
  <Svg {...p}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-5 3 3 5-7" />
  </Svg>
);
export const IconSafety = (p) => (
  <Svg {...p}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);
export const IconSettings = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 8.9a1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
  </Svg>
);

/* ---- Actions ---- */
export const IconPlus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M18 6L6 18M6 6l12 12" />
  </Svg>
);
export const IconMenu = (p) => (
  <Svg {...p}>
    <path d="M3 6h18M3 12h18M3 18h18" />
  </Svg>
);
export const IconChevronDown = (p) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const IconChevronRight = (p) => (
  <Svg {...p}>
    <path d="M9 18l6-6-6-6" />
  </Svg>
);
export const IconArrowLeft = (p) => (
  <Svg {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Svg>
);
export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3" />
  </Svg>
);
export const IconFilter = (p) => (
  <Svg {...p}>
    <path d="M3 5h18l-7 8v6l-4 2v-8z" />
  </Svg>
);
export const IconEdit = (p) => (
  <Svg {...p}>
    <path d="M11 4H5a2 2 0 00-2 2v13a2 2 0 002 2h13a2 2 0 002-2v-6" />
    <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" />
  </Svg>
);
export const IconPrint = (p) => (
  <Svg {...p}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <path d="M6 14h12v8H6z" />
  </Svg>
);
export const IconUser = (p) => (
  <Svg {...p}>
    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </Svg>
);

/* ---- Status ---- */
export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Svg>
);
export const IconInfo = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </Svg>
);
export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="M20 6L9 17l-5-5" />
  </Svg>
);
export const IconOffline = (p) => (
  <Svg {...p}>
    <path d="M1 1l22 22" />
    <path d="M16.7 13.3A6 6 0 008 8.3" />
    <path d="M5 12.5a10 10 0 013-2.2" />
    <path d="M12 20h.01" />
  </Svg>
);
export const IconSync = (p) => (
  <Svg {...p}>
    <path d="M21 12a9 9 0 01-9 9 9 9 0 01-7.6-4.2" />
    <path d="M3 12a9 9 0 019-9 9 9 0 017.6 4.2" />
    <path d="M21 3v5h-5M3 21v-5h5" />
  </Svg>
);
export const IconInbox = (p) => (
  <Svg {...p}>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5.1L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.5-6.9A2 2 0 0016.8 4H7.2a2 2 0 00-1.7 1.1z" />
  </Svg>
);
