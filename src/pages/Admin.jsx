import { useState, useEffect } from "react";
import { usePermissions } from "../lib/permissions.js";
import JobTemplatesTab from "./admin/JobTemplatesTab.jsx";
import ActivityTypesTab from "./admin/ActivityTypesTab.jsx";
import SafetyLibraryTab from "./admin/SafetyLibraryTab.jsx";
import RolesPermissionsTab from "./admin/RolesPermissionsTab.jsx";
import JobAssignmentTab from "./admin/JobAssignmentTab.jsx";
import UsersTab from "./admin/UsersTab.jsx";
import SchedulesTab from "./admin/SchedulesTab.jsx";
import EquipmentTypesTab from "./admin/EquipmentTypesTab.jsx";
import EquipmentTab from "./admin/EquipmentTab.jsx";
import CommonFaultDescriptionsTab from "./admin/CommonFaultDescriptionsTab.jsx";
import RfidTagsTab from "./admin/RfidTagsTab.jsx";
import KeyTagsTab from "./admin/KeyTagsTab.jsx";
import KeyActivityLogTab from "./admin/KeyActivityLogTab.jsx";
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
  { key: "faultDescriptions", label: "Common Faults", Component: CommonFaultDescriptionsTab, permission: "can_manage_equipment_status" },
  { key: "checkoutLog", label: "Checkout Log", Component: EquipmentCheckoutLogTab, permission: "can_manage_equipment_status" },
  { key: "rfid", label: "RFID Fobs", Component: RfidTagsTab, permission: "can_manage_users" },
  { key: "keyTags", label: "Key Tags", Component: KeyTagsTab, permission: "can_manage_keys" },
  { key: "keyActivity", label: "Key Activity Log", Component: KeyActivityLogTab, permission: "can_manage_keys" },
  { key: "roleKeyReasons", label: "Key Reasons by Role", Component: RoleKeyReasonsTab, permission: "can_manage_keys" },
  { key: "contractors", label: "Contractors", Component: ContractorsTab, permission: "can_manage_contractors" },
  { key: "groups", label: "Groups", Component: GroupsTab, permission: "can_manage_users" },
  { key: "roles", label: "Roles & Permissions", Component: RolesPermissionsTab, permission: "can_manage_roles_and_permissions" },
  { key: "jobAssignment", label: "Job Assignment", Component: JobAssignmentTab, permission: "can_manage_roles_and_permissions" },
  { key: "users", label: "Users", Component: UsersTab, permission: "can_manage_users" },
];

export default function Admin() {
  const permissions = usePermissions();
  const tabs = ALL_TABS.filter((t) => permissions.has(t.permission));
  const [activeTab, setActiveTab] = useState(null);

  useEffect(() => {
    if (tabs.length > 0 && !tabs.some((t) => t.key === activeTab)) {
      setActiveTab(tabs[0].key);
    }
  }, [tabs, activeTab]);

  if (tabs.length === 0) {
    return <p style={{ color: colors.inkSoft }}>You don't have access to this section.</p>;
  }

  const ActiveComponent = tabs.find((t) => t.key === activeTab)?.Component;

  return (
    <div>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Admin</h1>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              border: `1px solid ${activeTab === t.key ? colors.mossDark : colors.lineStrong}`,
              background: activeTab === t.key ? colors.mossDark : "transparent",
              color: activeTab === t.key ? "#FFFFFF" : colors.inkSoft,
              borderRadius: "999px",
              padding: "8px 16px",
              fontFamily: fonts.body,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {ActiveComponent && <ActiveComponent />}
    </div>
  );
}
