/**
 * Compliance grep (BUILD PROMPT Section 13). Scans player-facing source —
 * components, pages, and copy constants — for banned strings. Fails CI on any hit.
 *
 *   npm run compliance:grep
 *
 * Scope: UI banned list everywhere player-facing; Form banned list additionally
 * over the Form copy surfaces (FormReadout + scoring formBeat templates).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { scanForBanned } from "../src/lib/compliance";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

// Player-facing surfaces: everything a player can see.
const UI_DIRS = ["src/components", "src/pages"];
// Files that carry copy constants shown to players.
const UI_FILES = ["src/lib/consent.ts", "src/lib/trials.ts", "src/lib/dimensions.ts"];
// Form copy surfaces (Section 8 language law also applies).
const FORM_FILES = ["src/components/session/FormReadout.tsx", "src/lib/server/runs.ts"];
// The compliance module itself defines the banned lists — skip it.
const SKIP = new Set(["src/lib/compliance.ts"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(tsx?|css|md)$/.test(name)) out.push(p);
  }
  return out;
}

let failures = 0;

/**
 * Blank out source comments (//, /* *​/, {/* *​/}) — the ban governs player-
 * visible copy, not code commentary. Replacement preserves offsets/newlines so
 * reported line numbers stay accurate.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1: string) => p1 + " ".repeat(m.length - p1.length));
}

function check(file: string, scope: "ui" | "form") {
  const rel = relative(ROOT, file).replace(/\\/g, "/");
  if (SKIP.has(rel)) return;
  const text = stripComments(readFileSync(file, "utf8"));
  const hits = scanForBanned(text, scope);
  for (const h of hits) {
    failures++;
    const line = text.slice(0, h.index).split("\n").length;
    console.error(`✗ ${rel}:${line} banned phrase (${scope}): "${h.phrase}"`);
  }
}

for (const dir of UI_DIRS) {
  for (const f of walk(join(ROOT, dir))) check(f, "ui");
}
for (const f of UI_FILES) check(join(ROOT, f), "ui");
for (const f of FORM_FILES) check(join(ROOT, f), "form");

if (failures) {
  console.error(`\nCompliance grep FAILED: ${failures} hit(s).`);
  process.exit(1);
}
console.log("Compliance grep passed: no banned strings in player-facing source.");
