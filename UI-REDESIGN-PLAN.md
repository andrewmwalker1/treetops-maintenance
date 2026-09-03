# UI Redesign Plan — Tree Tops Maintenance

**Status:** Phases 1–3 applied on branch `ui-redesign-phases-1-3` (not merged,
not deployed). Phases 4–6 outstanding. Written 2026-09-03 against `560c3e9`.
**Purpose:** a work order Claude can pick up and apply phase by phase. Each
phase is self-contained, ends in a commit, and leaves the app shippable.

Read alongside `BUILD-BRIEF.md` §8 (visual design) and `CLAUDE.md`.

---

## 1. Method

Reviewed the whole `src/` tree (118 files, ~16,250 lines of JSX) plus
`index.html`, `vite.config.js` and `BUILD-BRIEF.md`, and ran the dev
server to check the rendered result. Findings below are counts from the
actual codebase, not impressions.

---

## 2. Findings

### 2.1 There is no stylesheet — at all

Zero `.css` files. Every style in the app is an inline `style={{}}`
object: **1,425** of them. The consequences are the main reason the app
reads as flat and unfinished:

| Thing | Count in codebase |
|---|---|
| `:hover` rules | **0** |
| `:focus` / `:focus-visible` rules | **0** |
| `transition` declarations | 2 |
| `@media` queries | 1 |
| `box-shadow` declarations | 4 |

Nothing in the app responds to a mouse or a keyboard. Buttons don't
light up, cards don't lift, links don't change, and there is no focus
ring anywhere — which is both the "not sharp/modern" feeling and a real
accessibility gap. Inline styles physically cannot express `:hover`, so
this is not fixable screen by screen; it needs a stylesheet.

Responsiveness runs entirely through `useIsMobile()` — one JS boolean at
a **1000px** cut. So every layout choice is binary (phone or not), there
is no tablet or wide-desktop tier, and a 1400px monitor gets the same
layout as a 1024px laptop. `src/lib/useIsMobile.js` documents "no CSS
stylesheet/media-queries anywhere in this codebase" as a deliberate
choice; **this plan reverses that decision** — see §3.

### 2.2 The palette has drifted out of sync in four places

`src/lib/theme.js` was swapped from the original warm "Field Journal"
palette to the "Admiralty" navy one. Four places still carry the old
colours:

| Location | Value | Should be |
|---|---|---|
| `vite.config.js:42-43` (PWA manifest) | `background_color: #E7E2CC`, `theme_color: #3F5837` | navy equivalents |
| `index.html` `<meta name="theme-color">` | `#3F5837` | `#142840` |
| Modal overlay, **8 files** | `rgba(49, 56, 45, 0.5)` (old moss ink) | navy-ink token |
| Warning/alert panels | `#FBF3E3` (×3), `#F5E9E8` (×1) | warning/danger surface tokens |

Net effect: **the installed PWA's splash screen and phone status bar are
a different colour scheme from the app itself.** That is visible to every
user who added it to their home screen.

`BUILD-BRIEF.md` §8 also still documents the *old* palette and instructs
"Reproduce these tokens exactly" — so the spec and the code disagree, and
anything built from the brief will drift again.

### 2.3 There is no scale — nothing lines up

| Property | Distinct values in use |
|---|---|
| `fontSize` | **16** (including `12.5px`) |
| `borderRadius` | 7 (`6/8/10/12/14/50%/999px`) |
| `padding` | ~30 distinct pairs |
| `gap` | 9 |
| `marginBottom` | 11 |

Nothing derives from a scale, so nothing aligns to a common rhythm. This
is what makes it feel "not sharp" even where individual screens are fine.

### 2.4 There are almost no shared primitives

| Element | Raw usages | Files using a shared style |
|---|---|---|
| `<button>` | 305 | 41 use `buttonStyle` |
| `<input>` | 162 | `fieldStyle` re-declared locally in **28 files** |
| `<select>` | 47 | — |
| Modal | 8 files hand-roll the overlay markup | only **4** import `Modal.jsx` |
| `<h1>` | 73, across **10 different style objects** | no `PageHeader` |
| `<table>` | 9 files, each with its own markup | no `Table` |

`Modal.jsx` exists and is good — it's just ignored by most of the code
that needs it. Same story for `buttonStyle`/`cardStyle`.

### 2.5 The menus — five different navigation idioms

This is the specific complaint, and it's accurate. The app currently has
five unrelated ways to navigate:

1. **Desktop top bar** — a flat row of 7 `NavLink`s with an underline
   active state (`Layout.jsx`).
2. **Mobile ☰ dropdown** — same 7 items in a `position: fixed` panel
   (`NavMenu`).
3. **Admin sidebar** — 20 tabs in 4 groups, rendered as `<button>`s
   (`Admin.jsx`).
4. **Hub pages** — `KeysHome` and `MeterReadingHome`: a stack of
   full-width pill buttons, two "primary" then several "secondary",
   with an all-caps "Admin" text divider.
5. **Kiosk / key station** — a 2-column grid of big buttons
   (`KioskMenu`, `KeyStationMenu`), using a separate `kioskTheme.js`.

Specific problems:

- **The 7 top-level items aren't peers.** Jobs, Equipment, Dashboard,
  Safety, Meter Reading, Keys, Admin sit at the same level, but Dashboard
  is an overview *of* Jobs, Safety is a read-only library, Meter Reading
  and Keys are whole sub-apps with their own hub pages, and Admin is
  settings. They compete for the same visual weight.
- **Admin tabs aren't routes.** `activeTab` is `useState`, so you cannot
  link to, bookmark, or refresh an admin screen, and browser Back exits
  Admin entirely instead of going to the previous tab. With 20 tabs, this
  is the biggest single usability problem in the app.
- **The desktop header packs 8 things into one flex row** — org name,
  site name, 7 nav links, up to 2 sync pills, a View-As picker, a "Do not
  disturb" checkbox, an "Enable notifications" button, the user's name,
  and Sign out — with `flexWrap: "wrap"`, so it reflows differently
  depending on org-name length and how many sync pills are showing. The
  raw `<input type="checkbox">` for DND next to pill buttons is the
  single most out-of-place control in the app.
- **The two mobile dropdowns use different positioning strategies**
  (`NavMenu` is `position: fixed` with a long comment explaining why;
  `AccountMenu` is `position: absolute`), different widths, different
  paddings. Neither closes on Escape or traps focus.
- **`KeysHome` and `KeyStationMenu` are near-duplicates** with different
  type sizes; `KeyStationMenu` re-declares its own `smallButtonStyle`
  on top of `kioskTheme`.

### 2.6 Touch targets are too small for the actual users

`buttonStyle.secondary` and the header buttons are `padding: 6px 14px`
at 13px text — roughly **30px tall**. `buttonStyle.primary` is ~40px.
The iOS/Android guidance minimum is 44px, and these are people tapping
in a workshop, outdoors, often in gloves. `useIsMobile` is a *device
size* check, not a pointer-type check, so a wall-mounted touchscreen at
1920px gets desktop-sized 30px targets.

### 2.7 Loading, empty and error states are bare text

~20 screens render `<p>Loading…</p>`, `<p>No equipment yet.</p>`, or a
red `<p>{error}</p>`. No skeletons, no empty-state illustrations or
call-to-action, no toast/inline-alert component. Content pops in with a
layout jump.

### 2.8 Tables

9 files hand-roll `<table>` inside `overflowX: auto` cards. No shared
component, no sticky header, no zebra striping, no responsive card
fallback. `RolesPermissionsTab` and `RoleVisibilityTab` in particular are
wide permission matrices that are painful on anything under a laptop.

---

## 3. Decisions to lock before starting

Claude should ask Andy these before Phase 1, and record the answers in
this file:

| # | Question | Recommendation |
|---|---|---|
| D1 | Keep the navy "Admiralty" palette, or go back to the warm "Field Journal" one? | **Keep navy.** It's what's actually shipped and it reads more professional. Update `BUILD-BRIEF.md` §8 to match rather than reverting the code. |
| D2 | Introduce CSS files, reversing the "no stylesheet" note in `useIsMobile.js`? | **Yes.** Hover/focus states are impossible without it, and they're the core of the complaint. |
| D3 | Dark mode? | **No, not now.** Tokens will be structured so it's a later addition, not a rewrite. |
| D4 | Icons in the nav and on row actions? | **Yes, a small hand-rolled inline SVG set** (no new dependency). Explicitly **not** for priority — `BUILD-BRIEF.md` §8 rules that out and it stays ruled out. |
| D5 | Mobile: bottom tab bar, or keep the ☰ dropdown? | **Bottom tab bar.** Thumb-reachable, standard for a PWA, and it empties the cramped header. |
| D6 | Move Admin out of the primary nav into the account menu? | **Yes** — it's settings, not a peer of Jobs. |

---

## 4. Constraints — things that must not break

Claude must respect these while applying any phase:

1. **Print output must keep literal colour values.** `printJobCards.jsx`
   renders into a *separate window* via `renderToStaticMarkup` and injects
   a small `<style>` block. CSS custom properties defined on the app's
   document will **not** reach it. `PrintableJobCard.jsx` and
   `PrintableJobsChecklist.jsx` must keep resolved hex values, or the
   print stylesheet must redeclare the tokens in that window.
2. **`JobsList.jsx`'s sticky filter header is coupled to `Layout.jsx`'s
   20px `<main>` padding** via a `-20px / -20px / 20px` trio (both files
   comment on it). If the page padding becomes a token, that math must
   move to the same token, not be re-hardcoded.
3. **Priority is a solid colour bar, never an icon or badge**
   (`BUILD-BRIEF.md` §8, explicitly re-confirmed 2026-08-21). The
   `immediate` hazard-stripe pattern stays.
4. **The platform abstraction boundary stays** — no UI work touches
   `src/platform/*` (`BUILD-BRIEF.md` §2).
5. **No behaviour changes.** This is a styling and navigation-structure
   programme. Permission gating, RLS-dependent filtering, the RFID
   terminal-session logic in `App.jsx`, and offline queue handling are
   out of scope and must come out the other side identical.
6. **`Modal.jsx`, `StatDial.jsx`, `JobCard.jsx` are keepers** — they're
   the parts already done right. Extend them, don't replace them.

---

## 5. The plan

Six phases. Phases 1–3 deliver roughly 80% of the perceived improvement;
phase 4 is volume work that can be spread over several sessions.

---

### Phase 1 — Foundation: real CSS + a token layer

**Goal:** introduce a stylesheet and a token system with *no intended
visual change*, so everything after it is cheap. Fix the palette drift.

**Do:**

1. Create `src/styles/tokens.css` — CSS custom properties on `:root`:
   - **Colour:** the current Admiralty values from `theme.js`, plus the
     three that don't exist yet and are currently hardcoded: an overlay
     scrim, a warning surface (replacing `#FBF3E3`), a danger surface
     (replacing `#F5E9E8`).
   - **Type scale, 7 steps** replacing the current 16 ad-hoc sizes:
     `--text-xs: 11px`, `sm: 13px`, `base: 15px`, `md: 17px`,
     `lg: 20px`, `xl: 26px`, `2xl: 32px`. (Chosen to absorb the existing
     values with minimal visual movement — `12px`→xs, `12.5/13px`→sm,
     `14/15px`→base, `16/17/18px`→md, and so on.)
   - **Spacing scale, 4px-based:** `--space-1: 4px` … `--space-8: 40px`.
   - **Radii, 3 steps:** `--radius-sm: 8px`, `--radius-md: 14px`,
     `--radius-full: 999px`. (`6/8/10` collapse to sm, `12/14` to md.)
   - **Elevation, 2 levels only:** `--shadow-card`, `--shadow-overlay`.
   - **Motion:** `--ease: cubic-bezier(.2,.6,.2,1)`,
     `--dur-fast: 120ms`, `--dur: 180ms`.
   - **Control sizing:** `--control-h: 40px`, and under
     `@media (pointer: coarse)` bump it to `48px` — this is what fixes
     §2.6 across the whole app at once, including wall-mounted
     touchscreens that `useIsMobile` misclassifies.
2. Create `src/styles/base.css`:
   - box-sizing reset (move it out of `index.html`'s inline `<style>`),
   - `body` font stack and antialiasing,
   - **a global `:focus-visible` ring** — the single highest-value line
     in this whole plan,
   - form controls inherit `font-family` (they currently don't unless
     told to, which is why `fontFamily: fonts.body` appears on nearly
     every input),
   - `@media (prefers-reduced-motion: reduce) { * { transition: none } }`.
3. Import both from `main.jsx`.
4. **Rewrite `src/lib/theme.js` to read the tokens** — same export names
   (`colors`, `fonts`, `cardStyle`, `buttonStyle`, `priorityColor`,
   `statusPillStyle`, `priorityBarStyle`, `pageStyle`), same shapes, but
   values become `var(--…)`. All 1,425 existing inline styles keep
   working untouched. **This is the hinge of the whole plan** — it lets
   every later phase be incremental instead of a big-bang rewrite.
   - Keep a `rawColors` export with literal hex for the print path
     (constraint 4.1) and for anything that needs a real value in JS.
5. Fix the four drift sites from §2.2: `vite.config.js` manifest,
   `index.html` `theme-color`, the 8 modal overlays, the 4 warm-palette
   panels.
6. Update `BUILD-BRIEF.md` §8 to the Admiralty palette + the new scales,
   and delete the now-false "no stylesheet" paragraph in
   `useIsMobile.js`.

**Acceptance:** app looks essentially identical; every interactive
element now shows a focus ring on Tab; `grep -r '#[0-9A-Fa-f]\{6\}' src
--include='*.jsx'` returns only the print components.

**Size:** ~1 session. Low risk, high leverage.

---

### Phase 2 — UI primitives

**Goal:** one place per control, with real interaction states.

**Do:** create `src/ui/` with a CSS module or plain class-based
stylesheet per component. Each is a thin React wrapper — no new
dependency, no CSS-in-JS library.

| Component | Replaces | Notes |
|---|---|---|
| `Button` | 305 raw `<button>`s | variants `primary \| secondary \| ghost \| danger`, sizes `sm \| md \| lg`, `loading` and `disabled` states, `as={Link}` support (many "buttons" are `<Link>`s wearing `buttonStyle`) |
| `IconButton` | the ad-hoc `×` close buttons | 44px hit area, `aria-label` required |
| `Input` / `Select` / `Textarea` | 209 raw controls, 28 local `fieldStyle`s | |
| `Field` | the `<label style={labelStyle}>` + control pattern repeated ~150× | label, optional hint, error slot, wires `htmlFor`/`aria-describedby` |
| `Card` | 48 `cardStyle` spreads | `padding` prop, optional `interactive` (hover lift) |
| `Modal` | **adopt existing `Modal.jsx`**, add Escape-to-close, focus trap, scroll lock | then convert the 8 hand-rolled copies |
| `Pill` / `StatusPill` | `statusPillStyle` + the duplicate in `EquipmentList` | |
| `Chip` | `FilterChip` in `JobsList` and its copies | |
| `PageHeader` | 73 `<h1>`s in 10 shapes | title + optional subtitle + actions slot |
| `Toolbar` | the repeated "title left, buttons right, flexWrap" row | |
| `Table` | 9 hand-rolled tables | sticky header, zebra, `overflow-x` wrapper built in |
| `EmptyState` | ~15 bare `<p>No … yet.</p>` | icon + message + optional action |
| `Skeleton` | ~20 `<p>Loading…</p>` | |
| `Alert` | the red `<p>{error}</p>` pattern | `info \| warning \| danger` |
| `ActionList` / `ActionGrid` | the hub-page button stacks and the kiosk grids | one component, `size="normal" \| "kiosk"` — see Phase 3 |

**Rule to add to `CLAUDE.md`:** new UI code uses `src/ui/`; no new raw
`<button style={{}}>`, no new local `fieldStyle`.

**Acceptance:** every primitive has visible hover, active, focus-visible
and disabled states; a storybook-less demo route or a screenshot pass
confirms them.

**Size:** ~1–2 sessions.

---

### Phase 3 — Navigation and chrome rebuild

**Goal:** fix "the menus are messy". This is the phase Andy will feel
most.

**Do:**

1. **Restructure the information architecture** to five primary
   destinations plus settings:

   ```
   Overview   (was Dashboard — becomes the landing page)
   Jobs
   Equipment
   Keys       (permission-gated, as now)
   Meters     (was "Meter Reading")
   Safety
   ─────
   Settings & admin   → in the account menu, not the primary bar
   ```

   Jobs stays at `/` or moves to `/jobs` with `/` redirecting — decide
   with Andy; `JobsList` being the landing page is a defensible
   alternative to Overview, and either is better than today's ordering.

2. **One `Menu` primitive** (popover) used by the account menu and any
   future dropdown: single positioning strategy, Escape to close,
   click-outside, focus trap, arrow-key navigation. Replaces the two
   divergent implementations in `Layout.jsx`.

3. **Rebuild the header** as three fixed zones instead of one wrapping
   row:
   - left: org + site identity,
   - centre: primary nav (desktop only),
   - right: a single `StatusCluster` (sync/offline/view-as indicators,
     collapsed into one chip that expands on click) + the avatar menu.

   Move "Do not disturb" and "Enable notifications" out of the header
   entirely — they belong in the account menu (they already are on
   mobile; make desktop match rather than the reverse).

4. **Mobile: bottom tab bar** with the 5 primary destinations. Delete
   `NavMenu`. Header on mobile reduces to identity + avatar. Respect
   `env(safe-area-inset-bottom)` — the app is already
   `viewport-fit=cover`.

5. **Make Admin tabs real routes:** `/admin/:tab`, with `/admin`
   redirecting to the first permitted tab. Keep the existing `ALL_TABS`
   / `GROUPS` structure and permission filtering exactly as-is — only
   the `useState` becomes a route param. Fixes bookmarking, deep links,
   refresh and Back in one change.
   - Desktop: the grouped sidebar becomes a real `<nav>` of `NavLink`s.
   - Mobile: group headers become collapsible sections, defaulting to
     the group containing the active tab.

6. **Unify the hub pages.** `KeysHome`, `MeterReadingHome`, `KioskMenu`
   and `KeyStationMenu` all render through `ActionGrid`/`ActionList`
   with a `size` prop. `kioskTheme.js` stops being a parallel style
   system and becomes a `data-size="kiosk"` variant on the same
   components — which is what removes the font-size mismatches between
   `KeysHome` and `KeyStationMenu`.

**Acceptance:** every admin tab has its own URL and survives refresh;
no nav row wraps at any viewport width from 320px to 2560px; nothing in
the header depends on org-name length; kiosk and key station render from
the same components as the main app.

**Size:** ~2 sessions. Highest visible payoff.

---

### Phase 4 — Screen-by-screen pass

Mechanical application of Phase 2 primitives. Do in this order, one
commit per group:

**Group A — daily-use screens (highest value):**
`JobsList`, `JobDetail` (33 raw buttons — the worst single file),
`NewJob`, `Dashboard`, `EquipmentList`, `EquipmentDetail`.

**Group B — the touchscreens:** 7 kiosk screens + 9 key-station screens.
These are used standing up, in a workshop; they benefit most from the
`pointer: coarse` sizing from Phase 1 and the unified action components
from Phase 3.

**Group C — admin, 20 tabs.** Biggest volume, least visible. Do last and
mechanically. The two permission-matrix tables (`RolesPermissionsTab`,
`RoleVisibilityTab`) need real design attention, not just the `Table`
primitive — consider a sticky first column and a per-role card view
under ~900px.

**Per screen, the checklist is:**
- [ ] `PageHeader` replaces the hand-written `<h1>` row
- [ ] `Card` replaces `cardStyle` spreads
- [ ] `Button` replaces raw `<button>`/`<Link style={buttonStyle}>`
- [ ] `Field`/`Input`/`Select` replace local `fieldStyle`/`labelStyle`
- [ ] `Table` replaces raw `<table>`
- [ ] `Skeleton` replaces "Loading…", `EmptyState` replaces bare "No X
      yet", `Alert` replaces the red `<p>`
- [ ] every value comes from a token — no literal px or hex left

**Size:** ~1 session per group; Group C may want two.

---

### Phase 5 — Polish

- **Motion:** 120–180ms transitions on hover/active/open, `prefers-reduced-motion`
  respected. Nothing longer than 200ms — this is a work tool.
- **Elevation discipline:** cards rest flat with a 1px border (as now);
  only overlays and hover-lift get a shadow. Two levels, no more.
- **Density:** now that `--control-h` exists, verify 44px minimum on
  every tappable thing at `pointer: coarse`.
- **Icons:** hand-rolled inline SVG set for nav items and common row
  actions (edit, delete, print, filter, close, back). No dependency.
  Nav items get icon + label on desktop, icon + label on the bottom bar.
- **Empty states get an action** — "No jobs match this view" gets a
  "Clear filters" button; "No equipment yet" gets "+ Add equipment"
  where permitted.
- **Overdue treatment:** `JobCard`'s current 3px top border is easy to
  miss. Consider a small "Overdue" pill next to the status pill instead
  (keeping the priority bar untouched per constraint 4.3).

**Size:** ~1 session.

---

### Phase 6 — Guardrails, so it doesn't drift again

1. Add a **UI rules** section to `CLAUDE.md`:
   - all colour/size/spacing from tokens, never literals;
   - all controls from `src/ui/`;
   - the print components are the one documented exception.
2. Add `scripts/check-styles.mjs` — fails if a changed `.jsx` under
   `src/` (excluding `src/components/Printable*`) contains a literal
   hex colour or a raw `<button style=`. Wire into the existing GitHub
   Actions workflow as a non-blocking warning first, then blocking.
3. Keep `BUILD-BRIEF.md` §8 as the single source of visual truth and
   update it in the same commit as any token change.

**Size:** ~half a session.

---

## 6. Suggested sequencing

| Session | Phase | Outcome Andy will see |
|---|---|---|
| 1 | Phase 1 | Looks the same, but focus rings appear and the PWA splash/status bar finally match the app |
| 2 | Phase 2 | Still looks similar, but everything now reacts to hover and tap |
| 3–4 | Phase 3 | **The big one** — nav, header and admin feel like one designed app |
| 5–7 | Phase 4 | Every screen tightened, in three batches |
| 8 | Phase 5 | Motion, icons, empty states — the "sharp" finish |
| 9 | Phase 6 | Guardrails |

**If only three sessions are available:** do Phases 1, 2 and 3. That is
where the complaint actually lives.

---

## 7. Explicitly out of scope

- Dark mode (structured for, not built).
- Any change to permissions, RLS, job lifecycle, notifications, the
  offline queue, or the RFID terminal-session logic.
- Any new dependency — no Tailwind, no component library, no icon
  package. The app is 10 dependencies and should stay that way.
- Capacitor / native wrapper work (`BUILD-BRIEF.md` §2 keeps that a
  later swap).
- The pitch CSV import and offline aeroplane-mode testing still open in
  `RUNBOOK.md` — unrelated to this.

---

## 8. What was actually done (2026-09-03)

Phases 1–3 are applied on branch `ui-redesign-phases-1-3`, three commits,
one per phase. **Not merged to `main` and not deployed** — merging is what
triggers the GitHub Pages deploy, so that is Andy's call.

**Decisions taken** (§3's recommendations, all as recommended):
D1 keep the Admiralty navy · D2 yes to CSS files · D3 no dark mode yet ·
D4 icons yes, never for priority · D5 mobile bottom tab bar ·
D6 Admin moves into the account menu.

One decision §3 didn't cover: **Jobs stays at `/`** rather than Dashboard
becoming the landing page. Changing the landing page would have meant
re-teaching everyone's muscle memory and touching the RFID terminal
redirect logic in `App.jsx`, for no gain. Dashboard keeps its place in the
desktop nav; on a phone it sits in the account menu rather than the tab
bar, since it is a manager's summary rather than somewhere anyone works.

**Verification.** Production build passes at every phase. The token layer,
every primitive and every interaction state were checked in the browser via
`/ui-gallery` (dev-only route), including the new header, tab bar and admin
nav rendered from their real CSS classes.

**Not verified:** the signed-in screens. Supabase was unreachable from the
build environment, so nothing past the login screen could be exercised
against real data. Worth a pass on a real session before merging —
particularly Admin (the routing change), the account menu, and the phone
tab bar.

### Phase 4 starting notes

- `src/ui/` is ready; `/ui-gallery` shows everything available.
- `kioskTheme.js` is still used by 20 kiosk and key-station screens. It
  should disappear into `size="kiosk"` variants as Group B is converted.
- `theme.js`'s `buttonStyle`/`cardStyle` are the marker for unconverted
  screens: ~40 files still spread them. When the last one is gone, so are
  they.
- The two permission matrices (`RolesPermissionsTab`, `RoleVisibilityTab`)
  need real design attention, not just the `Table` primitive — the sticky
  first column is built and waiting (`stickyFirstColumn`).
