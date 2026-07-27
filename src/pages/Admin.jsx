import { useState, useEffect } from "react";
import { usePermissions } from "../lib/permissions.js";
import JobTemplatesTab from "./admin/JobTemplatesTab.jsx";
import ActivityTypesTab from "./admin/ActivityTypesTab.jsx";
import SafetyLibraryTab from "./admin/SafetyLibraryTab.jsx";
import RolesPermissionsTab from "./admin/RolesPermissionsTab.jsx";
import { colors, fonts } from "../lib/theme.js";

const ALL_TABS = [
  { key: "templates", label: "Job Templates", Component: JobTemplatesTab, permission: "can_manage_reference_data" },
  { key: "activities", label: "Activity Types", Component: ActivityTypesTab, permission: "can_manage_reference_data" },
  { key: "library", label: "Safety Library", Component: SafetyLibraryTab, permission: "can_manage_reference_data" },
  { key: "roles", label: "Roles & Permissions", Component: RolesPermissionsTab, permission: "can_manage_roles_and_permissions" },
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
