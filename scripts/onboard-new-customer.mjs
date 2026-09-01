// Tree Tops Maintenance Platform -- new-customer onboarding script.
//
// Run this ONCE, by hand, against a brand new/empty Supabase project to
// stand up an independent copy of this app for someone else's business.
// It is not part of the deployed app and never runs in a browser -- it
// needs a *direct* Postgres connection, which only exists outside the
// app (Supabase's JS client has no "run arbitrary SQL" call).
//
// What it does, in order:
//   1. Reads every supabase/NN-*.sql file in this repo, in numeric order.
//   2. Skips 05-seed-pitches.sql outright (that's Tree Tops' own 206
//      pitch codes) and replaces it with your own pitch/unit list from a
//      CSV you supply.
//   3. Templates 03-seed-treetops.sql: every occurrence of the quoted
//      string 'Tree Tops Caravan Park Ltd' becomes your business name,
//      and the quoted site name 'Tree Tops' becomes the first site name
//      you give it. Everything else in that file -- default roles,
//      groups, job statuses, terminology, the Admin permission grant --
//      runs unchanged, so your fork gets the same starting point Tree
//      Tops did.
//   4. Runs every other file byte-for-byte as it exists in this repo.
//      Several of them end with a grant like
//        where r.org_id = (select id from organisations where name = 'Tree Tops Caravan Park Ltd')
//      Since your database has no org by that name, that clause matches
//      zero rows and quietly grants nothing -- it does NOT error. Those
//      permissions already exist (the schema/permission-key definitions
//      in the same files are generic); you just switch them on for your
//      own roles afterward from inside the app itself
//      (Admin -> Roles & Permissions), same as any other permission
//      change.
//   5. If you gave it additional site names beyond the first, inserts
//      those as plain rows once the org exists.
//   6. If you gave it a pitches/units CSV, imports it.
//   7. Rewrites CLAUDE.md from scripts/CLAUDE.md.template with your
//      business name filled in, so Claude Code already understands this
//      app's architecture and rules from your very first session with
//      it -- no re-explaining needed. BUILD-BRIEF.md/RUNBOOK.md/
//      SYSTEMSPEC.md are left as they are (they're Tree Tops' own build
//      history, not yours -- the new CLAUDE.md says so and doesn't
//      depend on them; delete them whenever you like).
//
// What it deliberately does NOT do (do these yourself afterward):
//   - Create your first login. See scripts/seed-users.mjs -- it already
//     has the right shape, you just need to change its ORG_NAME/
//     SITE_NAME constants (or the two env vars it now also accepts, see
//     that file's header) and your own user list, then run it with your
//     project's service role key.
//   - Set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (Supabase dashboard
//     -> Settings -> API) in a local .env and as GitHub Actions secrets
//     on your fork, so `npm run dev` and the deploy workflow can connect.
//   - Generate your own VAPID keypair for push notifications if you want
//     that feature, and set VITE_VAPID_PUBLIC_KEY / the matching Edge
//     Function secret.
//   - Update the PWA manifest branding (name/short_name/description) in
//     vite.config.js -- it's hardcoded to "Tree Tops Maintenance".
//
// Usage:
//   npm install                     (installs pg, added for this script)
//   node scripts/onboard-new-customer.mjs
//
// It will ask for:
//   - A *direct* Postgres connection string (Supabase dashboard ->
//     Project Settings -> Database -> Connection string -> URI ->
//     "Direct connection". Not the pooled/transaction one -- this script
//     runs long multi-statement DO blocks that need a plain session.)
//   - Your business name.
//   - One or more site names (you run multiple sites -- add each one;
//     blank line to stop).
//   - Optionally, a path to a pitches/units CSV with columns
//     site_name,pitch_number_or_name (a header row, then one row per
//     pitch/unit -- site_name must match one of the site names you just
//     entered).
//
// Safe to re-run: every statement in every file here is written
// idempotently (on conflict do nothing / create if not exists), same as
// they are for Tree Tops' own database.

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createInterface } from "readline/promises";
import pg from "pg";
import Papa from "papaparse";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_DIR = join(__dirname, "..", "supabase");

const ORG_NAME_LITERAL = "'Tree Tops Caravan Park Ltd'";
const SITE_NAME_LITERAL = "'Tree Tops'";
const SKIP_FILES = new Set(["05-seed-pitches.sql"]);
const SEED_ORG_FILE = "03-seed-treetops.sql";

function escapeSqlLiteral(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function prompt(rl, question, { required = true } = {}) {
  while (true) {
    const answer = (await rl.question(question)).trim();
    if (answer || !required) return answer;
    console.log("  (required)");
  }
}

async function promptList(rl, question) {
  const items = [];
  console.log(question);
  while (true) {
    const line = (await rl.question(`  ${items.length === 0 ? "1" : items.length + 1}) `)).trim();
    if (!line) break;
    items.push(line);
  }
  return items;
}

function listSqlFilesInOrder() {
  return readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

async function runFile(client, filename, sql) {
  process.stdout.write(`  Running ${filename}... `);
  try {
    await client.query(sql);
    console.log("done");
  } catch (err) {
    console.log("FAILED");
    throw new Error(`${filename}: ${err.message}`);
  }
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("Tree Tops Maintenance Platform -- new customer onboarding\n");

  const connectionString = await prompt(
    rl,
    "Direct Postgres connection string (Supabase -> Project Settings -> Database -> Direct connection): "
  );
  const businessName = await prompt(rl, "Business name (e.g. Riverside Holiday Homes Ltd): ");
  const siteNames = await promptList(
    rl,
    "Site name(s) -- enter one per line, blank line when done:"
  );
  if (siteNames.length === 0) {
    console.error("At least one site name is required.");
    process.exit(1);
  }
  const csvPath = await prompt(
    rl,
    "Path to a pitches/units CSV (columns: site_name,pitch_number_or_name), or blank to skip: ",
    { required: false }
  );

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  console.log(`\nConnected to: ${client.host}/${client.database}`);
  const existingOrgCount = await client
    .query("select count(*)::int as n from organisations")
    .then((r) => r.rows[0].n)
    .catch(() => null); // table doesn't exist yet on a truly blank database -- treat as empty

  if (existingOrgCount) {
    const confirm = await prompt(
      rl,
      `\nWARNING: this database already has ${existingOrgCount} organisation(s) in it.\n` +
        `This script is meant for a brand new, empty project -- running it against a\n` +
        `database that already has real data in it risks mixing two businesses' data.\n` +
        `Type YES to continue anyway, anything else to stop: `,
      { required: false }
    );
    if (confirm !== "YES") {
      console.log("Stopped -- nothing was run.");
      await client.end();
      rl.close();
      return;
    }
  } else {
    const confirm = await prompt(
      rl,
      `\nAbout to create schema + seed data for "${businessName}" on ${client.host}/${client.database}.\n` +
        `Type YES to continue: `,
      { required: false }
    );
    if (confirm !== "YES") {
      console.log("Stopped -- nothing was run.");
      await client.end();
      rl.close();
      return;
    }
  }

  console.log("\nRunning schema files:");
  for (const filename of listSqlFilesInOrder()) {
    if (SKIP_FILES.has(filename)) {
      console.log(`  Skipping ${filename} (Tree Tops' own pitch list -- replaced by your CSV below)`);
      continue;
    }
    let sql = readFileSync(join(SQL_DIR, filename), "utf8");
    if (filename === SEED_ORG_FILE) {
      sql = sql
        .split(ORG_NAME_LITERAL)
        .join(escapeSqlLiteral(businessName))
        .split(SITE_NAME_LITERAL)
        .join(escapeSqlLiteral(siteNames[0]));
    }
    await runFile(client, filename, sql);
  }

  if (siteNames.length > 1) {
    console.log("\nAdding additional sites:");
    for (const siteName of siteNames.slice(1)) {
      await client.query(
        `insert into public.sites (org_id, name, site_type)
         select id, $1, 'caravan_park' from public.organisations where name = $2
         and not exists (
           select 1 from public.sites s where s.org_id = organisations.id and s.name = $1
         )`,
        [siteName, businessName]
      );
      console.log(`  Added ${siteName}`);
    }
  }

  if (csvPath) {
    console.log(`\nImporting pitches/units from ${csvPath}:`);
    const csvText = readFileSync(csvPath, "utf8");
    const { data: rows, errors: parseErrors } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    if (parseErrors.length) {
      console.error("  CSV parse errors:", parseErrors);
    }

    const { rows: siteRows } = await client.query(
      `select s.id, s.name from public.sites s
       join public.organisations o on o.id = s.org_id
       where o.name = $1`,
      [businessName]
    );
    const siteIdByName = Object.fromEntries(siteRows.map((s) => [s.name, s.id]));

    let imported = 0;
    let skipped = 0;
    for (const row of rows) {
      const siteName = row.site_name?.trim();
      const pitchName = row.pitch_number_or_name?.trim();
      const siteId = siteIdByName[siteName];
      if (!siteId || !pitchName) {
        console.warn(`  Skipping row (unknown site "${siteName}" or missing pitch name):`, row);
        skipped += 1;
        continue;
      }
      await client.query(
        `insert into public.pitches (site_id, pitch_number_or_name)
         values ($1, $2)
         on conflict (site_id, pitch_number_or_name) do nothing`,
        [siteId, pitchName]
      );
      imported += 1;
    }
    console.log(`  Imported ${imported} pitch(es)/unit(s), skipped ${skipped}.`);
  } else {
    console.log("\nNo pitches CSV given -- you can import one later by re-running this script, or add pitches by hand in Supabase.");
  }

  await client.end();
  rl.close();

  console.log("\nSetting up CLAUDE.md for your own copy:");
  const templatePath = join(__dirname, "CLAUDE.md.template");
  const claudeMdPath = join(__dirname, "..", "CLAUDE.md");
  const claudeMdContent = readFileSync(templatePath, "utf8").split("{{BUSINESS_NAME}}").join(businessName);
  writeFileSync(claudeMdPath, claudeMdContent);
  console.log("  Written to CLAUDE.md -- Claude Code will read this automatically from now on.");

  console.log(`
Done. "${businessName}" is set up with ${siteNames.length} site(s).

Still to do by hand:
  1. Create your first login -- edit the ORG_NAME/SITE_NAME constants (or
     set the env vars) at the top of scripts/seed-users.mjs to match what
     you just entered, put your own name/email in its SEED_USERS list,
     and run it with your project's service role key.
  2. Put VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (Settings -> API in
     the Supabase dashboard) into a local .env and into this fork's
     GitHub Actions secrets, so the app and its deploy workflow can
     connect.
  3. In the app itself, once you've logged in: Admin -> Roles &
     Permissions -- grant your Admin role whichever permissions you want
     (the schema files above created the permission keys, but couldn't
     grant them to a role that didn't exist yet when they ran).
  4. Optional: your own VAPID keypair for push notifications, and your
     own branding in vite.config.js's PWA manifest block.

BUILD-BRIEF.md, RUNBOOK.md and SYSTEMSPEC.md are Tree Tops' own build
history and came across in your copy too -- ignore or delete them
whenever you like, nothing here depends on them.
`);
}

main().catch((err) => {
  console.error("\nOnboarding stopped:", err.message);
  process.exit(1);
});
