import { useState } from "react";
import { NavLink, Navigate, useParams } from "react-router-dom";
import { usePermissions } from "../lib/permissions.js";
import { useIsMobile } from "../lib/useIsMobile.js";
import JobTemplatesTab from "./admin/JobTemplatesTab.jsx";
import ActivityTypesTab from "./admin/ActivityTypesTab.jsx";
import SafetyLibraryTab from "./admin/SafetyLibraryTab.jsx";
import RolesPermissionsTab from "./admin/RolesPermissionsTab.jsx";
import RoleVisibilityTab from "./admin/RoleVisibilityTab.jsx";
import JobAssignmentTab from "./admin/JobAssignmentTab.jsx";
import UsersTab from "./admin/UsersTab.jsx";
import SchedulesTab from "./admin/SchedulesTab.jsx";
import EquipmentTypesTab from "./admin/EquipmentTypesTab.jsx";
import EquipmentTab from "./admin/EquipmentTab.jsx";
import ServiceTemplatesTab from "./admin/ServiceTemplatesTab.jsx";
import CommonFaultDescriptionsTab from "./admin/CommonFaultDescriptionsTab.jsx";
import RfidTagsTab from "./admin/RfidTagsTab.jsx";
import KeyTagsTab from "./admin/KeyTagsTab.jsx";
import KeyActivityLogTab from "./admin/KeyActivityLogTab.jsx";
import KeyReportsTab from "./admin/KeyReportsTab.jsx";
import RoleKeyReasonsTab from "./admin/RoleKeyReasonsTab.jsx";
import EquipmentCheckoutLogTab from "./admin/EquipmentCheckoutLogTab.jsx";
import ContractorsTab from "./admin/ContractorsTab.jsx";
import GroupsTab from "./admin/GroupsTab.jsx";
import { EmptyState, PageHeader } from "../ui/primitives.jsx";
import { IconChevronDown } from "../ui/icons.jsx";
import "./Admin.css";

// `key` is also the URL segment -- /admin/equipment, /admin/keyTags -- so
// renaming one changes a link people may have bookmarked. Labels are
// sentence case: twenty tabs in Title Case reads as twenty shouting
// headings rather than a list.
const ALL_TABS = [
  { key: "templates", label: "Job templates", Component: JobTemplatesTab, permission: "can_manage_reference_data" },
  { key: "activities", label: "Activity types", Component: ActivityTypesTab, permission: "can_manage_reference_data" },
  { key: "library", label: "Safety library", Component: SafetyLibraryTab, permission: "can_manage_reference_data" },
  { key: "schedules", label: "Recurring jobs", Component: SchedulesTab, permission: "can_manage_reference_data" },
  { key: "equipment", label: "Equipment", Component: EquipmentTab, permission: "can_manage_equipment_status" },
  { key: "equipmentTypes", label: "Equipment types", Component: EquipmentTypesTab, permission: "can_manage_equipment_status" },
  { key: "serviceTemplates", label: "Service templates", Component: ServiceTemplatesTab, permission: "can_manage_equipment_status" },
  { key: "faultDescriptions", label: "Common faults", Component: CommonFaultDescriptionsTab, permission: "can_manage_equipment_status" },
  { key: "checkoutLog", label: "Equipment history", Component: EquipmentCheckoutLogTab, permission: "can_manage_equipment_status" },
  { key: "rfid", label: "RFID fobs", Component: RfidTagsTab, permission: "can_manage_users" },
  { key: "keyTags", label: "Key tags", Component: KeyTagsTab, permission: "can_manage_keys" },
  { key: "keyActivity", label: "Key activity log", Component: KeyActivityLogTab, permission: "can_manage_keys" },
  { key: "keyReports", label: "Key reports", Component: KeyReportsTab, permission: "can_manage_keys" },
  { key: "roleKeyReasons", label: "Key reasons by role", Component: RoleKeyReasonsTab, permission: "can_manage_keys" },
  { key: "contractors", label: "Contractors", Component: ContractorsTab, permission: "can_manage_contractors" },
  { key: "groups", label: "Groups", Component: GroupsTab, permission: "can_manage_users" },
  { key: "roles", label: "Roles & permissions", Component: RolesPermissionsTab, permission: "can_manage_roles_and_permissions" },
  { key: "roleVisibility", label: "Role visibility", Component: RoleVisibilityTab, permission: "can_manage_roles_and_permissions" },
  { key: "jobAssignment", label: "Job assignment", Component: JobAssignmentTab, permission: "can_manage_roles_and_permissions" },
  { key: "users", label: "Users", Component: UsersTab, permission: "can_manage_users" },
];

// Purely a display grouping -- doesn't affect ALL_TABS' permission gating
// below, just how the same filtered tab list gets organised in the
// sidebar. Sized so no group is a lone tab and none is a wall of unrelated
// settings (it was one flat 20-tab row before this).
const GROUPS = [
  { name: "Jobs", keys: ["templates", "activities", "library", "schedules"] },
  { name: "Equipment", keys: ["equipment", "equipmentTypes", "serviceTemplates", "faultDescriptions", "checkoutLog"] },
  { name: "Keys", keys: ["keyTags", "keyActivity", "keyReports", "roleKeyReasons"] },
  { name: "People & access", keys: ["contractors", "groups", "users", "rfid", "roles", "roleVisibility", "jobAssignment"] },
];

export default function Admin() {
  const permissions = usePermissions();
  const isMobile = useIsMobile();
  const { tab: routeTab } = useParams();

  const tabs = ALL_TABS.filter((t) => permissions.has(t.permission));
  const tabsByKey = Object.fromEntries(tabs.map((t) => [t.key, t]));

  // Same grouping either side of the desktop/mobile split -- only the
  // layout around it changes -- so a tab added to ALL_TABS but not to
  // GROUPS above still shows up somewhere rather than silently vanishing.
  const groupedKeys = new Set(GROUPS.flatMap((g) => g.keys));
  const visibleGroups = [
    ...GROUPS.map((g) => ({ name: g.name, tabs: g.keys.map((k) => tabsByKey[k]).filter(Boolean) })),
    { name: "Other", tabs: tabs.filter((t) => !groupedKeys.has(t.key)) },
  ].filter((g) => g.tabs.length > 0);

  if (tabs.length === 0) {
    return <EmptyState title="No access">You don't have permission to see this section.</EmptyState>;
  }

  // Bare /admin, or a tab this person can't see (a stale bookmark, or a
  // permission that has since been revoked), lands on the first one they
  // can. `replace` so Back doesn't bounce off the redirect.
  const activeTab = tabsByKey[routeTab];
  if (!activeTab) return <Navigate to={`/admin/${tabs[0].key}`} replace />;

  const ActiveComponent = activeTab.Component;

  return (
    <div>
      <PageHeader title="Settings & admin" subtitle={activeTab.label} />
      {isMobile ? (
        <div>
          <MobileNav groups={visibleGroups} activeKey={activeTab.key} />
          <ActiveComponent />
        </div>
      ) : (
        <div className="tt-admin">
          <nav className="tt-admin__nav" aria-label="Admin sections">
            {visibleGroups.map((g) => (
              <div className="tt-admin__group" key={g.name}>
                <p className="tt-admin__grouplabel">{g.name}</p>
                {g.tabs.map((t) => (
                  <NavLink
                    key={t.key}
                    to={`/admin/${t.key}`}
                    className={({ isActive }) => `tt-admin__link${isActive ? " tt-admin__link--active" : ""}`}
                  >
                    {t.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="tt-admin__body">
            <ActiveComponent />
          </div>
        </div>
      )}
    </div>
  );
}

function MobileNav({ groups, activeKey }) {
  const activeGroup = groups.find((g) => g.tabs.some((t) => t.key === activeKey))?.name;
  const [openGroup, setOpenGroup] = useState(activeGroup);

  return (
    <div className="tt-admin__mobilenav">
      {groups.map((g) => {
        const open = openGroup === g.name;
        return (
          <div key={g.name}>
            <button
              type="button"
              className="tt-admin__disclosure"
              aria-expanded={open}
              onClick={() => setOpenGroup(open ? null : g.name)}
            >
              <span>
                {g.name} <span className="tt-admin__count">{g.tabs.length}</span>
              </span>
              <IconChevronDown size={16} />
            </button>
            {open && (
              <div className="tt-admin__panel">
                {g.tabs.map((t) => (
                  <NavLink
                    key={t.key}
                    to={`/admin/${t.key}`}
                    className={({ isActive }) => `tt-admin__link${isActive ? " tt-admin__link--active" : ""}`}
                  >
                    {t.label}
                  </NavLink>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
