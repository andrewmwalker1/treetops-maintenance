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
// Section 3 doesn't define a pause/active flag on `schedules`, so every
// row is currently treated as active — add an `is_active` column and
// filter on it here if Andy wants to pause a schedule without deleting
// it.

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

Deno.serve(async () => {
  const { data: schedules, error: schedulesError } = await supabase
    .from("schedules")
    .select("id, org_id, site_id, job_type_id, rrule, lead_in_days, last_generated_date, job_types(name)");

  if (schedulesError) {
    return new Response(JSON.stringify({ error: schedulesError.message }), { status: 500 });
  }

  const today = new Date();
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

      const jobTypeName = schedule.job_types?.name ?? "Scheduled job";

      for (const occurrence of dueOccurrences) {
        const dueDate = toDateOnly(occurrence);
        const { error: insertError } = await supabase.from("jobs").insert({
          org_id: schedule.org_id,
          site_id: schedule.site_id,
          job_type_id: schedule.job_type_id,
          schedule_id: schedule.id,
          description: jobTypeName,
          priority: "medium",
          status_id: openStatus.id,
          due_date: dueDate,
          lead_in_date: toDateOnly(addDays(occurrence, -(schedule.lead_in_days ?? 0))),
          created_by: null,
        });
        if (insertError) {
          results.push({ schedule_id: schedule.id, occurrence: dueDate, error: insertError.message });
        } else {
          results.push({ schedule_id: schedule.id, occurrence: dueDate, created: true });
        }
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

  return new Response(JSON.stringify({ results }), { headers: { "Content-Type": "application/json" } });
});
