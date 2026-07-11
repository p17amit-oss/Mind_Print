// Server-side consent operations (BUILD PROMPT Section 3).
// Enforces: research_participation grantable ONLY for adults.
import { query, queryOne } from "../db";
import { CONSENT_COPY, canGrantResearch, type ConsentType } from "../consent";

export type ConsentDecision = "grant" | "decline" | "revoke";
export type ConsentStatus = "granted" | "declined" | "revoked" | "none";

/** Record a consent decision. Returns the resulting status. */
export async function recordConsent(
  userId: string,
  type: ConsentType,
  decision: ConsentDecision,
  isAdult: boolean | null
): Promise<ConsentStatus> {
  if (type === "research_participation" && decision === "grant" && !canGrantResearch(isAdult)) {
    throw new Error("research_participation is adults-only");
  }
  const version = CONSENT_COPY[type].version;

  if (decision === "revoke") {
    await query(
      `UPDATE consent_records SET revoked_at = now()
        WHERE user_id = $1 AND consent_type = $2
          AND granted_at IS NOT NULL AND revoked_at IS NULL`,
      [userId, type]
    );
    return "revoked";
  }

  const grantedAt = decision === "grant" ? "now()" : "NULL";
  await query(
    `INSERT INTO consent_records (user_id, consent_type, version, granted_at)
     VALUES ($1, $2, $3, ${grantedAt})`,
    [userId, type, version]
  );
  return decision === "grant" ? "granted" : "declined";
}

/** Current status of a consent type for a user (latest record wins). */
export async function getConsentStatus(
  userId: string,
  type: ConsentType
): Promise<ConsentStatus> {
  const row = await queryOne<{ granted_at: string | null; revoked_at: string | null }>(
    `SELECT granted_at, revoked_at FROM consent_records
      WHERE user_id = $1 AND consent_type = $2
      ORDER BY COALESCE(granted_at, '-infinity'::timestamptz) DESC, id DESC
      LIMIT 1`,
    [userId, type]
  );
  if (!row) return "none";
  if (row.revoked_at) return "revoked";
  if (row.granted_at) return "granted";
  return "declined";
}

export interface ConsentState {
  gameplay_tos: ConsentStatus;
  research_participation: ConsentStatus;
  sponsored_items: ConsentStatus;
  /** Whether the (adults-only) research prompt should be shown after a session. */
  shouldPromptResearch: boolean;
  /** Whether sponsored read_room items may be served to this user. */
  sponsoredEligible: boolean;
}

export async function getConsentState(
  userId: string,
  isAdult: boolean | null
): Promise<ConsentState> {
  const [gameplay_tos, research_participation, sponsored_items] = await Promise.all([
    getConsentStatus(userId, "gameplay_tos"),
    getConsentStatus(userId, "research_participation"),
    getConsentStatus(userId, "sponsored_items"),
  ]);

  // Under-18: never prompt research, never serve sponsored items (Section 3/13).
  const adult = isAdult === true;
  const shouldPromptResearch =
    adult && research_participation === "none";
  const sponsoredEligible = adult && sponsored_items !== "declined";

  return {
    gameplay_tos,
    research_participation,
    sponsored_items,
    shouldPromptResearch,
    sponsoredEligible,
  };
}

/** The consent predicate mirrored from v_research_eligible_users. */
export async function isResearchEligible(userId: string): Promise<boolean> {
  const row = await queryOne<{ ok: boolean }>(
    `SELECT (u.is_adult = true AND EXISTS (
        SELECT 1 FROM consent_records c
         WHERE c.user_id = u.id AND c.consent_type = 'research_participation'
           AND c.granted_at IS NOT NULL AND c.revoked_at IS NULL
      )) AS ok
      FROM users u WHERE u.id = $1`,
    [userId]
  );
  return row?.ok === true;
}
