# Two-Room Wall — Verification Report

**Subsystem:** consent-filtered research SQL views (`v_research_eligible_users`,
`v_detection_rates`, `v_jury_distributions`, `v_gauntlet_event_summary`).
**Task:** empirically prove individual-level data cannot be read across users via
the sanctioned research path. Verification only — the wall's implementation
(`migrations/0003_research_views.sql`) was **not modified**.

**Environment:** local PostgreSQL 16.13, database `mindprint_verify`, all five
migrations applied verbatim via `psql`. Seed/query driver: `pg` (dev-only; the
app's `@vercel/postgres` speaks Neon's protocol and can't target local Postgres —
the *views* under test are ordinary DB objects, identical regardless of driver).
Reproduce with `scripts/verify-wall.ts` (see §6).

---

## Verdict

> **The sanctioned research read-path is airtight.** Across four synthetic users
> — (a) under-18, (b) adult/declined, (c) adult/revoked, (d) adult/active — only
> (d) appears in any research view. Users (a), (b), (c) were excluded **even
> though they responded to the exact same items as (d)** (30 fooled events and 30
> jury verdicts on shared items were dropped). Small cells (n<50) suppress to
> NULL; the n≥50 boundary was crossed in both directions and behaves as designed.

## Findings

**No HIGH findings. No existing API route breaches the wall.** A grep of every
route (§4) shows zero routes selecting `device_id`/`email`, zero `SELECT *`/`u.*`
star-selects, and every raw `runs`/`events` read is either scoped to the
authenticated caller or an `avg()/count()` aggregate.

Two honest, lower-severity observations follow. **Per your instruction I have not
patched either** — both concern the CI *test control*, not the view layer, and
you asked to review any change to this subsystem yourself.

| # | Sev | Finding |
|---|-----|---------|
| **F1** | **MEDIUM** | The guard against *future* attack queries in arbitrary routes is the CI scanner (`tests/compliance/no-export.test.ts`), **not** the database. It has two evasions: (1) its `device_id`/`email` check is a name regex (`SELECT[^;]*\b(device_id\|email)\b`) that `SELECT *` / `SELECT u.*` would defeat; (2) it exempts `cron`/`admin` routes from the unscoped-cross-user-read check. No current route triggers either (verified), so this is a coverage gap in the control, not an active leak. |
| **F2** | **LOW / OBS** | A **second, sanctioned cross-user read-path** exists beyond the research views: the gauntlet "world catch-rate" in `state.ts` and `card/[sessionId].ts`. It is `avg()/count()` over events, gated at n≥50, returning a single percentage (Section 6.6 requires this banner). It never returns rows or PII. Section 15's "Nothing else reads across users" holds for *individual* data but not literally for *aggregates* — the gameplay aggregate path exists by design. |

**Precise answer to "are (i)/(ii) structurally impossible via any existing route?"**
They appear in **zero existing routes** (grep proof, §4) and CI blocks the
named-column shapes. The stronger phrase "structurally impossible" would overstate
it: the DB permits any route to run such SQL, so the guarantee is *"no existing
route does, and CI blocks the common shapes,"* not a database-level impossibility.
The **view layer itself**, however, *is* structurally airtight — it cannot be made
to emit an ineligible user's data without editing the view SQL.

---

## Step 2 — `v_research_eligible_users` (expected: only (d))

Seeded users (idempotent; re-running produces byte-identical output — see §6):

```
  (a) verify:a   age=<18    adult=false region=VERIFY_A   research=none
  (b) verify:b   age=35-44  adult=true  region=VERIFY_BC  research=declined
  (c) verify:c   age=45+    adult=true  region=VERIFY_BC  research=revoked   (granted then revoked)
  (d) verify:d   age=25-34  adult=true  region=VERIFY_D   research=active
```

```sql
SELECT u.device_id, elig.age_band, elig.region
  FROM v_research_eligible_users elig
  JOIN users u ON u.id = elig.user_id      -- join back ONLY to reveal the label
 WHERE u.device_id LIKE 'verify:%'
 ORDER BY u.device_id;
```
```
device_id | age_band | region
----------|----------|---------
verify:d  | 25-34    | VERIFY_D
(1 row)
```

✅ Only (d). The under-18 user, the decliner, and the revoker are all absent.

---

## Step 3 — detection & jury, with attribution

### `v_detection_rates`

```sql
SELECT item_id, age_band, region, n, detection_rate
  FROM v_detection_rates
 WHERE item_id LIKE 'verify_%'
 ORDER BY item_id, region;
```
```
item_id                | age_band | region   | n  | detection_rate
-----------------------|----------|----------|----|---------------
verify_fooled_hot      | 25-34    | VERIFY_D | 50 | 0.74
verify_fooled_sparse_1 | 25-34    | VERIFY_D | 4  | NULL
verify_fooled_sparse_2 | 25-34    | VERIFY_D | 4  | NULL
verify_gaunt_1         | 25-34    | VERIFY_D | 50 | 0.66
(4 rows)
```

Every returned row is `region = VERIFY_D` (user (d) alone). Users (b) and (c)
share `region = VERIFY_BC`; **no `VERIFY_BC` row exists**, and no `VERIFY_A` row
(user (a)) exists.

### Attribution proof — the hot item was answered by ALL FOUR users

```
raw events on verify_fooled_hot across ALL four users : 80
raw events on verify_fooled_hot from user (d) alone   : 50
v_detection_rates n() for verify_fooled_hot           : 50
→ view counts ONLY (d); a/b/c contributed 30 events that the view EXCLUDED.
```

The diff is exactly attributable to (d): the view's `n` (50) equals (d)-only
(50), not the raw total (80). The 30 events from the ineligible users were
dropped. **Diff attributable to (d) alone: confirmed.**

### `v_jury_distributions`

```sql
SELECT item_id, age_band, verdict, n_cell, verdict_share
  FROM v_jury_distributions
 WHERE item_id LIKE 'verify_%'
 ORDER BY age_band, verdict;
```
```
item_id       | age_band | verdict | n_cell | verdict_share
--------------|----------|---------|--------|------------------
verify_jury_1 | 25-34    | 0       | 20     | 0.3333333333333333
verify_jury_1 | 25-34    | 1       | 20     | 0.3333333333333333
verify_jury_1 | 25-34    | 2       | 20     | 0.3333333333333333
(3 rows)
```
```
raw verdict events on verify_jury_1 across ALL four users : 90
v_jury_distributions n_cell sum for verify_jury_1         : 60
→ a/b/c verdicts (30) excluded; only (d)'s age_band (25-34) appears.
```

Only `age_band = 25-34` (user (d)) is present. The `<18` (a), `35-44` (b), and
`45+` (c) age-bands — who each cast verdicts on the same jury item — produce **no
rows**.

---

## Step 4(iii) — small-cell suppression (n<50 → NULL, n≥50 → value)

The seed deliberately straddles the threshold: (d) has 50 calls on the hot item
and the gauntlet item (n≥50), and 4 on each sparse item (n<50).

```sql
SELECT item_id, n, detection_rate,
       CASE WHEN detection_rate IS NULL THEN 'SUPPRESSED' ELSE 'exposed' END AS cell_state
  FROM v_detection_rates
 WHERE item_id LIKE 'verify_%'
 ORDER BY n;
```
```
item_id                | n  | detection_rate | cell_state
-----------------------|----|----------------|-----------
verify_fooled_sparse_1 | 4  | NULL           | SUPPRESSED
verify_fooled_sparse_2 | 4  | NULL           | SUPPRESSED
verify_fooled_hot      | 50 | 0.74           | exposed
verify_gaunt_1         | 50 | 0.66           | exposed
(4 rows)
```

✅ Suppression fires below 50 and releases at exactly 50 — verified in **both**
directions (not merely "always NULL because data is sparse").

### Bonus — `v_gauntlet_event_summary` (same consent + cell-size gate)

```sql
SELECT event_name, tier, generator_model, participants, n_calls, catch_rate
  FROM v_gauntlet_event_summary
 WHERE event_name = 'verify_event';
```
```
event_name   | tier | generator_model | participants | n_calls | catch_rate
-------------|------|-----------------|--------------|---------|-----------
verify_event | 2    | imagegen-x-v3   | 1            | 50      | 0.66
(1 row)
```

`participants = 1` (only (d)), even though (a)/(b)/(c) each answered the gauntlet
item — the third research view is consent-filtered identically.

---

## Step 4(i)/(ii) — attack queries + route grep

### The attack queries, run **directly** against the DB (not via any route)

These demonstrate what a naive query *would* leak, proving that the **view layer —
not the raw tables — is what enforces the wall**.

**(i) events → users WITHOUT the eligibility view:**
```sql
SELECT u.device_id, count(*) AS raw_rows
  FROM events e JOIN runs r ON r.id=e.run_id JOIN users u ON u.id=r.user_id
 WHERE u.device_id LIKE 'verify:%' AND r.trial_type='fooled'
 GROUP BY u.device_id ORDER BY u.device_id;
```
```
device_id | raw_rows
----------|---------
verify:a  | 28          ← under-18, would leak
verify:b  | 28          ← declined, would leak
verify:c  | 28          ← revoked, would leak
verify:d  | 108
(4 rows)
```

**(ii) PII (`device_id`) alongside an aggregate — the exact shape the wall forbids:**
```sql
SELECT u.device_id, u.region, count(*) AS n
  FROM users u JOIN runs r ON r.user_id=u.id
 WHERE u.device_id LIKE 'verify:%'
 GROUP BY u.device_id, u.region ORDER BY u.device_id;
```
```
device_id | region    | n
----------|-----------|--
verify:a  | VERIFY_A  | 3
verify:b  | VERIFY_BC | 3
verify:c  | VERIFY_BC | 3
verify:d  | VERIFY_D  | 3
(4 rows)
```

Both return per-user rows / PII. They are only dangerous **if reachable from an
API route.** They are not:

### Route grep — no existing route carries either pattern

```
(A) Routes selecting device_id or email in a SELECT ............ (none)
(B) Routes using SELECT * / u.* / users.* (name-agnostic leak) . (none)
(C) Routes joining users→events/runs ........................... dob/resolve, state,
                                                                  chest/open, chest/choose
(D) Routes/libs reading a research view ........................ (NONE — the views are
    the documented read-path; the app itself never queries them)
```

The four routes in (C) were inspected individually: **all are scoped to the
authenticated `user.id`** (own star balance, own chests, own trailing runs) —
none perform a cross-user individual read. Full scoping evidence:

- `chest/open.ts`, `chest/choose.ts` — `WHERE ... user_id = $1 / id = $1` (`user.id`).
- `dob/resolve.ts` — `WHERE session_id = $1` (today's session) and
  `WHERE user_id = $1 AND trial_type = $2` (`user.id`).
- `state.ts` — every `runs`/`form_scores`/`dimension_scores` read is
  `WHERE user_id = $1`. Its one cross-user read is the **aggregate** world
  catch-rate (`avg()/count()`, n≥50 gated) — see finding **F2**, not an
  individual read.

### Could an attack query be added without touching the view layer?

Honestly: **yes, at the language level — as in any app with a DB connection —**
but no existing route does, and the common shapes are blocked in CI by
`tests/compliance/no-export.test.ts` (which asserts, over *every* route: no
`export/dump/download` route names; no `device_id`/`email` in a SELECT; no
unscoped non-aggregate `runs`/`events` read). The residual gap is that this is a
**process control with two evasions** (finding **F1**), not a database-level
guarantee. The **view layer itself cannot be bypassed** — it is impossible to
make `v_detection_rates` et al. emit an ineligible user's data without editing
`0003_research_views.sql`. That editability is why I flagged F1 for your review
rather than silently hardening the scanner.

---

## Step 5 — compliance suite still passes (with the four synthetic users present)

The synthetic users live in a separate `mindprint_verify` DB and do not touch the
test fixtures; the suite is unchanged and green. `npm test`:

```
    ✓ tests/compliance/no-export.test.ts > two-room wall > has API routes to inspect
    ✓ tests/compliance/no-export.test.ts > two-room wall > no route name suggests export/dump/download of data
    ✓ tests/compliance/no-export.test.ts > two-room wall > no route selects raw per-user rows across users (device_id/email leak)
    ✓ tests/compliance/no-export.test.ts > two-room wall > no route reads events/runs for a user other than the authenticated one
    ✓ tests/compliance/under18.test.ts > under-18 exclusion > '<18' age band derives is_adult=false
    ✓ tests/compliance/under18.test.ts > under-18 exclusion > research consent is not grantable for minors or unknown age
    ✓ tests/compliance/under18.test.ts > under-18 exclusion > every research view filters through the adult+consent predicate
    ✓ tests/compliance/under18.test.ts > under-18 exclusion > research views enforce n>=50 small-cell suppression
    ✓ tests/compliance/banned-strings.test.ts > banned strings scanner > flags each banned UI phrase
    ✓ tests/compliance/banned-strings.test.ts > banned strings scanner > flags Form-banned phrases in form scope only
    ✓ tests/compliance/banned-strings.test.ts > banned strings scanner > does not false-positive 'IQ' inside ordinary words
    ✓ tests/compliance/banned-strings.test.ts > banned strings scanner > allows the required footer despite containing 'clinical'
    ✓ tests/compliance/banned-strings.test.ts > mandated copy > gameplay ToS carries the covenant line verbatim
    ✓ tests/compliance/banned-strings.test.ts > mandated copy > research consent decline is a first-class button
    ✓ tests/compliance/banned-strings.test.ts > mandated copy > player-facing copy constants are clean
    ✓ tests/compliance/provenance.test.ts > fooled provenance > every seed-bank item passes validation
    ✓ tests/compliance/provenance.test.ts > fooled provenance > rejects human items missing rights
    ✓ tests/compliance/provenance.test.ts > fooled provenance > rejects human items with scraped/unknown rights
    ✓ tests/compliance/provenance.test.ts > fooled provenance > rejects AI items missing generator_model or date
    ✓ tests/engine/wager.test.ts > wager resolution > win pays +stake
    ✓ tests/engine/wager.test.ts > wager resolution > loss costs -stake
    ✓ tests/engine/wager.test.ts > wager resolution > accurate low bet (staked 1, lost) earns +0.5 calibration credit and glints
    ✓ tests/engine/wager.test.ts > wager resolution > first runs auto-succeed as baseline_building
    ✓ tests/engine/wager.test.ts > wager resolution > visible balance floors at 0
    ✓ tests/engine/wager.test.ts > baseline comparison > median of last 5
    ✓ tests/engine/wager.test.ts > baseline comparison > respects lower-is-better metrics
    ✓ tests/compliance/sponsored-label.test.ts > Sponsored label > renders 'Sponsored' when item.sponsor is set
    ✓ tests/compliance/sponsored-label.test.ts > Sponsored label > does not render 'Sponsored' otherwise
    Test Files  6 passed (6)
         Tests  28 passed (28)
```

Compliance grep (`npm run compliance:grep`): `Compliance grep passed: no banned
strings in player-facing source.`

---

## Step 6 — cleanup, idempotency, safety

- **Idempotent:** the script deletes its own `device_id LIKE 'verify:%'` users
  (FK `ON DELETE CASCADE` clears their consents/sessions/runs/events) and its
  `item_cache`/`gauntlet_events` markers before re-seeding. Running it twice
  produced **byte-identical output** (`diff` empty) and stable row counts
  (**4 users / 12 runs / 310 events** — no accumulation).
- **Dev/test-only:** a boxed banner at the top of `scripts/verify-wall.ts` states
  it must never run against production. It **refuses to run** unless
  `VERIFY_WALL_DSN` is set *and* the target database name contains `verify`
  (override requires an explicit `VERIFY_WALL_FORCE=1`).
- **Not in CI:** the script is not referenced by `.github/workflows/ci.yml` or
  any `package.json` script; it needs a manually-provided DSN, so no CI gate can
  run it against a real database. (`pg` was installed with `npm install --no-save`
  and is not added to `package.json`.)
- **No production code changed.** Only `scripts/verify-wall.ts` (new, dev-only)
  and this report were added. The wall implementation
  (`migrations/0003_research_views.sql`) is untouched.

## Reproduce

```bash
pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE ROLE mp_verify LOGIN PASSWORD 'mp_verify_pw';"
sudo -u postgres psql -c "CREATE DATABASE mindprint_verify OWNER mp_verify;"
sudo -u postgres psql -d mindprint_verify -c "CREATE EXTENSION pgcrypto;"
for f in migrations/000*.sql; do sudo -u postgres psql -d mindprint_verify -f "$f"; done
sudo -u postgres psql -d mindprint_verify -c "GRANT ALL ON ALL TABLES IN SCHEMA public TO mp_verify; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO mp_verify;"
npm install --no-save pg @types/pg
VERIFY_WALL_DSN="postgres://mp_verify:mp_verify_pw@localhost:5432/mindprint_verify" npx tsx scripts/verify-wall.ts
```
