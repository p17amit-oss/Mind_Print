/**
 * Migration runner. Applies migrations/*.sql in filename order, tracking applied
 * files in a schema_migrations table so re-runs are idempotent.
 *
 *   npm run migrate
 *
 * Requires POSTGRES_URL (Neon) in the environment.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "@vercel/postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "migrations");

/**
 * Split a SQL file into individual statements, respecting dollar-quoted blocks
 * ($$ … $$) so future function bodies don't get chopped on internal semicolons.
 */
function splitStatements(source: string): string[] {
  const statements: string[] = [];
  let current = "";
  let dollarTag: string | null = null;
  const lines = source.split("\n");

  for (const rawLine of lines) {
    const line = rawLine.replace(/--.*$/, ""); // strip line comments
    let i = 0;
    while (i < line.length) {
      if (dollarTag) {
        const end = line.indexOf(dollarTag, i);
        if (end === -1) {
          current += line.slice(i) + "\n";
          i = line.length;
        } else {
          current += line.slice(i, end + dollarTag.length);
          i = end + dollarTag.length;
          dollarTag = null;
        }
        continue;
      }
      const dollarMatch = line.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (dollarMatch) {
        dollarTag = dollarMatch[0];
        current += dollarMatch[0];
        i += dollarMatch[0].length;
        continue;
      }
      const ch = line[i];
      if (ch === ";") {
        if (current.trim()) statements.push(current.trim());
        current = "";
        i++;
      } else {
        current += ch;
        i++;
      }
    }
    current += "\n";
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

async function main() {
  await sql`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const already = await sql`SELECT 1 FROM schema_migrations WHERE filename = ${file}`;
    if (already.rowCount) {
      console.log(`✓ ${file} (already applied)`);
      continue;
    }
    const source = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    const statements = splitStatements(source);
    console.log(`→ ${file} (${statements.length} statements)`);
    for (const stmt of statements) {
      await sql.query(stmt);
    }
    await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`;
    console.log(`✓ ${file}`);
  }
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
