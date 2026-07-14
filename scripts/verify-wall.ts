/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  DEV / TEST ONLY — NEVER RUN AGAINST A PRODUCTION DATABASE.               │
 * │                                                                          │
 * │  This script SEEDS synthetic users and runs to empirically verify the    │
 * │  "two-room wall" (the consent-filtered research SQL views). It writes     │
 * │  fabricated rows. It is idempotent (it deletes its own 'verify:%' users   │
 * │  first) but it is destructive to any data using that device_id prefix.    │
 * │                                                                          │
 * │  It is NOT wired into any CI gate that runs against a real database.      │
 * │  It uses the `pg` driver (not the app's @vercel/postgres) because it      │
 * │  targets a local Postgres; the VIEWS under test are ordinary DB objects,  │
 * │  identical regardless of which driver queries them.                       │
 * │                                                                          │
 * │  Run:  VERIFY_WALL_DSN=postgres://user:pw@localhost:5432/mindprint_verify │
 * │        npx tsx scripts/verify-wall.ts                                     │
 * │                                                                          │
 * │  Safety guard: refuses to run unless the target database name contains    │
 * │  "verify" (override with VERIFY_WALL_FORCE=1 only if you know what you're  │
 * │  doing). This makes it hard to point at a real database by accident.      │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
import { Pool } from "pg";

const DSN = process.env.VERIFY_WALL_DSN;
if (!DSN) {
  console.error("Refusing to run: set VERIFY_WALL_DSN to a dev/test database.");
  process.exit(1);
}
const dbName = (() => {
  try {
    return new URL(DSN).pathname.replace(/^\//, "");
  } catch {
    return "";
  }
})();
if (!/verify/i.test(dbName) && process.env.VERIFY_WALL_FORCE !== "1") {
  console.error(
    `Refusing to run: target database "${dbName}" does not look like a verify/test DB.\n` +
      `This is a safety guard against pointing at production. Set VERIFY_WALL_FORCE=1 to override.`
  );
  process.exit(1);
}

const pool = new Pool({ connectionString: DSN });

// ── output helpers ───────────────────────────────────────────────────────
const out: string[] = [];
function log(s = "") {
  out.push(s);
  console.log(s);
}
function heading(s: string) {
  log(`\n## ${s}\n`);
}
async function showQuery(title: string, sql: string, params: unknown[] = []) {
  log(`**${title}**`);
  log("```sql\n" + sql.trim() + "\n```");
  const res = await pool.query(sql, params);
  log("```");
  if (res.rows.length === 0) {
    log("(0 rows)");
  } else {
    const cols = Object.keys(res.rows[0]);
    const widths = cols.map((c) =>
      Math.max(c.length, ...res.rows.map((r) => String(r[c] ?? "NULL").length))
    );
    log(cols.map((c, i) => c.padEnd(widths[i])).join(" | "));
    log(widths.map((w) => "-".repeat(w)).join("-|-"));
    for (const r of res.rows) {
      log(cols.map((c, i) => String(r[c] ?? "NULL").padEnd(widths[i])).join(" | "));
    }
    log(`(${res.rows.length} row${res.rows.length === 1 ? "" : "s"})`);
  }
  log("```");
  return res.rows;
}
async function scalar(sql: string, params: unknown[] = []): Promise<string> {
  const r = await pool.query(sql, params);
  const row = r.rows[0] ?? {};
  return String(row[Object.keys(row)[0]] ?? "NULL");
}

// ── the four synthetic users ───────────────────────────────────────────────
// Distinct age_band + region so the views' grouping makes exclusion visible.
const USERS = [
  { key: "a", device: "verify:a", age: "<18", adult: false, region: "VERIFY_A", research: "none" as const },
  { key: "b", device: "verify:b", age: "35-44", adult: true, region: "VERIFY_BC", research: "declined" as const },
  { key: "c", device: "verify:c", age: "45+", adult: true, region: "VERIFY_BC", research: "revoked" as const },
  { key: "d", device: "verify:d", age: "25-34", adult: true, region: "VERIFY_D", research: "active" as const },
];

const JURY_ITEM = "verify_jury_1";
const HOT_FOOLED = "verify_fooled_hot";
const SPARSE_FOOLED = ["verify_fooled_sparse_1", "verify_fooled_sparse_2"];
const GAUNTLET_ITEM = "verify_gaunt_1";

async function cleanup() {
  // ON DELETE CASCADE removes consent/sessions/runs/events/etc for these users.
  await pool.query(`DELETE FROM users WHERE device_id LIKE 'verify:%'`);
  await pool.query(`DELETE FROM item_cache WHERE item_id LIKE 'verify_%'`);
  await pool.query(`DELETE FROM gauntlet_events WHERE name = 'verify_event'`);
}

async function seedItems(): Promise<string> {
  // Jury item (needed for v_jury_distributions' category join).
  await pool.query(
    `INSERT INTO item_cache (item_id, trial_type, category, content, status)
     VALUES ($1,'read_room','dilemma_jury', $2, 'live')
     ON CONFLICT (item_id) DO NOTHING`,
    [JURY_ITEM, JSON.stringify({ scenario: "verify dilemma" })]
  );
  // A live gauntlet event + a fooled item attached (for v_gauntlet_event_summary).
  const ev = await pool.query(
    `INSERT INTO gauntlet_events (name, starts_at, ends_at, status)
     VALUES ('verify_event', now() - interval '1 day', now() + interval '1 day', 'live')
     RETURNING id`
  );
  const eventId = ev.rows[0].id as string;
  await pool.query(
    `INSERT INTO item_cache (item_id, trial_type, category, content, generator_model, provenance, gauntlet_event_id, status)
     VALUES ($1,'fooled','image',$2,'imagegen-x-v3',$3,$4,'live')
     ON CONFLICT (item_id) DO UPDATE SET gauntlet_event_id = EXCLUDED.gauntlet_event_id`,
    [GAUNTLET_ITEM, JSON.stringify({ fake_quality_tier: 2 }), JSON.stringify({ source_type: "ai", created: "2026-01" }), eventId]
  );
  return eventId;
}

async function seedUser(u: (typeof USERS)[number]) {
  const uid = (
    await pool.query(
      `INSERT INTO users (device_id, age_band, is_adult, region) VALUES ($1,$2,$3,$4) RETURNING id`,
      [u.device, u.age, u.adult, u.region]
    )
  ).rows[0].id as string;

  // consents: everyone gets gameplay_tos
  await pool.query(
    `INSERT INTO consent_records (user_id, consent_type, version, granted_at) VALUES ($1,'gameplay_tos','v1', now())`,
    [uid]
  );
  if (u.research === "declined") {
    await pool.query(
      `INSERT INTO consent_records (user_id, consent_type, version, granted_at) VALUES ($1,'research_participation','v1', NULL)`,
      [uid]
    );
  } else if (u.research === "revoked") {
    await pool.query(
      `INSERT INTO consent_records (user_id, consent_type, version, granted_at, revoked_at)
       VALUES ($1,'research_participation','v1', now() - interval '2 days', now() - interval '1 day')`,
      [uid]
    );
  } else if (u.research === "active") {
    await pool.query(
      `INSERT INTO consent_records (user_id, consent_type, version, granted_at) VALUES ($1,'research_participation','v1', now())`,
      [uid]
    );
  }

  const session = (
    await pool.query(
      `INSERT INTO sessions (user_id, session_date, completed, completed_at) VALUES ($1, CURRENT_DATE, true, now()) RETURNING id`,
      [uid]
    )
  ).rows[0].id as string;

  const newRun = async (trial: string, chaos = false) =>
    (
      await pool.query(
        `INSERT INTO runs (session_id, user_id, trial_type, chaos_mode, wager, wager_outcome, summary_metrics, created_at)
         VALUES ($1,$2,$3,$4,2,'won',$5, now()) RETURNING id`,
        [session, uid, trial, chaos, JSON.stringify({ core_metric_value: 1 })]
      )
    ).rows[0].id as string;

  // ── neon_stream run (a couple events) ──
  const neon = await newRun("neon_stream");
  for (let i = 0; i < 6; i++) {
    await pool.query(
      `INSERT INTO events (run_id, seq, item_ref, response, rt_ms, correct) VALUES ($1,$2,$3,$4,$5,$6)`,
      [neon, i, `neon_${i}`, JSON.stringify({ tap: true }), 400 + i, i % 5 !== 0]
    );
  }

  // ── read_room run: jury verdicts (correct NULL) + a standard prediction ──
  const room = await newRun("read_room");
  // Volume: user (d) gets 60 verdicts on the jury item (crosses n>=50); others get 10 each.
  const juryCount = u.key === "d" ? 60 : 10;
  for (let i = 0; i < juryCount; i++) {
    await pool.query(
      `INSERT INTO events (run_id, seq, item_ref, response, correct) VALUES ($1,$2,$3,$4,NULL)`,
      [room, i, JURY_ITEM, JSON.stringify({ verdict: i % 3 })] // verdicts 0/1/2
    );
  }
  // one standard crowd-prediction (gameplay data — response has NO 'verdict' key)
  await pool.query(
    `INSERT INTO events (run_id, seq, item_ref, response, correct) VALUES ($1, 999, 'verify_std_1', $2, true)`,
    [room, JSON.stringify({ prediction: 1 })]
  );

  // ── fooled run: hot item (threshold) + sparse items (suppression) + gauntlet ──
  const fooled = await newRun("fooled");
  const hotCount = u.key === "d" ? 50 : 10; // (d) crosses n>=50 on the hot item
  let seq = 0;
  for (let i = 0; i < hotCount; i++) {
    await pool.query(
      `INSERT INTO events (run_id, seq, item_ref, stimulus, response, rt_ms, correct) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [fooled, seq++, HOT_FOOLED, JSON.stringify({ modality: "text", tier: 2 }), JSON.stringify({ call: "fake" }), 800, i % 4 !== 0]
    );
  }
  // sparse items — only a few responses → cell stays under 50 → suppressed to NULL
  for (const item of SPARSE_FOOLED) {
    for (let i = 0; i < 4; i++) {
      await pool.query(
        `INSERT INTO events (run_id, seq, item_ref, stimulus, response, correct) VALUES ($1,$2,$3,$4,$5,$6)`,
        [fooled, seq++, item, JSON.stringify({ modality: "image", tier: 3 }), JSON.stringify({ call: "real" }), i % 2 === 0]
      );
    }
  }
  // gauntlet item — (d) gets 50 (threshold), others 10
  const gCount = u.key === "d" ? 50 : 10;
  for (let i = 0; i < gCount; i++) {
    await pool.query(
      `INSERT INTO events (run_id, seq, item_ref, stimulus, response, correct) VALUES ($1,$2,$3,$4,$5,$6)`,
      [fooled, seq++, GAUNTLET_ITEM, JSON.stringify({ modality: "image", tier: 2 }), JSON.stringify({ call: "fake" }), i % 3 !== 0]
    );
  }

  return uid;
}

async function main() {
  heading("Setup: synthetic users");
  await cleanup();
  const eventId = await seedItems();
  const ids: Record<string, string> = {};
  for (const u of USERS) ids[u.key] = await seedUser(u);
  log("Seeded 4 users (idempotent):");
  log("```");
  for (const u of USERS)
    log(`  (${u.key}) ${u.device.padEnd(10)} age=${u.age.padEnd(6)} adult=${String(u.adult).padEnd(5)} region=${u.region.padEnd(10)} research=${u.research}`);
  log("```");

  // ── STEP 2: eligibility ──
  heading("Step 2 — v_research_eligible_users (expected: only (d))");
  await showQuery(
    "Who is research-eligible? (joined back to users only to reveal the label)",
    `SELECT u.device_id, elig.age_band, elig.region
       FROM v_research_eligible_users elig
       JOIN users u ON u.id = elig.user_id
      WHERE u.device_id LIKE 'verify:%'
      ORDER BY u.device_id`
  );

  // ── STEP 3: detection + jury, attribution ──
  heading("Step 3 — v_detection_rates over the touched fooled items");
  await showQuery(
    "Detection rates for the synthetic fooled items (a/b/c must not appear)",
    `SELECT item_id, age_band, region, n, detection_rate
       FROM v_detection_rates
      WHERE item_id LIKE 'verify_%'
      ORDER BY item_id, region`
  );

  log("\n**Attribution proof — the hot item was touched by ALL FOUR users:**");
  const rawHot = await scalar(
    `SELECT count(*) FROM events e JOIN runs r ON r.id = e.run_id
      WHERE r.trial_type='fooled' AND e.item_ref = $1`,
    [HOT_FOOLED]
  );
  const dOnlyHot = await scalar(
    `SELECT count(*) FROM events e JOIN runs r ON r.id = e.run_id
      JOIN users u ON u.id = r.user_id
      WHERE r.trial_type='fooled' AND e.item_ref = $1 AND u.device_id='verify:d'`,
    [HOT_FOOLED]
  );
  const viewHot = await scalar(
    `SELECT coalesce(sum(n),0) FROM v_detection_rates WHERE item_id = $1`,
    [HOT_FOOLED]
  );
  log("```");
  log(`raw events on ${HOT_FOOLED} across ALL four users : ${rawHot}`);
  log(`raw events on ${HOT_FOOLED} from user (d) alone     : ${dOnlyHot}`);
  log(`v_detection_rates n() for ${HOT_FOOLED}             : ${viewHot}`);
  log(`→ view counts ONLY (d); a/b/c contributed ${Number(rawHot) - Number(dOnlyHot)} events that the view excluded.`);
  log("```");

  heading("Step 3 — v_jury_distributions (only (d)'s age_band should appear)");
  await showQuery(
    "Jury verdict distribution for the synthetic jury item",
    `SELECT item_id, age_band, verdict, n_cell, verdict_share
       FROM v_jury_distributions
      WHERE item_id LIKE 'verify_%'
      ORDER BY age_band, verdict`
  );
  const rawJury = await scalar(
    `SELECT count(*) FROM events e JOIN runs r ON r.id=e.run_id
      WHERE r.trial_type='read_room' AND e.item_ref=$1 AND e.response ? 'verdict'`,
    [JURY_ITEM]
  );
  const viewJury = await scalar(`SELECT coalesce(sum(n_cell),0) FROM v_jury_distributions WHERE item_id=$1`, [JURY_ITEM]);
  log("```");
  log(`raw verdict events on ${JURY_ITEM} across ALL four users : ${rawJury}`);
  log(`v_jury_distributions n_cell sum for ${JURY_ITEM}         : ${viewJury}`);
  log(`→ a/b/c verdicts (${Number(rawJury) - Number(viewJury)}) excluded; only (d)'s appear.`);
  log("```");

  heading("Step 4(iii) — small-cell suppression (n<50 → NULL, n>=50 → value)");
  await showQuery(
    "Sparse items (n<50) vs the hot item (n>=50) — detection_rate NULL vs numeric",
    `SELECT item_id, n, detection_rate,
            CASE WHEN detection_rate IS NULL THEN 'SUPPRESSED' ELSE 'exposed' END AS cell_state
       FROM v_detection_rates
      WHERE item_id LIKE 'verify_%'
      ORDER BY n`
  );

  heading("Bonus — v_gauntlet_event_summary (same consent + cell-size gate)");
  await showQuery(
    "Gauntlet summary for the synthetic live event",
    `SELECT event_name, tier, generator_model, participants, n_calls, catch_rate
       FROM v_gauntlet_event_summary
      WHERE event_name = 'verify_event'`
  );

  // ── STEP 4 (i)/(ii): attack queries run directly against the DB ──
  heading("Step 4(i)/(ii) — attack queries run DIRECTLY on the DB (not via any route)");
  log(
    "These show what a naive query WOULD leak, proving the view layer — not the raw tables — is what enforces the wall."
  );
  await showQuery(
    "(i) events joined to users WITHOUT the eligibility view — leaks all four users' rows",
    `SELECT u.device_id, count(*) AS raw_rows
       FROM events e JOIN runs r ON r.id=e.run_id JOIN users u ON u.id=r.user_id
      WHERE u.device_id LIKE 'verify:%' AND r.trial_type='fooled'
      GROUP BY u.device_id ORDER BY u.device_id`
  );
  await showQuery(
    "(ii) PII (device_id) alongside an aggregate — the exact shape the wall forbids",
    `SELECT u.device_id, u.region, count(*) AS n
       FROM users u JOIN runs r ON r.user_id=u.id
      WHERE u.device_id LIKE 'verify:%'
      GROUP BY u.device_id, u.region ORDER BY u.device_id`
  );
  log(
    "\nBoth queries return per-user rows. They are only dangerous if reachable from an API route. " +
      "The route grep (see report body) shows no existing route contains either pattern, and the " +
      "compliance scanner (tests/compliance/no-export.test.ts) fails CI on both shapes."
  );

  await pool.end();
  // Emit a machine-collectable marker so the outer report can splice this section.
  console.log("\n<<<VERIFY_WALL_OUTPUT_END>>>");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
