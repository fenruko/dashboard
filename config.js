/* Rift Dashboard runtime configuration.
 *
 * This file is intentionally plain JavaScript so it can be edited on the host
 * (or generated at deploy time) without rebuilding the dashboard. Everything
 * here is optional — sensible defaults live in assets/app/config.js.
 *
 * apiBase             The bot's Quart API root, including "/api".
 * apiBaseFallbacks    Tried in order when the primary host is unreachable.
 * developerUserIds    Extra Discord IDs allowed to edit the API host from
 *                     Account (fenruko is always included).
 * demo                Optional local demo mode (no Discord login). Keep false in production.
 * discordClientId     OAuth2 application id used for the implicit grant.
 * invitePermissions   Permission bitfield used by the "Add Rift" button.
 */
window.RIFT_CONFIG = {
  // The live Rift bot API. Every page reads and writes this host directly.
  apiBase: "https://desktop-mo3r1pj.tailb9e0a9.ts.net/api",
  apiBaseFallbacks: [],
  developerUserIds: [],
  demo: false,
  discordClientId: "1329184069426348052",
  invitePermissions: "5076723787231222",
  siteName: "Rift",
};
