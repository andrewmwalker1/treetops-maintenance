import { useState, useEffect } from "react";
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
import { colors, fonts } from "../lib/theme.js";

const ALL_TABS = [
  { key: "templates", label: "Job Templates", Component: JobTemplatesTab, permission: "can_manage_reference_data" },
  { key: "activities", label: "Activity Types", Component: ActivityTypesTab, permission: "can_manage_reference_data" },
  { key: "library", label: "Safety Library", Component: SafetyLibraryTab, permission: "can_manage_reference_data" },
  { key: "schedules", label: "Recurring Jobs", Component: SchedulesTab, permission: "can_manage_reference_data" },
  { key: "equipment", label: "Equipment", Component: EquipmentTab, permission: "can_manage_equipment_status" },
  { key: "equipmentTypes", label: "Equipment Types", Component: EquipmentTypesTab, permission: "can_manage_equipment_status" },
  { key: "serviceTemplates", label: "Service Templates", Component: ServiceTemplatesTab, permission: "can_manage_equipment_status" },
  { key: "faultDescriptions", label: "Common Faults", Component: CommonFaultDescriptionsTab, permission: "can_manage_equipment_status" },
  { key: "checkoutLog", label: "Checkout Log", Component: EquipmentCheckoutLogTab, permission: "can_manage_equipment_status" },
  { key: "rfid", label: "RFID Fobs", Component: RfidTagsTab, permission: "can_manage_users" },
  { key: "keyTags", label: "Key Tags", Component: KeyTagsTab, permission: "can_manage_keys" },
  { key: "keyActivity", label: "Key Activity Log", Component: KeyActivityLogTab, permission: "can_manage_keys" },
  { key: "keyReports", label: "Key Reports", Component: KeyReportsTab, permission: "can_manage_keys" },
  { key: "roleKeyReasons", label: "Key Reasons by Role", Component: RoleKeyReasonsTab, permission: "can_manage_keys" },
  { key: "contractors", label: "Contractors", Component: ContractorsTab, permission: "can_manage_contractors" },
  { key: "groups", label: "Groups", Component: GroupsTab, permission: "can_manage_users" },
  { key: "roles", label: "Roles & Permissions", Component: RolesPermissionsTab, permission: "can_manage_roles_and_permissions" },
  { key: "roleVisibility", label: "Role Visibility", Component: RoleVisibilityTab, permission: "can_manage_roles_and_permissions" },
  { key: "jobAssignment", label: "Job Assignment", Component: JobAssignmentTab, permission: "can_manage_roles_and_permissions" },
  { key: "users", label: "Users", Component: UsersTab, permission: "can_manage_users" },
];

// Purely a display grouping -- doesn't affect ALL_TABS' permission
// gating below, just how the same filtered tab list gets organised in
// the sidebar. Sized so no group is a lone tab and none is a wall of
// unrelated settings (was one flat 20-tab row before this).
const GROUPS = [
  { name: "Jobs", keys: ["templates", "activities", "library", "schedules"] },
  { name: "Equipment", keys: ["equipment", "equipmentTypes", "serviceTemplates", "faultDescriptions", "checkoutLog"] },
  { name: "Keys", keys: ["keyTags", "keyActivity", "keyReports", "roleKeyReasons"] },
  { name: "People & Access", keys: ["contractors", "groups", "users", "rfid", "roles", "roleVisibility", "jobAssignment"] },
];

const groupHeadingStyle = {
  fontFamily: fonts.body,
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: colors.inkSoft,
  margin: "0 0 6px",
  padding: "0 4px",
};

function sidebarItemStyle(active) {
  return {
    display: "block",
    width: "100%",
    textAlign: "left",
    border: "none",
    background: active ? colors.mossDark : "transparent",
    color: active ? colors.onDark : colors.ink,
    borderRadius: "8px",
    padding: "8px 10px",
    marginBottom: "2px",
    fontFamily: fonts.body,
    fontSize: "14px",
    cursor: "pointer",
  };
}

export default function Admin() {
  const permissions = usePermissions();
  const isMobile = useIsMobile();
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

  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  if (tabs.length === 0) {
    return <p style={{ color: colors.inkSoft }}>You don't have access to this section.</p>;
  }

  const ActiveComponent = tabsByKey[activeTab]?.Component;

  const nav = (
    <>
      {visibleGroups.map((g) => (
        <div key={g.name} style={{ marginBottom: "18px" }}>
          <div style={groupHeadingStyle}>{g.name}</div>
          {g.tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} style={sidebarItemStyle(activeTab === t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      ))}
    </>
  );

  return (
    <div>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0, marginBottom: "16px" }}>Admin</h1>
      {isMobile ? (
        <div>
          <div style={{ background: colors.paper, border: `1px solid ${colors.line}`, borderRadius: "12px", padding: "12px 10px", marginBottom: "16px" }}>
            {nav}
          </div>
          {ActiveComponent && <ActiveComponent />}
        </div>
      ) : (
        <div style={{ display: "flex", gap: "28px", alignItems: "flex-start" }}>
          <nav style={{ width: "200px", flexShrink: 0 }}>{nav}</nav>
          <div style={{ flex: 1, minWidth: 0 }}>{ActiveComponent && <ActiveComponent />}</div>
        </div>
      )}
    </div>
  );
}
