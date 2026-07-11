-- Mind Print — Aggregate research views (BUILD PROMPT Section 15)
--
-- ══════════════════════════════════════════════════════════════════════
--  THE TWO-ROOM WALL.
--  These views are the ONLY sanctioned read-path across users. There is no
--  user-level export endpoint anywhere in this codebase. Every research view
--  filters through v_research_eligible_users (is_adult AND active research
--  consent) and suppresses cells below n>=50. This is architecture, not policy.
-- ══════════════════════════════════════════════════════════════════════

-- Single inspectable definition of "research-eligible": adult + active consent.
-- Under-18 users and users without active research_participation consent never
-- appear here, so they are excluded from every downstream research view.
CREATE OR REPLACE VIEW v_research_eligible_users AS
SELECT u.id AS user_id, u.age_band, u.region
FROM users u
WHERE u.is_adult = true
  AND EXISTS (
    SELECT 1 FROM consent_records c
    WHERE c.user_id = u.id
      AND c.consent_type = 'research_participation'
      AND c.granted_at IS NOT NULL
      AND c.revoked_at IS NULL
  );

-- Per fooled item × age_band × region: n and detection rate.
-- Cells with n<50 return NULL detection_rate (small-cell suppression).
CREATE OR REPLACE VIEW v_detection_rates AS
SELECT
  e.item_ref                                   AS item_id,
  eu.age_band,
  eu.region,
  count(*)                                     AS n,
  CASE WHEN count(*) >= 50
       THEN avg((e.correct)::int)::real
       ELSE NULL END                           AS detection_rate
FROM events e
JOIN runs r  ON r.id = e.run_id AND r.trial_type = 'fooled'
JOIN v_research_eligible_users eu ON eu.user_id = r.user_id
WHERE e.correct IS NOT NULL
GROUP BY e.item_ref, eu.age_band, eu.region;

-- Per jury item × age_band: verdict distribution (layer-1 verdicts only).
-- Distribution suppressed (NULL share) unless the (item, age_band) group has n>=50.
CREATE OR REPLACE VIEW v_jury_distributions AS
SELECT
  e.item_ref                                   AS item_id,
  eu.age_band,
  (e.response->>'verdict')::int                AS verdict,
  count(*)                                      AS n_cell,
  CASE WHEN sum(count(*)) OVER (PARTITION BY e.item_ref, eu.age_band) >= 50
       THEN count(*)::real
              / sum(count(*)) OVER (PARTITION BY e.item_ref, eu.age_band)
       ELSE NULL END                            AS verdict_share
FROM events e
JOIN runs r  ON r.id = e.run_id AND r.trial_type = 'read_room'
JOIN item_cache ic ON ic.item_id = e.item_ref AND ic.category = 'dilemma_jury'
JOIN v_research_eligible_users eu ON eu.user_id = r.user_id
WHERE e.response ? 'verdict'      -- layer-1 verdict events (correct IS NULL)
GROUP BY e.item_ref, eu.age_band, (e.response->>'verdict')::int;

-- Per gauntlet event: participation and catch-rate by tier and generator_model.
-- Catch-rate suppressed (NULL) for cells with n<50.
CREATE OR REPLACE VIEW v_gauntlet_event_summary AS
SELECT
  ge.id                                        AS event_id,
  ge.name                                      AS event_name,
  ic.content->>'fake_quality_tier'             AS tier,
  ic.generator_model,
  count(DISTINCT r.user_id)                     AS participants,
  count(*)                                      AS n_calls,
  CASE WHEN count(*) >= 50
       THEN avg((e.correct)::int)::real
       ELSE NULL END                           AS catch_rate
FROM gauntlet_events ge
JOIN item_cache ic ON ic.gauntlet_event_id = ge.id
JOIN events e ON e.item_ref = ic.item_id
JOIN runs  r  ON r.id = e.run_id AND r.trial_type = 'fooled'
JOIN v_research_eligible_users eu ON eu.user_id = r.user_id
WHERE e.correct IS NOT NULL
GROUP BY ge.id, ge.name, ic.content->>'fake_quality_tier', ic.generator_model;
