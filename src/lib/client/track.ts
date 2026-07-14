// Client tracking: fire GA4 (gtag) + mirror server-side via /api/track.
// Server-only events (fooled_call) are never emitted here.
import { getDeviceId } from "./device";
import { DEVICE_HEADER } from "../device-const";
import { SERVER_ONLY_EVENTS, type TrackEventName } from "../tracking-const";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(
  name: TrackEventName,
  params: Record<string, unknown> = {},
  sessionId?: string
): void {
  if (SERVER_ONLY_EVENTS.includes(name)) {
    console.warn(`[track] ${name} is server-only; ignoring client emit`);
    return;
  }
  // GA4
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", name, params);
  }
  // Server mirror (fire-and-forget)
  if (typeof window !== "undefined") {
    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json", [DEVICE_HEADER]: getDeviceId() },
      body: JSON.stringify({ name, params, sessionId }),
      keepalive: true,
    }).catch(() => {});
  }
}
