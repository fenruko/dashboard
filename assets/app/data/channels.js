/* Channel and role helpers shared by the settings pages.
 *
 * The bot's /guild/{id}/info returns `str(channel.type)` from discord.py, i.e.
 * the *name* ("text", "voice", "news", "forum", "stage_voice", "category"),
 * while the Discord API itself uses numbers (0, 2, 4, 5, 13, 15, 16). The
 * pickers used to compare against numbers only, so against the real bot every
 * type-filtered channel picker came up empty. Both spellings are accepted here
 * so the dashboard works with either. */

const KINDS = {
  // anywhere the bot can post or read messages (incl. forums / media for feeds)
  text: ["text", "news", "forum", "media", "0", "5", "15", "16"],
  // channels the bot can `send()` a normal message to
  sendable: ["text", "news", "0", "5"],
  voice: ["voice", "stage_voice", "2", "13"],
  category: ["category", "4"],
  forum: ["forum", "15"],
};

const KIND_SETS = Object.fromEntries(Object.entries(KINDS).map(([kind, values]) => [kind, new Set(values)]));

export function channelMatches(channel, kind) {
  const allowed = KIND_SETS[kind];
  if (!allowed) return true;
  return allowed.has(String(channel?.type ?? "").toLowerCase());
}

const KIND_LABELS = { text: "text", news: "announcement", forum: "forum", media: "media", voice: "voice", stage_voice: "stage", category: "category" };
const NUMERIC_NAMES = { 0: "text", 2: "voice", 4: "category", 5: "news", 13: "stage_voice", 15: "forum", 16: "media" };

export function channelTypeLabel(channel) {
  const raw = String(channel?.type ?? "").toLowerCase();
  const name = NUMERIC_NAMES[raw] || raw;
  return KIND_LABELS[name] || name || "channel";
}

export function channelOptions(guildInfo, kind) {
  return (guildInfo?.channels || [])
    .filter((channel) => !kind || channelMatches(channel, kind))
    .map((channel) => ({ value: String(channel.id), label: `#${channel.name}`, sub: channelTypeLabel(channel) }));
}

export function roleOptions(guildInfo) {
  return (guildInfo?.roles || []).map((role) => ({ value: String(role.id), label: `@${role.name}`, sub: String(role.id) }));
}

export function channelName(guildInfo, id) {
  if (!id) return "Not set";
  const channel = (guildInfo?.channels || []).find((entry) => String(entry.id) === String(id));
  return channel ? `#${channel.name}` : `ID ${id}`;
}

export function roleName(guildInfo, id) {
  if (!id) return "Not set";
  const role = (guildInfo?.roles || []).find((entry) => String(entry.id) === String(id));
  return role ? `@${role.name}` : `ID ${id}`;
}
