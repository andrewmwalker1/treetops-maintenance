# Running this against Supabase

*Adapted, de-identified setup steps for standing up your own, completely
independent copy of this platform — your own GitHub repo, your own
Supabase project, your own domain. Nothing here should ever point at
anyone else's Supabase project, GitHub repo, or deployed site.*

This app needs its **own** Supabase project. Never point it at any other
Supabase project — yours or anyone else's — that already has other data
in it.

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
3. `supabase/03-seed-<your-org>.sql` — write this one yourself for your
   own organisation/site/roles/groups/statuses/terminology (see Section 9
   of `BUILD-BRIEF.md` for the shape to follow — don't copy the original
   business's roles/groups verbatim). **Before running**: decide your own
   `role_visibility` matrix deliberately rather than defaulting every role
   to "sees only its own jobs."
4. `supabase/04-storage.sql` — creates the `job-photos` and
   `fault-photos` storage buckets and their access policies.
5. Then run every remaining numbered file in `supabase/` in order — each
   is idempotent, safe to re-run. See `SYSTEMSPEC.md` §4 for what each one
   adds.

## 3. Invite the team

1. Edit `scripts/seed-users.mjs` — replace the placeholder addresses with
   your own team's real email addresses (don't leave any as placeholders
   to fill in "later" — invite real people from the start).
2. Run it locally (needs Node):
   ```
   $env:SUPABASE_URL="https://<your-project-ref>.supabase.co"
   $env:SUPABASE_SERVICE_ROLE_KEY="<service role key>"
   node scripts/seed-users.mjs
   ```
   This sends each person a Supabase invite email, creates their
   `profiles` row, adds them to their group, and scopes them to the
   site.

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
supabase secrets set VAPID_SUBJECT=mailto:you@your-domain.example
supabase secrets set RESEND_API_KEY=<your Resend API key>
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
for every Edge Function — no need to set those yourself. `RESEND_API_KEY`
is needed by `send-contractor-job-email` and `contractor-document-reminders`
(both send via Resend) — get one from resend.com and verify your own
sending domain there first, or emails will fail.

## 7. Schedule the daily cron functions

This project has no Cron UI in the Dashboard (not under Edge Functions,
not under Database) — scheduling is done directly via SQL (`pg_cron` +
`pg_net`, both already enabled on this project). Two functions need this:
- `generate-scheduled-jobs` — expands recurring job schedules.
- `contractor-document-reminders` — raises a job for whichever role/group
  you assign it to, and emails the contractor, 7 days before a contractor
  document expires.

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

## 9. Deploying (GitHub Pages)

The original deployment used GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`), triggered on push to `main`, with a
custom domain via `public/CNAME`. That workflow file is generic and
should work as-is once you point the repo's secrets
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`)
at your own Supabase project — see `SYSTEMSPEC.md` §15. Set your own
`public/CNAME` (or delete it and use the default `github.io` URL) rather
than reusing the original domain.

## Before you consider this "live" — a checklist, not a status report

Unlike the original `RUNBOOK.md` this is adapted from (which tracked
specific outstanding items for one business), treat this as a checklist
for your own go-live rather than a report of what's already done, since
none of it has been done yet for your deployment:

- [ ] Your own location/pitch data loaded (a placeholder structure is
  fine to start with — see `SYSTEMSPEC.md` §4.1).
- [ ] Your own `role_visibility` matrix confirmed deliberately, not
  defaulted.
- [ ] Genuine offline testing done (aeroplane mode, not just devtools
  network throttling) — see `BUILD-BRIEF.md` §10, step 10.
- [ ] Read the multi-site limitation callout at the top of
  `BUILD-BRIEF.md` and confirmed you're happy running single-site, or
  scoped the extra admin UI work needed if not.
- [ ] Supabase backup/DR tier reviewed against your own actual scale.
