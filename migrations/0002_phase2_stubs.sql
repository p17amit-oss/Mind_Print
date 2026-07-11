-- Mind Print — Phase-2 schema stubs (BUILD PROMPT Section 14)
-- Migrate now, zero UI this phase.

CREATE TABLE IF NOT EXISTS circles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NULL,
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_members (
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (circle_id, user_id)
);

CREATE TABLE IF NOT EXISTS seasons (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NULL,
  starts_at TIMESTAMPTZ NULL,
  ends_at   TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS skill_ratings (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill      TEXT NOT NULL,          -- 'calibration'|'detection'|'crowd_judgment'
  rating     REAL NULL,
  rd         REAL NULL,
  season_id  UUID NULL REFERENCES seasons(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill, season_id)
);
