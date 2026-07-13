-- Mind Print — star economy balance (BUILD PROMPT Section 5).
-- Stars are a persistent currency (used by Double-or-Bank and the Chest). We
-- extend the user row rather than adding a table; balance floors at 0 in code.
ALTER TABLE users ADD COLUMN IF NOT EXISTS star_balance REAL NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS calibration_credit REAL NOT NULL DEFAULT 0;

-- A pending chest that unlocks on a future date (Section 5). Nullable/rare.
CREATE TABLE IF NOT EXISTS pending_chests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  now_n       SMALLINT NOT NULL,
  later_n     SMALLINT NOT NULL,
  unlocks_at  TIMESTAMPTZ NOT NULL,
  opened      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pending_chests_user ON pending_chests(user_id, opened);
