-- Mind Print — server-side analytics mirror (BUILD PROMPT Sections 1 & 16).
-- /api/track logs here AND forwards to the Pipedream webhook. This is product
-- analytics only: event names + coarse params, never user-level research data,
-- never PII. It is not a research read-path and has no export endpoint.

CREATE TABLE IF NOT EXISTS track_events (
  id         BIGSERIAL PRIMARY KEY,
  name       TEXT NOT NULL,          -- one of the Section 16 event names
  user_id    UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID NULL,
  params     JSONB NULL,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_track_name_ts ON track_events(name, ts DESC);
