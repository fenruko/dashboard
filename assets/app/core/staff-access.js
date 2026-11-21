/* Who may open Diagnostics.
 *
 * Diagnostics is limited to Rift staff. There are two ways in:
 *   1. the Discord ID is an allow-listed developer (fenruko by default, plus
 *      any IDs in `developerUserIds` in /config.js);
 *   2. the bot API reports a staff permission for the signed-in Discord
 *      account (staff accounts are linked to Discord IDs on staff.rift.cool).
 *
 * (2) reads GET /api/dashboard/staff-access, which answers
 *   { "permissions": ["diagnostics.view", ...] }
 * for the account behind the bearer token ("*" means full access). Anything
 * else, including a missing route, an error or a malformed answer, means "no
 * staff permissions": this fails closed.
 */

import { isDeveloperUserId } from "../config.js";

export const DIAGNOSTICS_PERMISSION = "diagnostics.view";
export const STAFF_ACCESS_PATH = "/dashboard/staff-access";

export function normalizeStaffPermissions(payload) {
  const raw = Array.isArray(payload) ? payload : payload?.permissions;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter((item) => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

export async function fetchStaffPermissions(api) {
  try {
    return normalizeStaffPermissions(await api.get(STAFF_ACCESS_PATH, { retries: 0, cacheTtl: 60_000 }));
  } catch {
    return [];
  }
}

export function hasStaffPermission(permissions, key) {
  return Array.isArray(permissions) && (permissions.includes("*") || permissions.includes(key));
}

/** `session` is the auth store state (auth.get()). */
export function canViewDiagnostics(session) {
  if (!session || session.status !== "ready" || !session.user?.id) return false;
  return isDeveloperUserId(session.user.id) || hasStaffPermission(session.staffPermissions, DIAGNOSTICS_PERMISSION);
}
