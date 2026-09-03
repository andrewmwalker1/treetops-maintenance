#!/usr/bin/env node
// Guardrail for BUILD-BRIEF.md section 8 / CLAUDE.md's "UI rules": every
// colour and control in the app is supposed to come from a token and
// src/ui/, never a literal hex or a raw `<button style={{}}>`. Nothing
// enforced that until now -- this is what does.
//
// Deliberately scoped to files CHANGED in the current push, not the whole
// tree: the goal is to stop new drift, not retroactively fail on whatever
// was already there before this script existed (there is some -- see
// UI-REDESIGN-PLAN.md section 8c). Wired in as a non-blocking step in
// .github/workflows/deploy.yml; flip it to blocking once it has run clean
// on a few pushes.
//
// Usage:
//   node scripts/check-styles.mjs              # diff against HEAD~1 (local)
//   CHECK_STYLES_BASE=<sha> node scripts/check-styles.mjs   # diff against a specific commit (CI)

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const EXCLUDED = [
  /^src\/components\/Printable/,
  /^src\/lib\/printJobCards\.jsx$/,
];

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function resolveBase() {
  const fromEnv = process.env.CHECK_STYLES_BASE;
  // GitHub sets `before` to this sentinel on a branch's first-ever push --
  // there is no real prior commit to diff against.
  const NO_PARENT = "0000000000000000000000000000000000000000";
  if (fromEnv && fromEnv !== NO_PARENT) return fromEnv;

  try {
    return git(["rev-parse", "HEAD~1"]);
  } catch {
    return null;
  }
}

function changedJsxFiles(base) {
  let files;
  try {
    files = git(["diff", "--name-only", "--diff-filter=ACMR", base, "HEAD"]).split("\n").filter(Boolean);
  } catch (err) {
    console.warn(`check-styles: couldn't diff against ${base} (${err.message.split("\n")[0]}) -- skipping.`);
    return [];
  }
  return files.filter((f) => f.startsWith("src/") && f.endsWith(".jsx") && !EXCLUDED.some((re) => re.test(f)));
}

// Balanced-brace scan for the end of a JSX opening tag -- a plain regex
// breaks the moment a `style={{ ... }}` value contains its own `{}`.
function endOfOpenTag(src, from) {
  let depth = 0;
  for (let j = from; j < src.length; j++) {
    const ch = src[j];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return j;
  }
  return -1;
}

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

// Only flags a hex colour actually inside a `style={{ ... }}` value, not
// one mentioned in a comment or a string elsewhere in the file (e.g. a
// changelog note quoting a token's value) -- BUILD-BRIEF.md-style prose
// about colours lives in .md files this script never looks at, but a JSX
// comment referencing a hex is a real, if rare, case worth not flagging.
const HEX_RE = /#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?:[0-9A-Fa-f]{2})?\b/g;

function findViolations(file, src) {
  const violations = [];

  let i = 0;
  while (true) {
    const idx = src.indexOf("style={{", i);
    if (idx === -1) break;
    const braceStart = idx + "style=".length; // the opening "{" of the outer JSX-expression brace
    const end = endOfOpenTag(src, braceStart);
    const region = end === -1 ? src.slice(braceStart, braceStart + 400) : src.slice(braceStart, end);
    let m;
    while ((m = HEX_RE.exec(region))) {
      violations.push({
        line: lineOf(src, idx + (m.index + "style=".length)),
        rule: "literal-hex",
        detail: m[0],
      });
    }
    i = idx + 1;
  }

  i = 0;
  while (true) {
    const idx = src.indexOf("<button", i);
    if (idx === -1) break;
    // guard against matching inside e.g. `<buttonGroup` (not real in this
    // codebase, but cheap to guard)
    if (/[A-Za-z0-9_-]/.test(src[idx + "<button".length] || "")) {
      i = idx + "<button".length;
      continue;
    }
    const end = endOfOpenTag(src, idx);
    if (end === -1) break;
    const tag = src.slice(idx, end + 1);
    if (/\bstyle=/.test(tag)) {
      violations.push({ line: lineOf(src, idx), rule: "raw-button-style", detail: "<button ... style=...>" });
    }
    i = end + 1;
  }

  return violations;
}

function main() {
  const base = resolveBase();
  if (!base) {
    console.log("check-styles: no base commit to diff against (first commit in the repo?) -- skipping.");
    return 0;
  }

  const files = changedJsxFiles(base);
  if (files.length === 0) {
    console.log(`check-styles: no changed .jsx files under src/ since ${base.slice(0, 8)}.`);
    return 0;
  }

  let total = 0;
  for (const file of files) {
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue; // deleted since the diff was computed, or a rename -- nothing to check
    }
    const violations = findViolations(file, src);
    for (const v of violations) {
      total++;
      const what =
        v.rule === "literal-hex"
          ? `literal hex colour ${v.detail} in a style prop`
          : `raw <button ...> carrying its own style= (use <Button> from src/ui/ instead)`;
      console.log(`${file}:${v.line}: ${what}`);
    }
  }

  if (total > 0) {
    console.log(
      `\ncheck-styles: ${total} issue${total === 1 ? "" : "s"} in ${files.length} changed file${files.length === 1 ? "" : "s"}.\n` +
        "See CLAUDE.md's UI rules / BUILD-BRIEF.md section 8 -- colour and size come from a token, controls come from src/ui/.\n" +
        "This check is currently a warning, not a blocker (see .github/workflows/deploy.yml)."
    );
  } else {
    console.log(`check-styles: clean (${files.length} changed .jsx file${files.length === 1 ? "" : "s"} checked).`);
  }

  return total > 0 ? 1 : 0;
}

process.exit(main());
