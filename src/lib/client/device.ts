// Client device identity (BUILD PROMPT Section 1).
// Device ID lives in localStorage; the server also sets an httpOnly cookie
// fallback. We send the id on every request via the x-mp-device header.
const KEY = "mp_device_id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
