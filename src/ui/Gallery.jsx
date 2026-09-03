// A development-only specimen page for everything in src/ui/, reachable at
// /ui-gallery. Not registered in production builds (see App.jsx).
//
// It exists because the primitives' whole point is their interaction
// states, and those are exactly what you cannot check by reading the code
// -- this is the one place to hover, tab through and eyeball them all side
// by side without needing a signed-in session or real data.

import { useState } from "react";
import {
  Action,
  ActionList,
  Alert,
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  Fieldset,
  IconButton,
  Input,
  PageHeader,
  Pill,
  SectionLabel,
  Select,
  Skeleton,
  SkeletonList,
  Switch,
  Table,
  Textarea,
  Toolbar,
  ToolbarSpacer,
} from "./primitives.jsx";
import Modal from "./Modal.jsx";
import Menu, { MenuHeader, MenuItem, MenuSeparator } from "./Menu.jsx";
import "../components/Layout.css";
import "../pages/Admin.css";
import {
  IconAlert,
  IconClose,
  IconEdit,
  IconEquipment,
  IconFilter,
  IconJobs,
  IconKeys,
  IconMeters,
  IconPlus,
  IconPrint,
  IconSafety,
} from "./icons.jsx";

function Row({ title, note, children }) {
  return (
    <section style={{ marginBottom: "var(--space-7)" }}>
      <SectionLabel>{title}</SectionLabel>
      {note && (
        <p style={{ margin: "0 0 var(--space-3)", fontSize: "var(--text-sm)", color: "var(--c-ink-soft)", maxWidth: "70ch" }}>
          {note}
        </p>
      )}
      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", alignItems: "flex-start" }}>{children}</div>
    </section>
  );
}

export default function Gallery() {
  const [modalOpen, setModalOpen] = useState(false);
  const [dnd, setDnd] = useState(true);
  const [chip, setChip] = useState("all");

  return (
    <div style={{ minHeight: "100vh", background: "var(--c-bg)", padding: "var(--space-6)" }}>
      <div style={{ maxWidth: "980px", margin: "0 auto" }}>
        <PageHeader
          title="UI gallery"
          subtitle="Development only. Hover and Tab through everything here — these states are the point."
          actions={
            <>
              <Button variant="secondary" icon={<IconPrint size={15} />}>
                Print
              </Button>
              <Button variant="primary" icon={<IconPlus size={15} />}>
                New job
              </Button>
            </>
          }
        />

        <Row title="Button — variants" note="Hover, press, and Tab to each. Before this existed, all of these rendered identically in every state.">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Decommission</Button>
        </Row>

        <Row title="Button — states">
          <Button variant="primary">Rest</Button>
          <Button variant="primary" loading>
            Saving…
          </Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </Row>

        <Row title="Button — sizes" note="Every size grows to a 48px minimum under @media (pointer: coarse), which covers the kiosk touchscreens.">
          <Button size="sm" variant="secondary">
            Small
          </Button>
          <Button variant="secondary">Medium</Button>
          <Button size="lg" variant="primary">
            Kiosk scale
          </Button>
          <IconButton label="Edit">
            <IconEdit size={17} />
          </IconButton>
          <IconButton label="Close">
            <IconClose size={17} />
          </IconButton>
        </Row>

        <Row title="Chips and pills">
          <Chip active={chip === "all"} onClick={() => setChip("all")}>
            All
          </Chip>
          <Chip active={chip === "open"} onClick={() => setChip("open")} count={18}>
            Open
          </Chip>
          <Chip active={chip === "done"} onClick={() => setChip("done")}>
            Completed
          </Chip>
          <span style={{ width: "var(--space-4)" }} />
          <Pill color="var(--c-gold)">Open</Pill>
          <Pill color="var(--c-clay)">In Progress</Pill>
          <Pill color="var(--c-moss)">Completed</Pill>
          <Pill tone="danger">Overdue</Pill>
          <Pill tone="ok">Available</Pill>
          <Pill tone="neutral">Decommissioned</Pill>
        </Row>

        <Row title="Form fields" note="Tab into each: the focus ring is the single highest-value addition in the whole redesign.">
          <div style={{ width: "min(380px, 100%)" }}>
            <Fieldset>
              <Field label="Kit ID" required error="Give this machine an ID — it's how staff pick it at check-out.">
                {(p) => <Input placeholder="e.g. EST1" {...p} />}
              </Field>
              <Field label="Equipment type">
                {(p) => (
                  <Select defaultValue="mower" {...p}>
                    <option value="mower">Ride-on mower</option>
                    <option value="strimmer">Strimmer</option>
                  </Select>
                )}
              </Field>
              <Field label="Hours reading at checkout" hint="Only applies if hours tracking is on for this machine.">
                {(p) => <Input defaultValue="241" {...p} />}
              </Field>
              <Field label="Notes">{(p) => <Textarea placeholder="Anything the next person should know…" {...p} />}</Field>
              <Field label="Serial number">{(p) => <Input disabled value="Not recorded" {...p} />}</Field>
            </Fieldset>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Switch checked={dnd} onChange={setDnd} label="Do not disturb" />
            <span style={{ fontSize: "var(--text-sm)" }}>Do not disturb</span>
          </div>
        </Row>

        <Row title="Cards" note="Only an interactive card lifts — a plain panel stays flat.">
          <Card style={{ width: "260px" }}>
            <strong style={{ fontSize: "var(--text-base)" }}>Resting card</strong>
            <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--c-ink-soft)" }}>
              1px border, no shadow.
            </p>
          </Card>
          <Card as="a" href="#gallery" interactive style={{ width: "260px" }}>
            <strong style={{ fontSize: "var(--text-base)" }}>Interactive card</strong>
            <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--text-sm)", color: "var(--c-ink-soft)" }}>
              Hover me, then Tab to me.
            </p>
          </Card>
        </Row>

        <Row title="Alerts">
          <div style={{ display: "grid", gap: "var(--space-2)", width: "min(560px, 100%)" }}>
            <Alert tone="info">Three of these jobs are waiting on parts.</Alert>
            <Alert tone="warn" title="Hours reading needed">
              This machine tracks engine hours and none was recorded at check-out.
            </Alert>
            <Alert tone="danger" title="Couldn't save">
              You're offline. This job is queued and will send when you're back on signal.
            </Alert>
            <Alert tone="ok">Checked in. Thanks.</Alert>
          </div>
        </Row>

        <Row title="Table">
          <Table>
            <thead>
              <tr>
                <th>Machine</th>
                <th>Make and model</th>
                <th className="tt-num">Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>MO7</td>
                <td>Iseki SXG324</td>
                <td className="tt-num">241</td>
                <td>
                  <Pill tone="ok">Available</Pill>
                </td>
              </tr>
              <tr>
                <td>EST1</td>
                <td>Stihl FS 131</td>
                <td className="tt-num">1,084</td>
                <td>
                  <Pill color="var(--c-clay)">Out</Pill>
                </td>
              </tr>
              <tr>
                <td>MO2</td>
                <td>Hayter Harrier 48</td>
                <td className="tt-num">96</td>
                <td>
                  <Pill tone="danger">Faulty</Pill>
                </td>
              </tr>
            </tbody>
          </Table>
        </Row>

        <Row title="Loading and empty states" note="Replacing the bare “Loading…” and “No X yet.” paragraphs on ~35 screens.">
          <div style={{ width: "min(340px, 100%)" }}>
            <SkeletonList rows={3} />
          </div>
          <div style={{ width: "min(340px, 100%)" }}>
            <EmptyState title="No jobs match this view" action={<Button variant="secondary">Clear filters</Button>}>
              Three filters are active. Clear them to see the other 18 open jobs.
            </EmptyState>
          </div>
          <div style={{ width: "180px" }}>
            <Skeleton height={38} />
          </div>
        </Row>

        <Row title="Actions — list and grid" note="One component behind the Keys hub, the Meters hub, and both touchscreen menus.">
          <ActionList style={{ width: "min(320px, 100%)" }}>
            <Action variant="primary" icon={<IconKeys size={18} />}>
              Check out a key
            </Action>
            <Action icon={<IconKeys size={18} />} description="Find where a key is right now">
              Find a key
            </Action>
            <Action variant="danger" icon={<IconAlert size={18} />}>
              Force check-in
            </Action>
          </ActionList>
          <ActionList layout="grid" size="kiosk" style={{ width: "min(430px, 100%)" }}>
            <Action variant="primary" icon={<IconJobs size={24} />}>
              View jobs
            </Action>
            <Action variant="primary" icon={<IconEquipment size={24} />}>
              Check out kit
            </Action>
            <Action icon={<IconSafety size={24} />}>Health &amp; safety</Action>
            <Action icon={<IconMeters size={24} />}>Read a meter</Action>
          </ActionList>
        </Row>

        <Row title="Overlays" note="Both close on Escape and keep Tab inside themselves.">
          <Button variant="secondary" icon={<IconFilter size={15} />} onClick={() => setModalOpen(true)}>
            Open a dialog
          </Button>
          <Menu
            trigger={(p) => (
              <Button variant="secondary" {...p}>
                Open a menu
              </Button>
            )}
          >
            {({ close }) => (
              <>
                <MenuHeader>
                  <div style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Andy Walker</div>
                  <div className="tt-menu__meta" style={{ fontFamily: "var(--font-mono)" }}>
                    ADMIN
                  </div>
                </MenuHeader>
                <MenuItem meta={<Switch checked={dnd} onChange={setDnd} label="Do not disturb" />}>Do not disturb</MenuItem>
                <MenuItem meta="On">Notifications</MenuItem>
                <MenuSeparator />
                <MenuItem onSelect={close}>Settings &amp; admin</MenuItem>
                <MenuItem danger onSelect={close}>
                  Sign out
                </MenuItem>
              </>
            )}
          </Menu>
        </Row>

        {modalOpen && (
          <Modal title="Filter jobs" onClose={() => setModalOpen(false)}>
            <Fieldset>
              <Field label="Status">
                {(p) => (
                  <Select {...p}>
                    <option>All</option>
                    <option>Open</option>
                  </Select>
                )}
              </Field>
              <Field label="Assigned to">
                {(p) => (
                  <Select {...p}>
                    <option>Everyone</option>
                  </Select>
                )}
              </Field>
            </Fieldset>
            <div className="tt-modal__foot">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                Clear all
              </Button>
              <Button variant="primary" onClick={() => setModalOpen(false)}>
                Done
              </Button>
            </div>
          </Modal>
        )}

        {/* Static replicas of the real chrome classes from Layout.css and
            Admin.css. The live components need an authenticated session, so
            this is the one place the header, the tab bar and the admin nav
            can be checked side by side. */}
        <Row title="App chrome — desktop header" note="Three fixed zones. It used to be one flexWrap row holding eight unrelated things.">
          <div style={{ width: "100%", border: "1px solid var(--c-line-strong)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
            <header className="tt-appbar">
              <div className="tt-appbar__identity">
                <span className="tt-appbar__mark">TT</span>
                <div style={{ minWidth: 0 }}>
                  <div className="tt-appbar__org">Tree Tops Caravan Park</div>
                  <div className="tt-appbar__site">Main Site</div>
                </div>
              </div>
              <nav className="tt-appbar__nav">
                <a href="#gallery" className="tt-navlink tt-navlink--active">
                  <IconJobs size={15} /> Jobs
                </a>
                <a href="#gallery" className="tt-navlink">
                  <IconMeters size={15} /> Dashboard
                </a>
                <a href="#gallery" className="tt-navlink">
                  <IconEquipment size={15} /> Equipment
                </a>
                <a href="#gallery" className="tt-navlink">
                  <IconKeys size={15} /> Keys
                </a>
                <a href="#gallery" className="tt-navlink">
                  <IconMeters size={15} /> Meters
                </a>
                <a href="#gallery" className="tt-navlink">
                  <IconSafety size={15} /> Safety
                </a>
              </nav>
              <div className="tt-appbar__right">
                <span className="tt-statuschip tt-statuschip--syncing">
                  <IconMeters size={13} />
                  <span className="tt-statuschip__label">Syncing 2</span>
                </span>
                <span className="tt-avatar">AW</span>
              </div>
            </header>
          </div>
        </Row>

        <Row title="App chrome — phone tab bar" note="Replaces the ☰ dropdown, which covered the list you opened the app to read.">
          <div style={{ width: "270px", border: "1px solid var(--c-line-strong)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
            <nav className="tt-tabbar">
              <a href="#gallery" className="tt-tab tt-tab--active">
                <IconJobs size={19} />
                <span className="tt-tab__label">Jobs</span>
              </a>
              <a href="#gallery" className="tt-tab">
                <IconEquipment size={19} />
                <span className="tt-tab__label">Kit</span>
              </a>
              <a href="#gallery" className="tt-tab">
                <IconKeys size={19} />
                <span className="tt-tab__label">Keys</span>
              </a>
              <a href="#gallery" className="tt-tab">
                <IconMeters size={19} />
                <span className="tt-tab__label">Meters</span>
              </a>
              <a href="#gallery" className="tt-tab">
                <IconSafety size={19} />
                <span className="tt-tab__label">Safety</span>
              </a>
            </nav>
          </div>
          <div style={{ width: "230px" }}>
            <p className="tt-admin__grouplabel">Equipment</p>
            <a href="#gallery" className="tt-admin__link tt-admin__link--active">
              Equipment
            </a>
            <a href="#gallery" className="tt-admin__link">
              Equipment types
            </a>
            <a href="#gallery" className="tt-admin__link">
              Service templates
            </a>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--c-ink-soft)", marginTop: "var(--space-2)" }}>
              Admin nav — each of these is now its own URL.
            </p>
          </div>
        </Row>

        <Toolbar>
          <SectionLabel style={{ margin: 0 }}>End of gallery</SectionLabel>
          <ToolbarSpacer />
        </Toolbar>
      </div>
    </div>
  );
}
