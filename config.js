/* Rift Dashboard runtime configuration.
 *
 * This file is intentionally plain JavaScript so it can be edited on the host
 * (or generated at deploy time) without rebuilding the dashboard. Everything
 * here is optional — sensible defaults live in assets/app/config.js.
 *
 * apiBase            The bot's Quart API root, including "/api".
 * apiBaseFallbacks   Tried in order when the primary host is unreachable
 *                    (e.g. Tailscale host vs. public tunnel).
 * demo               Force demo mode (in-memory mock backend, no Discord login).
 * discordClientId    OAuth2 application id used for the implicit grant.
 * invitePermissions  Permission bitfield used by the "Add Rift" button.
 */
window.RIFT_CONFIG = {
  // apiBase: "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api",
  // apiBaseFallbacks: ["https://dash.rift.cool/api"],
  // demo: false,
  // discordClientId: "1329184069426348052",
  // invitePermissions: "5076723787231222",
};
