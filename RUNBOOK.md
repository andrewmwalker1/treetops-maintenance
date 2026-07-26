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
```

## 6. Set Edge Function secrets

```
supabase secrets set VAPID_PUBLIC_KEY=<public key from step 4>
supabase secrets set VAPID_PRIVATE_KEY=<private key from step 4>
supabase secrets set VAPID_SUBJECT=mailto:andy@treetopscaravanpark.co.uk
```
`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically
for every Edge Function — no need to set those yourself.

## 7. Schedule the daily job generator

Simplest option: Dashboard → Edge Functions → `generate-scheduled-jobs`
→ Cron tab → add a daily schedule (e.g. `0 6 * * *` for 6am).

(If you'd rather do it in SQL via `pg_cron` + `pg_net` instead of the
dashboard UI, ask me once the function is deployed and I'll write the
exact statement — it needs the deployed function's URL and a bearer
token, which only exist after step 5.)

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
