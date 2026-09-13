// Universal /holidays destination -- unlike /timesheets, reachable by
// everyone regardless of permissions, since booking/viewing your own
// status needs none (resolved purely via profile_id = auth.uid()). Internal
// tabs: "My Holiday" and "Book" always shown; "Team calendar" needs
// can_submit_timesheet; "Approvals" needs can_approve_holiday or
// can_manage_timesheets -- same gating ApprovalsInbox.jsx's other mount
// point (Office Hub) uses.
import { useState } from "react";
import { usePermissions } from "../../lib/permissions.js";
import { Button, PageHeader } from "../../ui/index.js";
import MyHolidayStatus from "./MyHolidayStatus.jsx";
import MyRequests from "./MyRequests.jsx";
import BookHoliday from "./BookHoliday.jsx";
import TeamHolidayCalendar from "./TeamHolidayCalendar.jsx";
import ApprovalsInbox from "./ApprovalsInbox.jsx";

export default function HolidayHome() {
  const permissions = usePermissions();
  const canSeeTeamCalendar = permissions.has("can_submit_timesheet");
  const canApprove = permissions.has("can_approve_holiday") || permissions.has("can_manage_timesheets");
  const [tab, setTab] = useState("my");

  return (
    <div>
      <PageHeader title="Holiday" />
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
        <Button variant={tab === "my" ? "primary" : "secondary"} onClick={() => setTab("my")}>My Holiday</Button>
        <Button variant={tab === "book" ? "primary" : "secondary"} onClick={() => setTab("book")}>Book</Button>
        {canSeeTeamCalendar && (
          <Button variant={tab === "team" ? "primary" : "secondary"} onClick={() => setTab("team")}>Team calendar</Button>
        )}
        {canApprove && (
          <Button variant={tab === "approvals" ? "primary" : "secondary"} onClick={() => setTab("approvals")}>Approvals</Button>
        )}
      </div>

      {tab === "my" && (
        <>
          <MyHolidayStatus />
          <MyRequests />
        </>
      )}
      {tab === "book" && <BookHoliday />}
      {tab === "team" && canSeeTeamCalendar && <TeamHolidayCalendar />}
      {tab === "approvals" && canApprove && <ApprovalsInbox />}
    </div>
  );
}
