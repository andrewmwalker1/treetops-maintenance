import { useState } from "react";
import { usePermissions } from "../lib/permissions.js";
import JobTemplatesTab from "./admin/JobTemplatesTab.jsx";
import ActivityTypesTab from "./admin/ActivityTypesTab.jsx";
import SafetyLibraryTab from "./admin/SafetyLibraryTab.jsx";
import { colors, fonts } from "../lib/theme.js";

const TABS = [
  { key: "templates", label: "Job Templates", Component: JobTemplatesTab },
  { key: "activities", label: "Activity Types", Component: ActivityTypesTab },
  { key: "library", label: "Safety Library", Component: SafetyLibraryTab },
];

export default function Admin() {
  const permissions = usePermissions();
  const [activeTab, setActiveTab] = useState("templates");

  if (!permissions.has("can_manage_reference_data")) {
    return <p style={{ color: colors.inkSoft }}>You don't have access to this section.</p>;
  }

  const ActiveComponent = TABS.find((t) => t.key === activeTab).Component;

  return (
    <div>
      <h1 style={{ fontFamily: fonts.display, color: colors.mossDark, marginTop: 0 }}>Admin</h1>
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
        {TABS.map((t) => (
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
      <ActiveComponent />
    </div>
  );
}
