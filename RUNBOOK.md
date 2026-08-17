# Running this against Supabase

This app needs its **own** Supabase project — separate from Tree Tops Hub's
(`qkbpsqlrzygcairtidye`). Nothing here should touch that project.

## 1. Create the project

1. https://supabase.com/dashboard → New project.
2. Note the **Project URL** and **anon public key** (Settings → API) —
   these go in `.env` (copy `.env.example`) for local dev, and as
   repo/host secrets for any deployed build later.
3. Note the **service role key** too (Settings → API) — needed for the
   seed script and Edge Functions. Never put this in `.env` /
   `VITE_`-prefixed vars — it must never reach the browser.

## 2. Run the SQL, in this exact order

SQL Editor → paste each file's contents → Run. All four are idempotent
(safe to re-run if something fails partway and you fix it and retry).

1. `supabase/01-schema.sql` — every table.
2. `supabase/02-rls-policies.sql` — every RLS policy and helper function.
3. `supabase/03-seed-treetops.sql` — Tree Tops org/site/roles/groups/
   statuses/terminology. **Before running**: open it and check the
   `role_visibility` block — it currently assumes "own role only" means
   literal self-visibility per role, flagged inline as pending your
   confirmation.
4. `supabase/04-storage.sql` — creates the `job-photos` and
   `fault-photos` storage buckets and their access policies.

## 3. Invite the team

1. Edit `scripts/seed-users.mjs` — replace the four
   `@placeholder.example.com` addresses with real ones.
2. Run it locally (needs Node — already installed on this machine):
   ```
   $env:SUPABASE_URL="https://<your-project-ref>.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="<service role key>"
   node scripts/seed-users.mjs
   ```
   This sends each person a Supabase invite email, creates their
   `profiles` row, adds them to their group, and scopes them to the
   Tree Tops site.

## 4. Web Push (VAPID keys)

Generate a key pair once:
```
npx web-push generate-vapid-keys
```
- Public key → `.env`'s `VITE_VAPID_PUBLIC_KEY` (and wherever the built
  app's env vars are configured once it's hosted).
- Both keys → Edge Function secrets (step 6).

## 5. Deploy the Edge Functions

Needs the Supabase CLI (`npm install -g supabase`), then from the repo
root:
```
supabase link --project-ref <your-project-ref>
supabase functions deploy generate-scheduled-jobs
supabase functions deploy send-notice-push
supabase functions deploy flush-dnd-notifications
supabase functions deploy manage-users
supabase functions deploy rfid-login
supabase functions deploy send-contractor-job-email
supabase functions deploy contractor-document-reminders
```

## 6. Set Edge Function secrets

```
supabase secrets set VAPID_PUBLIC_KEY=<public key from step 4>
supabase secrets set VAPID_PRIVATE_KEY=<private key from step 4>
supabase secrets set VAPID_SUBJECT=mailto:andy@treetopscaravanpark.co.uk
supabase secrets set RESEND_API_KEY=<your Resend API key>
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
for every Edge Function — no need to set those yourself. `RESEND_API_KEY`
is needed by `send-contractor-job-email` and `contractor-document-reminders`
(both send via Resend) — get one from resend.com and verify the
`treetopscaravanpark.co.uk` sending domain there first, or emails will fail.

## 7. Schedule the daily cron functions

This project has no Cron UI in the Dashboard (not under Edge Functions,
not under Database) — scheduling is done directly via SQL (`pg_cron` +
`pg_net`, both already enabled on this project). Two functions need this:
- `generate-scheduled-jobs` — expands recurring job schedules.
- `contractor-document-reminders` — raises an Office job + emails the
  contractor 7 days before a contractor document expires.

Dashboard → SQL Editor → run, once per function (needs a service-role
secret key from Settings → API — the `sb_secret_...` one, not the anon
key):

```sql
select cron.schedule(
  '<function-name>-daily',
  '0 6 * * *',
  $$
  select
    net.http_post(
        url:='https://<project-ref>.supabase.co/functions/v1/<function-name>',
        headers:='{"Authorization":"Bearer <service-role secret key>"}'::jsonb,
        timeout_milliseconds:='5000'
    );
  $$
);
```

Check what's currently scheduled with `select jobname, schedule, active
from cron.job;`; remove one with `select
cron.unschedule('<function-name>-daily');`.

## 8. Local dev

```
cp .env.example .env   # fill in the three values from steps 1 and 4
npm install
npm run dev
```

## What's NOT done yet

- No hosting/deploy pipeline chosen (Hub uses GitHub Pages via GitHub
  Actions on push to `main` — this app has no such workflow yet; ask if
  you want the same pattern).
- Pitch CSV not supplied — `pitches` only has a `pitch_number_or_name`
  column until you send the real data.
- `role_visibility` beyond Head Gardener needs your confirmation (see
  step 2.3 above).
- Genuine offline testing (aeroplane mode, per Section 10 step 10 of
  BUILD-BRIEF.md) hasn't been done — needs a live project to test
  against first.
