# Handoff package: sharing this system with someone else

This folder is a self-contained starting kit for anyone who wants to
build their own, completely independent copy of this maintenance + H&S
job-tracking platform — a different business, no shared code, no shared
database, no shared secrets, no shared GitHub repo.

It contains three documents, de-identified from the working system this
was built from (names, real staff, secrets, and the original domain have
all been stripped out and replaced with placeholders):

- **`BUILD-BRIEF.md`** — the short version: what to build, the
  architecture decisions, the data model, and a suggested build order.
  Read the callout at the top first — it explains the one real limitation
  (no multi-site admin UI) before anything else.
- **`SYSTEMSPEC.md`** — the long version: a detailed, accurate
  specification of everything the original working system actually does,
  screen by screen, rule by rule. This is what makes the rebuild a
  faithful copy rather than a rough guess from the brief alone.
- **`RUNBOOK.md`** — the practical setup steps: create a Supabase project,
  run the SQL, deploy the Edge Functions, deploy to GitHub Pages.

## How to actually use this

1. **Create a brand-new, empty GitHub repository** under your own GitHub
   account. Don't fork or clone the original app's repo — start empty.
2. **Create a brand-new Supabase project** under your own Supabase
   account. Don't reuse anyone else's project.
3. Copy these three files into the root of your new repo.
4. Open a Claude Code session **in your new repo** and hand it
   `BUILD-BRIEF.md` (it explicitly says "hand this to Claude Code
   as-is") — point it at `SYSTEMSPEC.md` for the full behavioural detail
   as it builds. Claude Code will write the actual application code fresh,
   into your repo, against your Supabase project.
5. Follow `RUNBOOK.md` for the Supabase/deployment side as the build
   progresses.

Nothing in this folder contains working source code, API keys, or a
database connection — that's deliberate. It's a specification for
building your own separate thing, not a copy of the original app.
