-- Mind Print — Phase 1 core schema (BUILD PROMPT Section 2)
-- All user/event/run data lives here in Neon Postgres.
-- The two-room wall: there is NO user-level export path. Aggregation is SQL views only (0003).

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

-- ── users ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id   TEXT UNIQUE NOT NULL,
  email       TEXT NULL,
  age_band    TEXT NULL,            -- '<18','18-24','25-34','35-44','45+'
  is_adult    BOOLEAN NULL,         -- derived at age gate; NULL until answered
  region      TEXT NULL,            -- coarse, from Vercel geo header
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── consent_records ──────────────────────────────────────────────────
-- Rules enforced in code (src/lib/consent.ts):
--   * research_participation grantable ONLY if is_adult = true.
--   * Every research-eligible view join goes through an active-consent predicate.
--   * Consent copy lives in versioned constants; changing copy bumps version.
CREATE TABLE IF NOT EXISTS consent_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL,       -- 'gameplay_tos' | 'research_participation' | 'sponsored_items'
  version      TEXT NOT NULL,       -- consent copy version string
  granted_at   TIMESTAMPTZ NULL,
  revoked_at   TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_consent_user_type ON consent_records(user_id, consent_type);

-- ── sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_date   DATE NOT NULL,
  mode           TEXT NOT NULL DEFAULT 'standard',  -- reserved: 'classroom'|'proctored'
  trials_planned JSONB NULL,
  context_tags   TEXT[] NULL,        -- e.g. {'slept_badly','coffee'} — max 2
  completed      BOOLEAN NOT NULL DEFAULT false,
  started_at     TIMESTAMPTZ NULL,
  completed_at   TIMESTAMPTZ NULL,
  UNIQUE (user_id, session_date)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- ── runs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trial_type       TEXT NOT NULL,    -- 'neon_stream'|'impostor'|'heist'|'alien_rules'|'read_room'|'fooled'
  chaos_mode       BOOLEAN NOT NULL DEFAULT false,
  wager            SMALLINT NOT NULL,-- 1|2|3
  wager_outcome    TEXT NULL,        -- 'won'|'lost'|'baseline_building'
  difficulty_state JSONB NULL,
  summary_metrics  JSONB NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_runs_user_trial ON runs(user_id, trial_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);

-- ── events (per-response instrumentation) ────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id        BIGSERIAL PRIMARY KEY,
  run_id    UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq       SMALLINT NULL,
  item_ref  TEXT NULL,
  stimulus  JSONB NULL,
  response  JSONB NULL,             -- shape varies by trial; see per-trial specs
  rt_ms     INTEGER NULL,
  correct   BOOLEAN NULL,           -- NULL for jury verdicts (no ground truth)
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id, seq);
CREATE INDEX IF NOT EXISTS idx_events_item ON events(item_ref);

-- ── preference_events (economic-preference instrumentation) ──────────
CREATE TABLE IF NOT EXISTS preference_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id  UUID NULL REFERENCES sessions(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,        -- 'double_or_bank' | 'chest_choice'
  payload     JSONB NOT NULL,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prefevents_user ON preference_events(user_id, kind, ts DESC);

-- ── item_cache (hourly sync from Airtable) ───────────────────────────
CREATE TABLE IF NOT EXISTS item_cache (
  item_id               TEXT PRIMARY KEY,
  trial_type            TEXT NULL,
  content               JSONB NULL,
  design_difficulty     SMALLINT NULL,     -- 1-5 hand-tagged
  category              TEXT NULL,         -- read_room / fooled categories
  generator_model       TEXT NULL,         -- fooled AI items; NULL for human items
  provenance            JSONB NULL,        -- fooled provenance (see Sec 6.6)
  sponsor               TEXT NULL,         -- reserved; if set, UI must show 'Sponsored'
  gauntlet_event_id     UUID NULL,
  empirical_difficulty  REAL NULL,
  discrimination        REAL NULL,         -- future IRT job
  exposures             INTEGER NOT NULL DEFAULT 0,
  correct_rate          REAL NULL,
  status                TEXT NOT NULL DEFAULT 'live'  -- 'live'|'culled'|'draft'
);
CREATE INDEX IF NOT EXISTS idx_item_trial ON item_cache(trial_type, status);
CREATE INDEX IF NOT EXISTS idx_item_gauntlet ON item_cache(gauntlet_event_id);

-- ── room_answers (live distributions for read_room; incl jury crowd layer) ──
CREATE TABLE IF NOT EXISTS room_answers (
  item_id TEXT NOT NULL,
  option  SMALLINT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, option)
);

-- ── jury_verdicts (aggregate verdict tallies for jury items, layer 1) ──
CREATE TABLE IF NOT EXISTS jury_verdicts (
  item_id TEXT NOT NULL,
  verdict SMALLINT NOT NULL,
  count   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (item_id, verdict)
);

-- ── gauntlet_events ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS gauntlet_events (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NULL,
  starts_at TIMESTAMPTZ NULL,
  ends_at   TIMESTAMPTZ NULL,
  status    TEXT NOT NULL DEFAULT 'draft'  -- 'draft'|'live'|'closed'
);

-- ── staircase_state (adaptive difficulty per user × trial) ───────────
CREATE TABLE IF NOT EXISTS staircase_state (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trial_type TEXT NOT NULL,
  state      JSONB NOT NULL,
  PRIMARY KEY (user_id, trial_type)
);

-- ── dimension_scores (resolved Print dimensions) ─────────────────────
CREATE TABLE IF NOT EXISTS dimension_scores (
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension       TEXT NOT NULL,
  score           REAL NULL,
  se              REAL NULL,
  n_trials        INTEGER NOT NULL DEFAULT 0,
  resolution      REAL NULL,
  derived_metrics JSONB NULL,        -- computed telemetry lands here (Sec 9)
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dimension)
);

-- ── form_scores (daily state readout, Sec 8) ─────────────────────────
CREATE TABLE IF NOT EXISTS form_scores (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dimension    TEXT NOT NULL,
  session_date DATE NOT NULL,
  form_z       REAL NULL,            -- today vs own trailing baseline
  baseline_n   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, dimension, session_date)
);
