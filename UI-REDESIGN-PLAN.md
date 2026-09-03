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

Phases 1–3, three commits, one per phase.

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
against real data. Worth a pass on a real session — particularly Admin
(the routing change), the account menu, and the phone tab bar.

Phases 1–3 were merged to `main` and deployed on 2026-09-03 (run
33740179500, 43s). The live site serves the token stylesheet with 19
`:focus` and 22 `:hover` rules, and the corrected navy PWA colours.

---

## 8a. Phase 4 (2026-09-03)

Applied on branch `ui-redesign-phase-4`, four commits, one per group plus
a docs pass. All three groups are done — nothing is left half-converted.

**The marker is clear.** `theme.js` no longer exports `cardStyle` or
`buttonStyle`, because nothing imports them; `src/kiosk/kioskTheme.js` is
deleted for the same reason. Those were the plan's own test for "is this
screen converted", and they now fail to compile if anyone reaches for them.

**Group A — daily-use screens.** Jobs list, job detail, new job, dashboard,
both equipment screens, plus `JobCard`, `StatDial`, `ChecklistBuilder` and
`PitchPicker`. Beyond the swap: skeletons replace "Loading…", empty states
gained actions ("Clear filters", "New job"), errors became `Alert`,
`StatDial` became a real button so the dashboard tiles are keyboard
reachable, and equipment history's sortable headers became real buttons
with `aria-sort` (they were `<th onClick>`, which no keyboard could reach).

**Group B — the touchscreens.** All 7 kiosk and 9 key-station screens, plus
the 8 in-app phone twins of the same flows. `KeySelector`'s two style-object
props collapsed into one `size` prop — those two props are how the key
station and the in-app Keys pages ended up with differently-shaped rows for
the same list. `KeyStationCheckOut`'s "who's taking it" and reason presets
became `Chip`, which actually shows which one is selected; the reason
presets never did.

**Group C — admin, meters, safety, login.** 30 files. Six hand-rolled
scrim-and-panel modals became `Modal` (which, unlike the copies, traps Tab,
closes on Escape, locks the page behind it and restores focus). Five
hand-rolled filter-chip strips became `Chip`. Seventeen `fieldStyle`
objects, five `labelStyle`, two `thStyle`/`tdStyle` pairs and two
`iconButtonStyle` copies are gone.

**The permission matrices** got the design attention this plan asked for:
first column pinned (`stickyFirstColumn`), and under 900px the grid becomes
one card per role with the same toggles read down instead of across. The
breakpoint is a width query, not the phone check — a half-width desktop
window hits this as surely as a phone does.

**New in the primitives**, all found by needing them: `.tt-btn--kiosk` and
`.tt-input--kiosk`, `.tt-kiosk-page`, `.tt-sortbtn` (sortable table
header), an `:disabled` state for `.tt-iconbtn`, and `useMediaQuery` in
`useIsMobile.js`.

**Verification.** Production build passes after every group. Beyond that,
three static passes over the whole tree, all clean: no unused imports, no
JSX tag referring to a component that is not in scope (the failure a
mechanical conversion actually introduces, and one the build does not
catch), and no literal px spacing or radius left in an inline style outside
the print components.

**Not verified, same caveat as before:** no signed-in screen was exercised
against real data — that needs a real login. Login and `/ui-gallery` were
checked in the browser; everything past them is verified structurally, not
visually.

---

## 8b. Phase 5 — Polish (2026-09-03)

Applied on branch `ui-redesign-phase-5-6`, one commit. Closed the specific
gaps an audit found still open after Phase 4, rather than redoing work
Phase 4 already did (icons, most empty-state actions, and motion were
already built).

**Icons.** Every remaining emoji/glyph pseudo-icon is gone — the camera,
gallery/image, arrow-up and arrow-down icons it needed didn't exist yet, so
they're added to `src/ui/icons.jsx` first, then swapped in across
JobDetail, ChecklistBuilder, and the two admin reorder-icon tabs. The audit
also caught things the Phase 4 mechanical conversion missed: six in-app key
pages (CheckInKey, CheckOutKey, FindKey, ForceCheckInKey, HandoverKey,
RelocateKey) still had a literal "← Keys" instead of `icon={<IconArrowLeft
/>}`, and two admin delete-role buttons still rendered a literal "×".

**A real accessibility bug**, found while fixing the above: the admin
Equipment history table's sortable column headers were still `<th
onClick>` — unreachable by keyboard — even though Phase 4's own commit
message claims this exact pattern was fixed (it was, but only in
`EquipmentDetail.jsx`; `EquipmentCheckoutLogTab.jsx` has a near-identical
table and was missed). Both now use real `<button className="tt-sortbtn">`
elements with `aria-sort` on the `<th>`.

**Motion and elevation were already correct** — audited, not changed.
Every `transition:` in the codebase resolves through `--dur-fast` (120ms)
or `--dur` (180ms), both under the plan's 200ms ceiling; the two
`animation:` rules (a button spinner, a skeleton shimmer) are continuous
loading indicators, a different category the ceiling was never meant to
cover. `--shadow-card` is used in exactly one place
(`.tt-card--interactive:hover`) and `--shadow-overlay` in exactly two
(`.tt-modal`, `.tt-menu`) plus two JS-side popover usages — two levels, no
more, as specified. The one non-token `box-shadow` found (an invalid-input
focus ring) is now `--focus-ring-inset-danger`, matching the neutral
`--focus-ring-inset` it sat next to.

**Density.** `--control-h` covers buttons and text inputs under `@media
(pointer: coarse)`, but nothing had ever done the same for native
`<input type="checkbox">` / `type="radio">` — they stayed at the ~13px
browser default on every touch device outside the kiosk/key-station
screens, which hand-size their own. One rule in `base.css`'s existing
coarse-pointer block fixes every un-sized instance app-wide at once
(NewJob, JobDetail, every admin form) without touching the already-sized
kiosk instances, since an inline `style` always wins over it.

**Two literal hex colours** in `base.css`: the placeholder text colour had
no token, so it got one (`--c-placeholder`); the print-fallback
background stays a literal `#FFFFFF` with a comment explaining why — it is
the actual colour of paper, and using `--c-paper` (deliberately a shade
off pure white so screen surfaces read against `--c-bg`) would be wrong
for a printed page specifically.

**Overdue treatment.** `JobCard`'s 3px top-border hack is now a small
`Pill tone="danger"` reading "Overdue", next to the status pill. The
priority bar is untouched, per constraint 4.3.

**Empty-state actions.** Of 12 `<EmptyState>` usages with no action prop,
9 were correctly left alone — there's genuinely nothing to add or clear
from a check-in screen with nothing checked out, from a kiosk that has no
admin capability to add equipment types, or from a permission-denial
screen. Three were real gaps and got fixed: `RoleVisibilityTab`'s "no
roles yet" told the user where to go ("Add one from Roles & permissions")
but gave no way to get there — now a real link; `KioskJobs` and
`KioskSafety`'s filtered-empty-results states had live filter state
sitting right there with no button to clear it — now they do.

**Explicitly not done, flagged for later:** a broader sweep found roughly
35 more plain-text "No X yet" / "Nothing matches" paragraphs across
admin, kiosk and key-station screens that were never converted to
`EmptyState` in Phase 4 at all (`ActivityTypesTab`, `ContractorsTab`,
`GroupsTab`, `JobTemplatesTab`, `KeyTagsTab`, `SafetyLibraryTab`,
`SchedulesTab`, `UsersTab`, and about two dozen more — see the plain `<p
style={{ color: colors.inkSoft }}>No …</p>` pattern). That's a sweep of
similar size and shape to Phase 4 itself, not a "polish" fix, so it wasn't
done here — it needs its own pass. `ViewAsControl.jsx`'s "Return to my
view" button is also still a raw `<button style={{}}>`, deliberately left:
it needs an inverted colour treatment (white background, moss-dark text)
that doesn't correspond to any of `Button`'s four existing variants, since
it sits on a dark banner rather than the page background — forcing it
into `Button` via a style override would silently break its hover state
(an inline style permanently overrides the CSS `:hover` rule), so it
either needs a genuine new variant or should stay a deliberate, documented
exception. Not decided here.

**Verification.** Production build after every change. The three static
sweeps from Phase 4 (unused imports, unresolved JSX components, tag
balance) re-run clean. Structural checks in the browser: the invalid-input
focus-ring token resolves to the unchanged original value; the placeholder
token and the coarse-pointer checkbox/radio rule both resolve correctly in
computed styles; the `Overdue` pill's exact CSS class renders as a soft
red pill distinct from the solid status pill next to it. No signed-in
screen was exercised — same caveat as every phase before this one.

---

## 8c. Phase 6 — Guardrails (2026-09-03)

Applied on the same branch, one commit.

**CLAUDE.md** gets a short "UI rules" section — colour/size/spacing from
tokens, controls from `src/ui/`, print components are the one exception —
pointing at BUILD-BRIEF.md section 8 as the source of truth rather than
duplicating it. Duplicating it is exactly how the token layer drifted from
the app once already (see section 8's own history note about the old warm
palette stranding the PWA manifest).

**`scripts/check-styles.mjs`** checks changed `.jsx` files for a literal
hex colour in a `style` prop and a raw `<button style={{}}>`. Two design
decisions worth recording:

- It diffs only files changed in the current push
  (`CHECK_STYLES_BASE`, wired to `github.event.before` in the workflow),
  not the whole tree. The goal is catching new drift, not retroactively
  failing on code that predates the script — of which there is some (see
  8b's flagged follow-ups, plus `ViewAsControl.jsx`'s raw button, which
  the script would report the next time that file is actually touched).
- Wired into `deploy.yml` as `continue-on-error: true` between install and
  build — a warning, not a blocker, exactly as specified. Flip that once
  it has run clean on a few pushes; that's a one-line change, not done
  here.

The Checkout step needed `fetch-depth: 0` added — the diff's base commit
isn't present in the default single-commit shallow clone.

**Verification, beyond the production build:** run against this repo's
entire history (86 changed files back to the initial scaffold), it found
exactly one true violation — `ViewAsControl.jsx`'s raw button, already
known from 8b — and nothing else, confirming the rest of the codebase
really is clean. A synthetic test file with four deliberate violations
(three literal hexes — 6-digit, 3-digit, and a 3-digit one on a wrapped
`<Button>`, still flagged since the wrapper doesn't exempt a literal
colour — plus a raw `<button>`) confirmed all four are caught, while a
hex value mentioned only in a comment was correctly not flagged. That
test file was committed in isolation, verified, then reverted with `git
reset --soft` so it never touched the real Phase 6 changes sitting
alongside it.

Also converted in passing: `PhotoThumb.jsx`'s lightbox close button to
`IconButton`, found while checking what the new script would flag on the
current tree — a one-line fix once `IconClose` was already imported for
Phase 5's icon sweep.

**Follow-ups for a future session**, not done here: the ~35-screen
empty-state sweep (done separately — see 8d) and `ViewAsControl.jsx`'s
button treatment from 8b remain; flipping `check-styles.mjs` to blocking
once it's proven quiet; deciding whether `check-styles.mjs` should also
catch other literal-value patterns (literal px spacing, `rgba()` colours)
now that the hex/button pair has proven the approach, or whether that's
diminishing returns for a non-blocking warning.

---

## 8d. Empty-state sweep (2026-09-03)

Applied on branch `ui-redesign-emptystate-sweep`, one commit. The follow-up
flagged in 8b — done as its own pass, not folded into a future phase,
since the user asked for it directly.

**Not a blanket find-and-replace.** `EmptyState`'s own CSS
(`.tt-empty`) is a dashed box with `--space-7` (40px) padding, built for
"this whole page or section has nothing in it" — not a drop-in
replacement for every stray "No X yet" paragraph regardless of context.
Wrapping a minor inline note in that box, nested inside an already-boxed
Card, produces a box-within-a-box that reads as visually heavier than the
fact deserves. So each of the ~42 sites the original audit found was
individually judged, not mechanically swept:

- **~35 converted**, across 29 files — the ones where the empty message
  really is the entire content of its view or section: every remaining
  admin tab's "no rows yet" list state, the six key-station/in-app
  "no keys to pick from" screens, and a handful of modal- and
  card-scoped states (`ContractorDocumentsModal`, `KioskJobs`'s
  view-only Checklist card, `ReportIssueForm`'s preset-fault picker).
- **Six deliberately left as plain, already-tokenized text**, because
  converting them would look wrong rather than because they were missed:
  `ChecklistBuilder`'s "No checklist items" (a widget embedded in a
  bigger form, not its own section), the per-activity-type "No RA/MS
  documents linked yet" in both `JobDetail` and `KioskJobs` (one line
  among several activity types in a loop, not the whole section),
  `JobDetail`'s "No photos on this job yet" in the contractor-email
  modal (sits beside an Add photo button that's already visible either
  way), `GroupsTab`'s "No users yet" (inside a small bounded
  member-picker card within the group-edit form), and `ScanMeter`'s "No
  matches" (an intentionally quiet, small-type autocomplete-style hint).
  Two more text fragments the original audit's regex had also caught
  turned out not to be empty states at all — `KeyTagsTab`'s "Type a
  pitch… to see its key tags" is an instructional prompt for a
  not-yet-run search, and `KeyReportsTab`'s "Every pitch has at least one
  active key" is good news — neither was touched.

**Actions added only where genuinely useful** (four sites), matching the
discipline from Phase 5's three fixes rather than defaulting to
"always add a button":

- `CommonFaultDescriptionsTab`'s "no equipment types yet" links to the
  Equipment types tab — safe because this is a standalone list view with
  nothing to lose by navigating away, and both tabs share a permission
  gate.
- `KeyActivityLogTab`'s filtered-empty state gets a single "Clear
  filters" action that resets all five controls at once (a status chip,
  two selects, two date inputs) — genuinely convenient given how many
  there are to reset by hand, unlike a single visible chip.
- `KeyReportsTab` and `KeyTagsTab`'s search-result empty states, and
  `DocumentPicker`'s own live-search empty state, get a "Clear search"
  action.

**Actions deliberately withheld**, each for a different reason:

- `DocumentPicker`'s "library is empty" state and `JobTemplatesTab`'s "no
  activity types" state both sit inside an in-progress create/edit
  form — a link to another admin tab would silently abandon whatever the
  admin was filling in, exactly the risk flagged (but not yet acted on)
  for `ViewAsControl.jsx` in 8b.
- `HealthAndSafety`'s "no activity types" state is reachable by any
  signed-in user, most of whom don't hold `can_manage_reference_data` —
  a link to Admin would dead-end most viewers at a "no access" screen,
  so it stays informational only.
- `KeyTagsTab`'s status-filtered states and `EquipmentTab`'s type-filtered
  state didn't get a duplicate "Clear" button: both already have a
  persistently visible filter control (a chip strip / a dropdown) sitting
  above the list at all times, so a second button doing the same
  one-click thing adds nothing.

**Verification.** Production build after the full change. The same three
static sweeps from Phase 4/5 (unused imports, unresolved JSX components,
tag balance) re-run clean. `check-styles.mjs`, run against this exact
commit for real (not simulated), reports clean across all 29 changed
files. `/ui-gallery` loads with no console errors. No signed-in screen
was exercised — same caveat as every phase before this one; most of what
changed here lives behind Admin, which needs a real login to see.
