import { usePermissions } from "../lib/permissions.js";
import { colors, fonts } from "../lib/theme.js";

// Same shape as TimesheetsGate.jsx: Layout.jsx's nav already hides the
// "Sales" link without this permission, but that's UI-only, so a
// typed-in /sales URL needs the same turn-away. Real enforcement is RLS
// on the crm_ tables either way.
export default function SalesGate({ children }) {
  const permissions = usePermissions();

  if (permissions.size > 0 && !permissions.has("can_use_sales_crm")) {
    return (
      <div style={{ textAlign: "center", padding: "var(--space-8) var(--space-5)" }}>
        <p style={{ fontFamily: fonts.body, fontSize: "var(--text-base)", color: colors.inkSoft, maxWidth: "var(--width-sm)", margin: "0 auto" }}>
          This account doesn't have access to Sales.
        </p>
      </div>
    );
  }

  return children;
}
