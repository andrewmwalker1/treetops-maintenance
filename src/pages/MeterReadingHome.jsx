import { Link } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { Action, ActionList, PageHeader, SectionLabel } from "../ui/primitives.jsx";
import { IconMeters, IconPrint, IconSettings } from "../ui/icons.jsx";

// Landing page for the "Meters" nav item -- everything meter-reading lives
// under its own menu rather than being split between the top nav and the
// generic Admin tab list (Andy's ask).
//
// Shares its shape with KeysHome and the two touchscreen menus: all four
// now render through <ActionList>/<Action> rather than each stacking its
// own hand-styled buttons at its own type size.
export default function MeterReadingHome() {
  const permissions = usePermissions();

  return (
    <div style={{ maxWidth: "520px" }}>
      <PageHeader title="Meters" subtitle="Read a meter, or check how the round is going." />

      <ActionList>
        <Action as={Link} to="/meter-reading/scan" variant="primary" icon={<IconMeters size={18} />}>
          Read a meter
        </Action>
        <Action as={Link} to="/meter-reading/progress" description="How much of the round is done">
          Round progress
        </Action>
      </ActionList>

      {permissions.has("can_manage_meter_readings") && (
        <>
          <SectionLabel style={{ margin: "var(--space-6) 0 var(--space-2)" }}>Admin</SectionLabel>
          <ActionList>
            <Action as={Link} to="/meter-reading/upload">
              Upload CampManager CSVs
            </Action>
            <Action as={Link} to="/meter-reading/download">
              Download for CampManager
            </Action>
            <Action as={Link} to="/meter-reading/labels" icon={<IconPrint size={18} />}>
              Print QR labels
            </Action>
            <Action as={Link} to="/meter-reading/settings" icon={<IconSettings size={18} />}>
              Unit cost settings
            </Action>
          </ActionList>
        </>
      )}
    </div>
  );
}
