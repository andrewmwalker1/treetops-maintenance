// Tree Tops Maintenance Platform — scheduling Edge Function (Section 5).
// Runs daily via pg_cron (see the SQL in the run package). For every
// row in `schedules`, works out which recurring occurrences are now due
// (today >= next_due_date - lead_in_days) and haven't been generated
// yet, and creates a `jobs` row for each with `schedule_id` set.
//
// Uses the service role key deliberately — this runs on a schedule with
// no logged-in user, so it must bypass RLS by design.
//
// `schedules.rrule` should be a full iCalendar RRULE string including a
// DTSTART line, e.g.:
//   DTSTART:20260101T000000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO
// A bare "FREQ=..." string with no DTSTART will fail to parse.
//
// `is_active` (30-schedule-pause-resume.sql) lets a schedule be paused
// without deleting it. On resume, SchedulesTab.jsx resets
// last_generated_date to yesterday so this function picks up only from
// the next due occurrence onward, rather than bursting out a job for
// every occurrence missed while paused.
//
// 31-schedule-fields-and-due-reminders.sql brought schedules up to
// parity with the one-off New Job form (description, priority,
// assignee, location, activity types) and added two push-notification
// touchpoints for a schedule-generated job's assignee: one the moment
// the job is created (with its due date in the message, since that may
// be days away if lead_in_days > 0), and one on the day it's actually
// due if it's still open. The due-reminder pass runs BEFORE generation
// each invocation so a same-day (lead_in_days = 0) job can't be
// reminded and assigned in the same run — it doesn't exist yet when
// that pass runs.

import { createClient } from "npm:@supabase/supabase-js@2";
import { RRule } from "npm:rrule@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function resolveRecipients(assigneeProfileId: string | null, assigneeGroupId: string | null) {
  if (assigneeProfileId) return [assigneeProfileId];
  if (assigneeGroupId) {
    const { data, error } = await supabase.from("group_members").select("profile_id").eq("group_id", assigneeGroupId);
    if (error) {
      console.error("Failed to resolve group members", error);
      return [];
    }
    return (data ?? []).map((row) => row.profile_id);
  }
  return [];
}

// Routes through the send-notice-push function (rather than duplicating
// its webpush + DND + notifications-row logic here) so there's one
// place that owns "how a push actually gets delivered".
async function pushToRecipients(recipientIds: string[], triggerType: string, title: string, body: string, data: unknown) {
  await Promise.all(
    recipientIds.map((recipientProfileId) =>
      supabase.functions
        .invoke("send-notice-push", {
          body: { recipientProfileId, triggerType, priority: "operational", title, body, data },
        })
        .then(({ error }) => {
          if (error) console.error("Failed to push to", recipientProfileId, error);
        })
    )
  );
}

async function sendDueTodayReminders(todayStr: string) {
  const { data: dueToday, error } = await supabase
    .from("jobs")
    .select("id, description, due_date, assignee_profile_id, assignee_group_id, job_statuses(is_completed)")
    .not("schedule_id", "is", null)
    .eq("due_date", todayStr)
    .is("due_reminder_sent_at", null);

  if (error) {
    console.error("Failed to load jobs due today", error);
    return [];
  }

  const results: Record<string, unknown>[] = [];

  for (const job of dueToday ?? []) {
    if (job.job_statuses?.is_completed) continue;
    if (!job.assignee_profile_id && !job.assignee_group_id) continue;

    const recipients = await resolveRecipients(job.assignee_profile_id, job.assignee_group_id);
    if (recipients.length > 0) {
      await pushToRecipients(recipients, "job_due_reminder", "Job due today", job.description, { jobId: job.id });
    }

    const { error: updateError } = await supabase
      .from("jobs")
      .update({ due_reminder_sent_at: new Date().toISOString() })
      .eq("id", job.id);
    if (updateError) {
      results.push({ job_id: job.id, error: updateError.message });
    } else {
      results.push({ job_id: job.id, due_reminder_sent: true });
    }
  }

  return results;
}

Deno.serve(async () => {
  const today = new Date();
  const todayStr = toDateOnly(today);

  const reminderResults = await sendDueTodayReminders(todayStr);

  const { data: schedules, error: schedulesError } = await supabase
    .from("schedules")
    .select(
      "id, org_id, site_id, job_type_id, rrule, lead_in_days, last_generated_date, description, priority, assignee_profile_id, assignee_group_id, pitch_id, area_id, schedule_task_types(task_type_id)"
    )
    .eq("is_active", true);

  if (schedulesError) {
    return new Response(JSON.stringify({ error: schedulesError.message }), { status: 500 });
  }

  const results: Record<string, unknown>[] = [];

  for (const schedule of schedules ?? []) {
    try {
      const rule = RRule.fromString(schedule.rrule);
      const cutoff = addDays(today, schedule.lead_in_days ?? 0);
      const after = schedule.last_generated_date
        ? addDays(new Date(schedule.last_generated_date), 1)
        : rule.options.dtstart;

      const dueOccurrences = rule.between(after, cutoff, true);
      if (dueOccurrences.length === 0) continue;

      const { data: openStatus, error: statusError } = await supabase
        .from("job_statuses")
        .select("id")
        .eq("org_id", schedule.org_id)
        .eq("is_completed", false)
        .order("sort_order", { ascending: true })
        .limit(1)
        .single();
      if (statusError || !openStatus) {
        results.push({ schedule_id: schedule.id, error: "No open job_status found for org" });
        continue;
      }

      const activityTypeIds = (schedule.schedule_task_types ?? []).map((link: { task_type_id: string }) => link.task_type_id);
      const recipients = await resolveRecipients(schedule.assignee_profile_id, schedule.assignee_group_id);

      for (const occurrence of dueOccurrences) {
        const dueDate = toDateOnly(occurrence);
        const { data: insertedJob, error: insertError } = await supabase
          .from("jobs")
          .insert({
            org_id: schedule.org_id,
            site_id: schedule.site_id,
            job_type_id: schedule.job_type_id,
            schedule_id: schedule.id,
            description: schedule.description,
            priority: schedule.priority,
            assignee_profile_id: schedule.assignee_profile_id,
            assignee_group_id: schedule.assignee_group_id,
            pitch_id: schedule.pitch_id,
            area_id: schedule.area_id,
            status_id: openStatus.id,
            due_date: dueDate,
            lead_in_date: toDateOnly(addDays(occurrence, -(schedule.lead_in_days ?? 0))),
            created_by: null,
          })
          .select("id")
          .single();

        if (insertError || !insertedJob) {
          results.push({ schedule_id: schedule.id, occurrence: dueDate, error: insertError?.message ?? "insert returned no row" });
          continue;
        }

        if (activityTypeIds.length > 0) {
          const { error: activityError } = await supabase
            .from("job_activity_types")
            .insert(activityTypeIds.map((task_type_id: string) => ({ job_id: insertedJob.id, task_type_id })));
          if (activityError) console.error("Failed to attach activity types to generated job", insertedJob.id, activityError);
        }

        if (recipients.length > 0) {
          await pushToRecipients(recipients, "job_assigned", "New recurring job assigned to you", `${schedule.description} — due ${dueDate}`, {
            jobId: insertedJob.id,
          });
        }

        results.push({ schedule_id: schedule.id, occurrence: dueDate, created: true });
      }

      const lastOccurrence = dueOccurrences[dueOccurrences.length - 1];
      await supabase
        .from("schedules")
        .update({ last_generated_date: toDateOnly(lastOccurrence) })
        .eq("id", schedule.id);
    } catch (err) {
      results.push({ schedule_id: schedule.id, error: String(err) });
    }
  }

  return new Response(JSON.stringify({ reminders: reminderResults, results }), { headers: { "Content-Type": "application/json" } });
});
