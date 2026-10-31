/* Settings schema for every section the bot exposes at
 * /api/guild/<id>/settings/<section>.
 *
 * Two important guarantees:
 *  1. Nothing the database returns is hidden. Curated fields are rendered with
 *     the right widget; any *additional* keys the bot returns are auto-rendered
 *     in a "Detected fields" area, so a bot update can never make a setting
 *     invisible or unsavable from the dashboard.
 *  2. Writes are shaped per section. Sections backed by `dict` setters send the
 *     full merged object (unknown keys preserved); sections backed by strict
 *     `**kwargs` setters send exactly the keys those setters accept.
 */

export const SETTINGS_GROUPS = [
  { id: "protection", label: "Protection", icon: "shield" },
  { id: "community", label: "Community", icon: "users" },
  { id: "support", label: "Support", icon: "ticket" },
  { id: "reference", label: "Reference", icon: "database" },
];

const LOG_EVENTS = [
  "message_delete",
  "message_edit",
  "message_bulk_delete",
  "member_join",
  "member_remove",
  "member_ban",
  "member_unban",
  "member_timeout",
  "member_update",
  "nickname_update",
  "role_create",
  "role_delete",
  "role_update",
  "channel_create",
  "channel_delete",
  "channel_update",
  "voice_join",
  "voice_leave",
  "invite_create",
  "invite_delete",
  "thread_create",
  "thread_delete",
  "emoji_create",
  "emoji_delete",
  "webhook_create",
  "webhook_delete",
];

const PUNISHMENTS = [
  { value: "delete", label: "Delete the message" },
  { value: "timeout", label: "Timeout the member" },
  { value: "warn", label: "Warn the member" },
  { value: "kick", label: "Kick the member" },
  { value: "ban", label: "Ban the member" },
  { value: "striproles", label: "Strip dangerous roles" },
  { value: "none", label: "Log only" },
];

/* Key → presentation metadata. Shared across sections so a key like
 * `channel_id` always gets a channel picker with the same label. */
const KEY_META = {
  enabled: { label: "Enabled", type: "boolean", help: "Turn this feature on or off." },
  channel_id: { label: "Channel", type: "channel" },
  log_channel_id: { label: "Log channel", type: "channel" },
  log_channel: { label: "Log channel", type: "channel" },
  level_up_channel: { label: "Level-up channel", type: "channel" },
  category_id: { label: "Category", type: "channel", channelTypes: ["category"] },
  role_id: { label: "Role", type: "role" },
  ping_role_id: { label: "Ping role", type: "role" },
  reward_role_id: { label: "Reward role", type: "role" },
  booster_role_id: { label: "Booster role", type: "role" },
  jail_role_id: { label: "Jail role", type: "role" },
  mute_role_id: { label: "Mute role", type: "role" },
  staff_role_id: { label: "Staff role", type: "role" },
  verified_role_id: { label: "Verified role", type: "role" },
  auto_role_id: { label: "Auto-role", type: "role" },
  welcome_channel_id: { label: "Welcome channel", type: "channel" },
  goodbye_channel_id: { label: "Goodbye channel", type: "channel" },
  counting_channel_id: { label: "Counting channel", type: "channel" },
  starboard_channel_id: { label: "Starboard channel", type: "channel" },
  suggestion_channel_id: { label: "Suggestion channel", type: "channel" },
  report_channel_id: { label: "Report channel", type: "channel" },
  message: { label: "Message", type: "textarea", help: "Supports Discord markdown; placeholders depend on the feature." },
  welcome_message: { label: "Welcome message", type: "textarea", help: "Supports {user} and {server}." },
  leave_message: { label: "Leave message", type: "textarea", help: "Supports {user} and {server}." },
  goodbye_message: { label: "Goodbye message", type: "textarea" },
  dm_message: { label: "Direct message", type: "textarea", help: "Sent to the member in DMs when they join." },
  description: { label: "Description", type: "textarea" },
  embed_title: { label: "Embed title", type: "text" },
  embed_description: { label: "Embed description", type: "textarea" },
  embed_footer: { label: "Embed footer", type: "text" },
  embed_color: { label: "Embed colour", type: "color" },
  embed_image: { label: "Embed image URL", type: "text", placeholder: "https://…" },
  embed_thumbnail: { label: "Embed thumbnail URL", type: "text", placeholder: "https://…" },
  punishment: { label: "Punishment", type: "select", options: PUNISHMENTS },
  action: { label: "Action", type: "select", options: PUNISHMENTS },
  threshold: { label: "Threshold", type: "number", min: 1 },
  default_threshold: { label: "Default threshold", type: "number", min: 1 },
  detection_threshold: { label: "Detection threshold", type: "number", min: 1 },
  join_threshold: { label: "Joins before locking down", type: "number", min: 1 },
  join_window: { label: "Join window (seconds)", type: "number", min: 1 },
  min_account_age: { label: "Minimum account age (days)", type: "number", min: 0 },
  spam_threshold: { label: "Spam threshold", type: "number", min: 1 },
  mention_limit: { label: "Mention limit", type: "number", min: 1 },
  caps_percent: { label: "Caps percentage", type: "number", min: 1, max: 100 },
  blocked_words: { label: "Blocked words", type: "tags", help: "One word or phrase per entry." },
  ignored_channels: { label: "Ignored channels", type: "tags", help: "Channel IDs that AutoMod skips." },
  whitelist: { label: "Whitelist", type: "tags", help: "User or role IDs exempt from punishment." },
  xp_per_message: { label: "XP per message", type: "number", min: 0 },
  xp_cooldown: { label: "XP cooldown (seconds)", type: "number", min: 0 },
  xp_formula_base: { label: "Formula base", type: "number", min: 1 },
  xp_formula_exponent: { label: "Formula exponent", type: "number", min: 0, step: 0.1 },
  xp_per_minute: { label: "XP per minute", type: "number", min: 0 },
  level_up_messages: { label: "Announce level-ups", type: "boolean" },
  level_up_image: { label: "Level-up image cards", type: "boolean" },
  require_others: { label: "Require another member in VC", type: "boolean" },
  ignore_muted: { label: "Ignore muted members", type: "boolean" },
  ignore_deafened: { label: "Ignore deafened members", type: "boolean" },
  track_fake: { label: "Flag fake invites", type: "boolean" },
  vanity_string: { label: "Vanity string", type: "text" },
  strict: { label: "Strict matching", type: "boolean" },
  thank_you_message: { label: "Thank-you message", type: "textarea" },
  thank_you_channel_id: { label: "Thank-you channel", type: "channel" },
  delay: { label: "Delay (seconds)", type: "number", min: 0 },
  events: { label: "Events", type: "tags", help: `Suggested: ${LOG_EVENTS.slice(0, 6).join(", ")}…` },
  type: { label: "Verification type", type: "select", options: [{ value: "button", label: "Button" }, { value: "password", label: "Password" }] },
  password: { label: "Password", type: "password", help: "Only used when the verification type is “password”." },
  roles_to_remove: { label: "Roles removed on verify", type: "tags", help: "Role IDs. Members lose these when verification succeeds." },
  subscriptions: { label: "Social feeds", type: "socials" },
  value: { label: "Prefix", type: "text", maxLength: 10 },
  items: { label: "Disabled commands", type: "tags", help: "Command names without a prefix, e.g. ban." },
  giveaways: { label: "Active giveaways", type: "json" },
  responders: { label: "Auto-responders", type: "json" },
  reaction_roles: { label: "Reaction roles", type: "json" },
};

const CURATED = {
  automod: [
    "enabled",
    "punishment",
    "detection_threshold",
    "spam_threshold",
    "mention_limit",
    "caps_percent",
    "blocked_words",
    "ignored_channels",
  ],
  antinuke: ["enabled", "punishment", "default_threshold", "whitelist", "log_channel"],
  antiraid: ["enabled", "join_threshold", "join_window", "min_account_age", "punishment", "log_channel"],
  welcome: ["enabled", "welcome_channel_id", "welcome_message", "leave_message", "dm_message", "auto_role_id"],
  goodbye: ["enabled", "channel_id", "message"],
  leveling: ["xp_per_message", "xp_cooldown", "xp_formula_base", "xp_formula_exponent", "level_up_channel", "level_up_messages", "level_up_image"],
  voice_xp: ["enabled", "xp_per_minute", "require_others", "ignore_muted", "ignore_deafened"],
  invites: ["enabled", "channel_id", "track_fake", "leave_message"],
  vanity: ["enabled", "vanity_string", "strict", "reward_role_id", "log_channel_id", "thank_you_channel_id", "thank_you_message"],
  reports: ["enabled", "channel_id", "ping_role_id"],
  counting: ["channel_id"],
  prefix: ["value"],
  disabled_commands: ["items"],
  jail: ["role_id", "channel_id"],
  tickets: ["enabled", "delay"],
  boost: [
    "enabled",
    "channel_id",
    "role_id",
    "embed_title",
    "embed_description",
    "embed_footer",
    "embed_color",
    "embed_image",
    "embed_thumbnail",
  ],
  starboard: ["channel_id", "threshold"],
  logging: ["channel_id", "events"],
  verification: ["role_id", "type", "password", "roles_to_remove"],
  modmail: ["category_id", "log_channel_id", "ping_role_id"],
  suggestions: ["channel_id"],
  confessions: ["enabled", "channel_id", "log_channel_id"],
  bump: ["enabled", "channel_id", "reminder_message"],
  boosterrole: [],
  socials: ["subscriptions"],
  giveaways: ["giveaways"],
  autoresponder: ["responders"],
  reaction_roles: ["reaction_roles"],
};

const LABEL_OVERRIDES = {
  "welcome.auto_role_id": { label: "Auto-role on join" },
  "welcome.leave_message": { label: "Leave message", help: "Shown in the welcome channel when a member leaves." },
  "verification.role_id": { label: "Role granted on verify" },
  "modmail.category_id": { label: "ModMail category", help: "New modmail threads are created inside this category." },
  "counting.channel_id": { label: "Counting channel" },
  "jail.channel_id": { label: "Jail channel" },
  "jail.role_id": { label: "Jail role" },
  "reports.channel_id": { label: "Reports channel" },
  "reports.ping_role_id": { label: "Staff role to ping" },
  "boost.role_id": { label: "Booster role (optional)" },
  "vanity.reward_role_id": { label: "Reward role" },
  "antinuke.log_channel": { label: "Security log channel" },
  "bump.reminder_message": { label: "Reminder message", type: "textarea" },
};

const SECTIONS = [
  {
    key: "automod",
    title: "AutoMod",
    group: "protection",
    icon: "bot",
    description: "Automatic spam, mention and bad-word protection for every message.",
    mode: "merge",
    notes: ["AutoMod runs before every other message handler, so punishments apply instantly."],
  },
  {
    key: "antinuke",
    title: "Anti-Nuke",
    group: "protection",
    icon: "shield-alert",
    description: "Detects mass-destructive actions from compromised staff and bots, then punishes the actor.",
    mode: "merge",
    notes: ["Whitelisted users are never punished. The bot must have a role above the offender."],
  },
  {
    key: "antiraid",
    title: "Anti-Raid",
    group: "protection",
    icon: "zap",
    description: "Locks the server automatically when joins spike beyond your threshold.",
    mode: "merge",
    notes: ["Account-age checks stop throwaway raid accounts. Manual lockdown overrides remain available in Discord."],
  },
  {
    key: "jail",
    title: "Jail",
    group: "protection",
    icon: "lock",
    description: "Roles and channels used by /jail to isolate a member without banning them.",
    mode: "merge",
  },
  {
    key: "welcome",
    title: "Welcome",
    group: "community",
    icon: "door-open",
    description: "Greeting, leave and DM messages sent when members come and go.",
    mode: "merge",
    notes: ["Variables: {user}, {user.name}, {user.display}, {server}, {member_count}, {time}, {date}."],
  },
  {
    key: "goodbye",
    title: "Goodbye",
    group: "community",
    icon: "log-out",
    description: "Farewell messages posted when a member leaves.",
    mode: "keys",
    keys: ["enabled", "channel_id", "message"],
  },
  {
    key: "leveling",
    title: "Leveling",
    group: "community",
    icon: "trending-up",
    description: "Text XP, level-up announcements and image cards.",
    mode: "keys",
    keys: ["xp_per_message", "xp_cooldown", "xp_formula_base", "xp_formula_exponent", "level_up_channel", "level_up_messages", "level_up_image"],
    notes: ["The level curve is `base × level ^ exponent`. Changes apply to future XP, not stored totals."],
  },
  {
    key: "voice_xp",
    title: "Voice XP",
    group: "community",
    icon: "mic",
    description: "XP earned for time spent in voice channels.",
    mode: "merge",
  },
  {
    key: "invites",
    title: "Invites",
    group: "community",
    icon: "link",
    description: "Invite attribution, fake-join detection and join/leave logging.",
    mode: "merge",
  },
  {
    key: "vanity",
    title: "Vanity",
    group: "community",
    icon: "sparkles",
    description: "Reward members who advertise your vanity in their status.",
    mode: "merge",
  },
  {
    key: "boost",
    title: "Boosts",
    group: "community",
    icon: "gift",
    description: "Announcement embed posted when somebody boosts the server.",
    mode: "merge",
    notes: ["Variables: {user}, {user.name}, {user.display}, {user.avatar}, {server}, {server.boost_count}, {server.boost_level}, {member_count}, {time}, {date}."],
  },
  {
    key: "boosterrole",
    title: "Booster Roles",
    group: "community",
    icon: "crown",
    description: "Custom booster role settings. Individual member → role mappings are managed by the bot.",
    mode: "detected",
    notes: ["The per-member role map is intentionally not editable from the dashboard."],
  },
  {
    key: "reports",
    title: "Reports",
    group: "support",
    icon: "flag",
    description: "Let members report messages to a private staff channel.",
    mode: "merge",
  },
  {
    key: "tickets",
    title: "Tickets",
    group: "support",
    icon: "ticket",
    description: "Ticket auto-delete behaviour and retention.",
    mode: "merge",
  },
  {
    key: "suggestions",
    title: "Suggestions",
    group: "support",
    icon: "star",
    description: "Channel where /suggest posts are collected and voted on.",
    mode: "keys",
    keys: ["channel_id"],
  },
  {
    key: "modmail",
    title: "ModMail",
    group: "support",
    icon: "mail",
    description: "Direct-message inbox routed into a private staff category.",
    mode: "strict",
    required: ["category_id"],
  },
  {
    key: "counting",
    title: "Counting",
    group: "support",
    icon: "hash",
    description: "Members count upward together, one number per message.",
    mode: "keys",
    keys: ["channel_id"],
  },
  {
    key: "confessions",
    title: "Confessions",
    group: "support",
    icon: "eye-off",
    description: "Anonymous confessions posted through the bot.",
    mode: "merge",
  },
  {
    key: "bump",
    title: "Bump reminders",
    group: "community",
    icon: "arrow-up-right",
    description: "Remind members to /bump the server and where the reminder is posted.",
    mode: "merge",
  },
  {
    key: "starboard",
    title: "Starboard",
    group: "reference",
    icon: "star",
    description: "Repost highly-reacted messages into a highlight channel.",
    mode: "strict",
    required: ["channel_id"],
  },
  {
    key: "logging",
    title: "Logging",
    group: "reference",
    icon: "file-text",
    description: "Server event log mirroring.",
    mode: "strict",
    required: ["channel_id"],
    notes: ["Leave `events` empty to log every supported event."],
  },
  {
    key: "verification",
    title: "Verification",
    group: "reference",
    icon: "shield",
    description: "Role granted on verification plus the web/button verification mode.",
    mode: "strict",
    required: ["role_id"],
    notes: [
      "The verification panel's channel and message are pinned by /setup_verification in Discord — editing them here would orphan the live panel, so this page deliberately carries them forward.",
      "Passwords are write-only: the API reports `password_configured` but never returns the hash.",
    ],
  },
  {
    key: "prefix",
    title: "Prefix",
    group: "reference",
    icon: "terminal",
    description: "Legacy text-command prefix. Slash commands are unaffected.",
    mode: "keys",
    keys: ["value"],
    required: ["value"],
  },
  {
    key: "disabled_commands",
    title: "Disabled commands",
    group: "reference",
    icon: "list",
    description: "Commands that should not run in this server.",
    mode: "keys",
    keys: ["items"],
  },
  {
    key: "autoresponder",
    title: "Auto-responders",
    group: "reference",
    icon: "inbox",
    description: "Keyword → reply triggers.",
    mode: "readonly",
    notes: ["Auto-responders are created with the bot's `/autoresponder` command; this view is a live read-only mirror."],
  },
  {
    key: "reaction_roles",
    title: "Reaction roles",
    group: "reference",
    icon: "sparkles",
    description: "Emoji → role mappings on existing messages.",
    mode: "readonly",
    notes: ["Reaction role panels are created in Discord; this view is a live read-only mirror."],
  },
  {
    key: "giveaways",
    title: "Giveaways",
    group: "reference",
    icon: "gift",
    description: "Giveaways currently running in this server.",
    mode: "readonly",
    notes: ["Giveaways are started and ended with the bot's giveaway commands."],
  },
  {
    key: "socials",
    title: "Social feeds",
    group: "reference",
    icon: "globe",
    description: "YouTube, Twitch, TikTok and Kick upload notifications.",
    mode: "socials",
    notes: ["Feeds post new uploads to the selected channel. Last-seen IDs are preserved when you save."],
  },
];

export const SETTINGS_SECTIONS = SECTIONS.map((section) => {
  const curated = CURATED[section.key] || [];
  const fields = curated.map((key) => {
    const meta = KEY_META[key] || { label: prettyKey(key) };
    const override = LABEL_OVERRIDES[`${section.key}.${key}`] || {};
    return { key, ...meta, ...override, curated: true };
  });
  if (section.key === "logging") {
    const events = fields.find((field) => field.key === "events");
    if (events) events.suggestions = LOG_EVENTS;
  }
  if (section.key === "verification") {
    const roles = fields.find((field) => field.key === "roles_to_remove");
    if (roles) roles.picker = "role";
  }
  return { ...section, fields };
});

const SECTION_MAP = new Map(SETTINGS_SECTIONS.map((section) => [section.key, section]));

export function getSection(key) {
  return SECTION_MAP.get(key) || null;
}

export function prettyKey(key) {
  return String(key || "")
    .replace(/_id$/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .replace(/^Ids$/, "IDs");
}

export function inferFieldType(key, value) {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (Array.isArray(value)) return "tags";
  if (value && typeof value === "object") return "json";
  if (key === "embed_color" || /(^|_)colou?r$/.test(key)) return "color";
  if (/_ids?$/.test(key) && !/(channel|role|user|guild|message|category)_ids?$/.test(key)) return "tags";
  if (key.endsWith("_ids")) return "tags";
  if (key.endsWith("_id")) {
    if (/channel|category|thread/.test(key)) return "channel";
    if (/role/.test(key)) return "role";
    return "text";
  }
  if (/message|description|text|template/.test(key)) return "textarea";
  if (typeof value === "string" && (value.length > 80 || value.includes("\n"))) return "textarea";
  return "text";
}

/** Build the row descriptors for a section given the API payload. */
export function buildSettingsModel(section, data) {
  const raw = data && typeof data === "object" && !Array.isArray(data) ? data : {};
  const curatedKeys = new Set(section.fields.map((field) => field.key));
  const extras = Object.keys(raw)
    .filter((key) => !curatedKeys.has(key) && key !== "password_hash")
    .sort((a, b) => a.localeCompare(b))
    .map((key) => {
      const value = raw[key];
      const type = inferFieldType(key, value);
      return {
        key,
        label: prettyKey(key),
        type,
        value,
        curated: false,
        advanced: type === "json",
      };
    });

  return {
    raw,
    fields: section.fields,
    extras,
    missing: section.required?.filter((key) => raw[key] == null || raw[key] === "" || raw[key] === 0) || [],
    passwordConfigured: Boolean(raw.password_configured),
    editable: section.mode !== "readonly",
  };
}

export function coerceValue(field, value) {
  if (value === undefined) return undefined;
  switch (field.type) {
    case "number": {
      if (value === "" || value == null) return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case "boolean":
      return Boolean(value);
    case "tags":
      return Array.isArray(value) ? value.map((v) => String(v).trim()).filter(Boolean) : [];
    case "channel":
    case "role": {
      if (value === "" || value == null) return field.optional ? null : null;
      return /^\d+$/.test(String(value)) ? String(value) : null;
    }
    case "json":
      return value;
    default:
      return value == null ? "" : String(value);
  }
}

export function validateField(field, value) {
  if (!field || field.type === "json") return "";
  const empty = value === "" || value == null || (Array.isArray(value) && value.length === 0);
  if (field.required && empty) return `${field.label} is required.`;
  if (empty) return "";
  if (field.type === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "Enter a number.";
    if (field.min != null && n < field.min) return `Must be at least ${field.min}.`;
    if (field.max != null && n > field.max) return `Must be at most ${field.max}.`;
  }
  if (field.type === "channel" || field.type === "role") {
    if (!/^\d+$/.test(String(value))) return "Pick a valid item.";
  }
  if (field.type === "text" && field.maxLength && String(value).length > field.maxLength) {
    return `Maximum ${field.maxLength} characters.`;
  }
  if (field.type === "password" && String(value).length > 128) return "Password is too long.";
  return "";
}

/** Convert a set of edited values into the exact JSON the section setter wants. */
export function buildSettingsPayload(section, raw, values, touched, extras = []) {
  const base = raw && typeof raw === "object" ? JSON.parse(JSON.stringify(raw)) : {};
  delete base.password_hash;
  delete base.password_configured;

  if (section.key === "socials") {
    const subscriptions = (values.subscriptions || raw?.subscriptions || [])
      .map((entry) => ({
        platform: String(entry.platform || "").toLowerCase(),
        username: String(entry.username || "").trim(),
        channel_id: String(entry.channel_id || ""),
      }))
      .filter((entry) => ["youtube", "twitch", "tiktok", "kick"].includes(entry.platform) && entry.username && entry.channel_id);
    return { ...base, subscriptions };
  }

  // Strict setters take explicit keyword arguments: send every curated field
  // with its current value so required arguments are never dropped when the
  // user only changed one of them.
  if (section.mode === "strict") {
    const out = {};
    for (const field of section.fields) {
      const value = values[field.key] !== undefined ? values[field.key] : base[field.key];
      if (field.key === "password" && !value) continue;
      out[field.key] = coerceValue(field, value);
    }
    if (out.password === "") delete out.password;
    if (section.key === "verification" && out.roles_to_remove) {
      out.roles_to_remove = out.roles_to_remove.map(Number).filter(Number.isFinite);
    }
    if (section.key === "logging" && typeof out.events === "string") {
      out.events = out.events.split(",").map((entry) => entry.trim()).filter(Boolean);
    }
    if (section.key === "prefix") out.value = String(out.value || "!").trim().slice(0, 10) || "!";
    return out;
  }

  // `keys` sections have a fixed, known key set (and a setter that merges).
  if (section.mode === "keys") {
    const out = {};
    for (const key of section.keys || []) {
      const field = section.fields.find((candidate) => candidate.key === key);
      if (field) out[key] = coerceValue(field, values[key] !== undefined ? values[key] : base[key]);
      else if (base[key] !== undefined) out[key] = base[key];
    }
    if (section.key === "prefix") out.value = String(out.value || "!").trim().slice(0, 10) || "!";
    if (section.key === "disabled_commands") {
      out.items = (out.items || []).map((item) => String(item).trim().toLowerCase()).filter(Boolean);
    }
    return out;
  }

  // Merge / detected sections: start from the live row so keys this dashboard
  // doesn't know about survive the round-trip.
  const out = base;
  for (const field of section.fields) {
    const isPresent = Object.prototype.hasOwnProperty.call(base, field.key);
    if (!touched.has(field.key)) continue;
    if (section.mode === "detected" && !isPresent) continue;
    out[field.key] = coerceValue(field, values[field.key]);
  }
  for (const field of extras) {
    if (touched.has(field.key)) out[field.key] = values[field.key];
  }
  return out;
}

export function validateSection(section, values, touched) {
  const errors = {};
  for (const field of section.fields) {
    if (section.mode === "keys" && !(section.keys || []).includes(field.key)) continue;
    if (section.mode === "detected" && !touched.has(field.key)) continue;
    const message = validateField(field, values[field.key]);
    if (message) errors[field.key] = message;
  }
  if (section.mode === "strict") {
    for (const key of section.required || []) {
      const value = values[key];
      if (value == null || value === "" || value === 0) errors[key] = `${prettyKey(key)} is required.`;
    }
  }
  if (section.key === "socials") {
    const subs = values.subscriptions || [];
    if (subs.some((entry) => !entry.username?.trim())) errors.subscriptions = "Every feed needs a username.";
  }
  return errors;
}

export const SETTINGS_EVENT_SUGGESTIONS = LOG_EVENTS;
export const SETTINGS_PUNISHMENTS = PUNISHMENTS;
