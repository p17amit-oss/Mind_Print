// Anonymous-first auth (BUILD PROMPT Section 1).
// Device ID in localStorage (client) + httpOnly cookie fallback (server).
// Email magic-link upgrade is schema-supported but has no UI this phase.
import type { NextApiRequest, NextApiResponse } from "next";
import { randomUUID } from "node:crypto";
import { queryOne } from "./db";
import { DEVICE_COOKIE, DEVICE_HEADER } from "./device-const";

export { DEVICE_COOKIE, DEVICE_HEADER };
const ONE_YEAR = 60 * 60 * 24 * 365;

export interface AppUser {
  id: string;
  device_id: string;
  email: string | null;
  age_band: string | null;
  is_adult: boolean | null;
  region: string | null;
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/** Coarse region from the Vercel geo header (country granularity only). */
function regionFrom(req: NextApiRequest): string | null {
  const c = req.headers["x-vercel-ip-country"];
  return typeof c === "string" ? c : null;
}

function resolveDeviceId(req: NextApiRequest): string | null {
  const hdr = req.headers[DEVICE_HEADER];
  if (typeof hdr === "string" && hdr.length >= 8) return hdr;
  const cookies = parseCookies(req.headers.cookie);
  return cookies[DEVICE_COOKIE] ?? null;
}

function setDeviceCookie(res: NextApiResponse, deviceId: string) {
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${DEVICE_COOKIE}=${encodeURIComponent(deviceId)}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; SameSite=Lax;${secure}`
  );
}

/**
 * Resolve the current anonymous user, creating one on first contact. Always
 * returns a user; sets the httpOnly device cookie when we minted a new id.
 */
export async function getOrCreateUser(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<AppUser> {
  let deviceId = resolveDeviceId(req);
  let minted = false;
  if (!deviceId) {
    deviceId = randomUUID();
    minted = true;
  }
  const region = regionFrom(req);

  const user = await queryOne<AppUser>(
    `INSERT INTO users (device_id, region)
     VALUES ($1, $2)
     ON CONFLICT (device_id) DO UPDATE
       SET region = COALESCE(users.region, EXCLUDED.region)
     RETURNING id, device_id, email, age_band, is_adult, region`,
    [deviceId, region]
  );
  if (!user) throw new Error("failed to resolve user");

  if (minted) setDeviceCookie(res, deviceId);
  return user;
}

/** Read the current user without creating one (returns null if unknown). */
export async function getUser(req: NextApiRequest): Promise<AppUser | null> {
  const deviceId = resolveDeviceId(req);
  if (!deviceId) return null;
  return queryOne<AppUser>(
    `SELECT id, device_id, email, age_band, is_adult, region
       FROM users WHERE device_id = $1`,
    [deviceId]
  );
}
