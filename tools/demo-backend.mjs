/* In-memory stand-in for the Rift bot's Quart API.
 *
 * Mirrors web_server.py's response shapes (wrapping, key names, string IDs) so
 * the dashboard can be developed and tested without a live bot. Shared by
 * tools/dev-server.mjs, tools/demo-server.mjs and the integration tests. */

import { SETTINGS_SECTIONS, getSection } from "../assets/app/data/settings-schema.js";

export const DEMO_USER_ID = "900000000000000001";

export const DEMO_USER = {
  id: DEMO_USER_ID,
  username: "rift_demo",
  global_name: "Rift Demo",
  discriminator: "0",
  avatar: null,
  locale: "en-US",
  verified: true,
};

export const GUILDS = [
  { id: "100000000000000001", name: "Rift HQ", owner: true, permissions: "2199023255551", memberCount: 2841, onlineCount: 412 },
  { id: "100000000000000002", name: "Creative Lab", owner: false, permissions: "2199023255551", memberCount: 318, onlineCount: 47 },
  { id: "100000000000000003", name: "Late Night Lounge", owner: false, permissions: "0", memberCount: 92, onlineCount: 9 },
];

export const DEMO_GUILDS = GUILDS.map((guild) => ({
  id: guild.id,
  name: guild.name,
  icon: null,
  owner: guild.owner,
  permissions: guild.permissions,
  features: [],
  approximate_member_count: guild.memberCount,
}));

export const CHANNELS = [
  { id: "200000000000000101", name: "general", type: "text" },
  { id: "200000000000000102", name: "announcements", type: "text" },
  { id: "200000000000000103", name: "welcome", type: "text" },
  { id: "200000000000000104", name: "logs", type: "text" },
  { id: "200000000000000105", name: "mod-logs", type: "text" },
  { id: "200000000000000106", name: "starboard", type: "text" },
  { id: "200000000000000107", name: "counting", type: "text" },
  { id: "200000000000000108", name: "suggestions", type: "text" },
  { id: "200000000000000109", name: "reports", type: "text" },
  { id: "200000000000000110", name: "music", type: "voice" },
  { id: "200000000000000111", name: "voice lounge", type: "voice" },
  { id: "200000000000000112", name: "Staff", type: "category" },
  { id: "200000000000000113", name: "Tickets", type: "category" },
  { id: "200000000000000114", name: "ticket-0042", type: "text" },
];

export const ROLES = [
  { id: "300000000000000101", name: "Owner", color: "#f59e0b" },
  { id: "300000000000000102", name: "Admin", color: "#ef4444" },
  { id: "300000000000000103", name: "Moderator", color: "#00b8ff" },
  { id: "300000000000000104", name: "Verified", color: "#34d399" },
  { id: "300000000000000105", name: "Members", color: "#94a3b8" },
  { id: "300000000000000106", name: "Boosters", color: "#a78bfa" },
  { id: "300000000000000107", name: "Muted", color: "#64748b" },
  { id: "300000000000000108", name: "Level 10", color: "#fbbf24" },
];

const MEMBER_SEED = [
  ["900000000000000001", "Rift Demo", "rift_demo", false, true],
  ["900000000000000002", "Nova", "nova.exe", false, false],
  ["900000000000000003", "Orion", "orion_dev", false, false],
  ["900000000000000004", "Mira", "mira.codes", false, true],
  ["900000000000000005", "Kai", "kai_was_here", false, false],
  ["900000000000000006", "Iris", "iris.png", false, false],
  ["900000000000000007", "Rift Bot", "rift", true, false],
  ["900000000000000008", "Echo", "echo_", false, false],
  ["900000000000000009", "Sable", "sable.night", false, false],
  ["900000000000000010", "Juno", "juno_art", false, false],
  ["900000000000000011", "Theo", "theo", false, false],
  ["900000000000000012", "Lux", "lux_aura", false, false],
];

export const MEMBERS = MEMBER_SEED.map(([id, name, username, bot, timedOut]) => ({ id, name, username, bot, timedOut, admin: id === DEMO_USER_ID }));

const ACTION_POOL = ["ban", "kick", "warn", "timeout", "unban", "note", "clearwarns", "role_add", "role_remove", "delwarn"];
const REASONS = ["Repeated spam", "Ban evasion", "Slur in #general", "Advertising in DMs", "Mass mention spam", "Ignored three warnings", "Watch this account"];
const STOCK_SEED = [
  ["RIFT", "Rift Systems", "technology", 412.5, 0.021],
  ["NOVA", "Nova Dynamics", "technology", 187.12, 0.034],
  ["LUNA", "Luna Transit", "transport", 96.4, 0.018],
  ["EMBER", "Ember Energy", "energy", 54.2, 0.012],
  ["GLASS", "Glasshouse Media", "media", 128.7, 0.026],
  ["ATLAS", "Atlas Mining", "industry", 33.8, 0.009],
  ["VEGA", "Vega Biotech", "health", 246.9, 0.031],
  ["ORBIT", "Orbit Logistics", "transport", 78.35, 0.015],
  ["PULSE", "Pulse Audio", "media", 21.6, 0.041],
  ["QUANT", "Quanta Labs", "research", 512.3, 0.038],
  ["MOSS", "Moss & Co", "retail", 12.4, 0.007],
  ["HELIX", "Helix Genetics", "health", 174.05, 0.023],
];
const SEARCH_TRACKS = [
  { title: "Neon Skyline", author: "Aster", duration: 214, uri: "https://example.com/tracks/neon-skyline", artwork: "https://picsum.photos/seed/neonskyline/200/200" },
  { title: "Midnight Drive", author: "Kaze", duration: 187, uri: "https://example.com/tracks/midnight", artwork: "https://picsum.photos/seed/midnight/200/200" },
  { title: "Glass Rivers", author: "Lumen", duration: 241, uri: "https://example.com/tracks/glass-rivers", artwork: "https://picsum.photos/seed/glassrivers/200/200" },
  { title: "Static Bloom", author: "Aster", duration: 203, uri: "https://example.com/tracks/static-bloom", artwork: "https://picsum.photos/seed/staticbloom/200/200" },
  { title: "Low Orbit", author: "Quanta", duration: 258, uri: "https://example.com/tracks/low-orbit", artwork: "https://picsum.photos/seed/loworbit/200/200" },
  { title: "Signal Fires", author: "Nova Drift", duration: 192, uri: "https://example.com/tracks/signal-fires", artwork: "https://picsum.photos/seed/signalfires/200/200" },
];

function lcg(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const json = (value) => JSON.parse(JSON.stringify(value));
const nowSeconds = () => Math.floor(Date.now() / 1000);
const isoDay = (offset) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const avatarFor = (member) => `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(member?.username || "rift")}`;

function defaultForField(field) {
  switch (field.type) {
    case "boolean":
      return field.key === "enabled";
    case "number":
      return field.min ?? 1;
    case "tags":
      return [];
    case "select":
      return field.options?.[0]?.value ?? "";
    case "channel":
      return field.channelTypes?.includes("category") ? "200000000000000112" : CHANNELS[0].id;
    case "role":
      return ROLES[3].id;
    case "color":
      return "#00b8ff";
    case "json":
      return {};
    default:
      return "";
  }
}

function seedSettings(guildId) {
  const data = {};
  for (const section of SETTINGS_SECTIONS) {
    const values = {};
    for (const field of section.fields) values[field.key] = defaultForField(field);
    if (section.mode === "readonly") {
      const key = section.key === "giveaways" ? "giveaways" : section.key === "autoresponder" ? "responders" : "reaction_roles";
      values[key] = [];
    }
    data[section.key] = values;
  }
  data.automod = { enabled: true, anti_link: true, anti_caps: true, anti_spam: true, anti_mention: true, blocked_words: ["slur", "free nitro", "crypto giveaway"], ignored_channels: ["200000000000000104"], whitelist: [ROLES[2].id], punishment: "timeout", detection_threshold: 4 };
  data.antinuke = { enabled: true, punishment: "ban", default_threshold: 3, whitelist: [DEMO_USER_ID] };
  data.antiraid = { enabled: true, join_threshold: 12, join_window: 60, min_account_age: 7, punishment: "kick" };
  data.welcome = { enabled: true, channel_id: "200000000000000103", message: "Welcome {user} to {server}!", dm_message: "Thanks for joining Rift HQ.", auto_role_id: ROLES[4].id, embed_title: "A new arrival", embed_color: "#00b8ff", embed_footer: "Rift welcomes you", delete_after: 0 };
  data.goodbye = { enabled: true, channel_id: "200000000000000103", message: "{user} left the server." };
  data.leveling = { xp_per_message: 18, xp_cooldown: 60, xp_formula_base: 100, xp_formula_exponent: 1.6, level_up_channel: "200000000000000101", level_up_messages: true, level_up_image: true };
  data.voice_xp = { enabled: true, xp_per_minute: 8, require_others: true, ignore_muted: true, ignore_deafened: true, level_up_messages: true };
  data.invites = { enabled: true, track_fake: true, log_channel_id: "200000000000000104" };
  data.vanity = { vanity_string: "rift", strict: false, reward_role_id: ROLES[5].id, log_channel_id: "200000000000000104", thank_you_message: "Thanks for repping {server}!" };
  data.reports = { enabled: true, channel_id: "200000000000000109", ping_role_id: ROLES[2].id };
  data.counting = { channel_id: "200000000000000107", current_count: 382, last_user_id: MEMBERS[2].id, high_score: 914 };
  data.prefix = { value: "!" };
  data.disabled_commands = { items: ["eval", "shutdown", "restart"] };
  data.jail = { enabled: true, jail_role_id: ROLES[6].id, channel_id: "200000000000000114" };
  data.tickets = { enabled: true, delay: 300, close_delay: 60, archive: true };
  data.boost = { enabled: true, channel_id: "200000000000000101", message: "{user} just boosted the server!", embed_title: "New boost!", embed_description: "Thank you {user}!", embed_color: "#a78bfa" };
  data.starboard = { channel_id: "200000000000000106", threshold: 5 };
  data.logging = { channel_id: "200000000000000104", events: ["message_delete", "message_edit", "member_join", "member_remove", "member_ban", "role_update"] };
  data.verification = { role_id: ROLES[3].id, channel_id: "200000000000000103", message_id: "800000000000000123", roles_to_remove: [ROLES[7].id], type: "button", password_configured: true };
  data.modmail = { category_id: "200000000000000113", log_channel_id: "200000000000000104", ping_role_id: ROLES[2].id };
  data.suggestions = { channel_id: "200000000000000108" };
  data.confessions = { enabled: true, channel_id: "200000000000000101", log_channel_id: "200000000000000104" };
  data.bump = { enabled: true, channel_id: "200000000000000101", reminder_message: "It's bump o'clock!" };
  data.boosterrole = { enabled: true, role_name_template: "{user}'s colour", color: "#a78bfa" };
  data.socials = { subscriptions: [
    { platform: "youtube", username: "RiftBot", channel_id: "200000000000000102", last_alert_id: "vid-1" },
    { platform: "twitch", username: "riftlive", channel_id: "200000000000000102" },
  ] };
  data.giveaways = { giveaways: [
    { message_id: "800000000000000201", prize: "Nitro Classic (1 month)", ends_at: nowSeconds() + 3600, host: "Nova", entries: 214, guild_id: guildId },
    { message_id: "800000000000000202", prize: "Steam key", ends_at: nowSeconds() + 86400, host: "Iris", entries: 89, guild_id: guildId },
  ] };
  data.autoresponder = { responders: [{ trigger: "help", response: "Open a ticket with /ticket.", match: "exact" }] };
  data.reaction_roles = { reaction_roles: [{ emoji: "🎮", role_id: ROLES[4].id, message_id: "800000000000000301", channel_id: "200000000000000101" }] };
  return data;
}

export function createDemoBackend({ latency = 0, seed = 42 } = {}) {
  const random = lcg(seed);
  const startedAt = Date.now() - 1000 * 60 * 60 * 27;
  const settingsStore = new Map();
  const prefsStore = new Map();
  const playlistsStore = new Map();
  const attachments = new Map();
  const appeals = new Map();
  const appealsByUser = new Map();
  const otpStore = new Map();
  const verifyTokens = new Map();
  const bugReports = [];
  const bugAttachments = new Map();
  const calls = new Map();
  const warnings = new Map();
  const notes = new Map();
  const bans = new Map([["900000000000000099", { id: "900000000000000099", name: "SpamBot9000", reason: "Mass DM advertising", timestamp: nowSeconds() - 259200 }]]);
  let attachmentCounter = 1000;
  let appealCounter = 41;
  const metrics = { requests: 0, errors: 0, startedAt: Date.now() };

  const logsByGuild = new Map();
  const seededLogs = Array.from({ length: 84 }, () => {
    const member = MEMBERS[Math.floor(random() * MEMBERS.length)];
    const moderator = MEMBERS[Math.floor(random() * 3)];
    return {
      action_type: ACTION_POOL[Math.floor(random() * ACTION_POOL.length)],
      reason: REASONS[Math.floor(random() * REASONS.length)],
      timestamp: nowSeconds() - Math.floor(random() * 1814400),
      target_id: member.id,
      moderator_id: moderator.id,
      extra: {},
    };
  }).sort((a, b) => b.timestamp - a.timestamp);
  logsByGuild.set(GUILDS[0].id, seededLogs);
  logsByGuild.set(GUILDS[1].id, seededLogs.slice(0, 23));

  warnings.set("900000000000000004", [
    { id: "w1", reason: "Spamming the same meme 12 times", timestamp: nowSeconds() - 9000, moderator_id: MEMBERS[1].id },
  ]);
  notes.set("900000000000000004", [{ id: "n1", reason: "Known alt of an older banned account.", timestamp: nowSeconds() - 432000, moderator_id: MEMBERS[2].id }]);

  const stockState = STOCK_SEED.map(([symbol, name, sector, price, drift], index) => {
    const rng = lcg(seed + index * 31);
    const history = [];
    let value = price * 0.92;
    for (let point = 0; point < 48; point += 1) {
      value = Math.max(1, value * (1 + (rng() - 0.48) * drift));
      history.push(Number(value.toFixed(2)));
    }
    const last = history[history.length - 1];
    const prev = history[history.length - 2] || last;
    return {
      symbol, name, sector, price: last,
      volatility: Number((drift * 500).toFixed(1)),
      change_pct: Number((((last - prev) / prev) * 100).toFixed(2)),
      day_change_pct: Number((((last - history[0]) / history[0]) * 100).toFixed(2)),
      trend: "neutral",
      history,
    };
  });
  const portfolio = { cash: 18432.5, holdings: [{ symbol: "RIFT", qty: 12 }, { symbol: "VEGA", qty: 4 }, { symbol: "PULSE", qty: 40 }] };
  const news = [
    "Rift Systems beats projections after a strong earnings call.",
    "Analysts upgrade Vega Biotech on trial results.",
    "Pulse Audio slides as a rival launches a cheaper plan.",
  ];
  const events = [
    { name: "Tech rally", description: "Technology stocks drift upward.", duration: 3600, effect: "+0.4%", sector: "technology" },
    { name: "Energy shock", description: "Elevated energy volatility.", duration: 1800, effect: "±1.2%", sector: "energy" },
  ];

  const music = {
    connected: true, channel_id: "200000000000000110", channel_name: "music",
    playing: true, paused: false, volume: 72, loop: "off", shuffle: false, autoplay: true, position: 84,
    current: { title: "Neon Skyline", author: "Aster", uri: "https://example.com/tracks/neon-skyline", artwork: "https://picsum.photos/seed/neonskyline/300/300", duration: 214, requester: "Nova" },
    queue: [
      { title: "Midnight Drive", author: "Kaze", duration: 187, artwork: "https://picsum.photos/seed/midnight/200/200" },
      { title: "Glass Rivers", author: "Lumen", duration: 241, artwork: "https://picsum.photos/seed/glassrivers/200/200" },
      { title: "Static Bloom", author: "Aster", duration: 203, artwork: "https://picsum.photos/seed/staticbloom/200/200" },
    ],
    filters: [],
  };
  const musicHistory = [
    { title: "Neon Skyline", artist: "Aster", artwork: "https://picsum.photos/seed/neonskyline/200/200", duration: 214, url: "https://example.com/tracks/neon-skyline", played_at: nowSeconds() - 5400 },
    { title: "Midnight Drive", artist: "Kaze", artwork: "https://picsum.photos/seed/midnight/200/200", duration: 187, url: "https://example.com/tracks/midnight", played_at: nowSeconds() - 7200 },
    { title: "Static Bloom", artist: "Aster", artwork: "https://picsum.photos/seed/staticbloom/200/200", duration: 203, url: "https://example.com/tracks/static", played_at: nowSeconds() - 9300 },
  ];
  playlistsStore.set(DEMO_USER_ID, [
    { name: "focus", description: "Deep work loop", is_public: false, track_count: 3, created_at: nowSeconds() - 777600, updated_at: nowSeconds() - 172800, tracks: [
      { title: "Neon Skyline", url: "https://example.com/tracks/neon-skyline", duration: 214, artist: "Aster" },
      { title: "Low Orbit", url: "https://example.com/tracks/low-orbit", duration: 258, artist: "Quanta" },
      { title: "Signal Fires", url: "https://example.com/tracks/signal-fires", duration: 192, artist: "Nova Drift" },
    ] },
    { name: "party", description: "", is_public: true, track_count: 2, created_at: nowSeconds() - 2592000, updated_at: nowSeconds() - 345600, tracks: [
      { title: "Midnight Drive", url: "https://example.com/tracks/midnight", duration: 187, artist: "Kaze" },
      { title: "Static Bloom", url: "https://example.com/tracks/static-bloom", duration: 203, artist: "Aster" },
    ] },
  ]);

  function getGuildSettings(guildId) {
    if (!settingsStore.has(guildId)) settingsStore.set(guildId, seedSettings(guildId));
    return settingsStore.get(guildId);
  }
  function authUser(headers = {}) {
    const header = headers.authorization || headers.Authorization || "";
    const match = /^Bearer\s+(.+)$/i.exec(String(header));
    if (!match) return null;
    const token = match[1].trim();
    if (token.startsWith("user:")) return { id: token.slice(5) };
    return token ? { id: DEMO_USER_ID } : null;
  }
  function membersFor() {
    return MEMBERS.map((member) => ({
      ...member,
      avatar_url: avatarFor(member),
      joined_at: nowSeconds() - 86400 * (30 + Number(member.id.slice(-2))),
      roles: member.admin ? [ROLES[0], ROLES[1], ROLES[3]] : [ROLES[4]],
    }));
  }
  function resolveMember(query) {
    const value = String(query || "").trim().toLowerCase().replace(/^<@!?(\d+)>$/, "$1");
    if (!value) return null;
    const member = membersFor().find((entry) => entry.id === value || entry.username.toLowerCase() === value || entry.name.toLowerCase() === value);
    if (member) return member;
    const banned = bans.get(value);
    if (banned) return { id: banned.id, name: banned.name, username: banned.name.toLowerCase().replace(/\s+/g, "_"), bot: false, roles: [], joined_at: null, admin: false };
    return null;
  }
  const fmtModUser = (member) => ({ id: member?.id || "0", name: member?.name || "Unknown user", username: member?.username || "unknown", avatar: member ? avatarFor(member) : null });
  const guildLogs = (guildId) => logsByGuild.get(guildId) || [];
  function addLog(guildId, modId, targetId, action, reason) {
    const list = guildLogs(guildId);
    list.unshift({ action_type: action, reason, timestamp: nowSeconds(), target_id: targetId, moderator_id: modId, extra: {} });
    logsByGuild.set(guildId, list.slice(0, 500));
  }
  function modStats(guildId) {
    const list = guildLogs(guildId);
    const byAction = {};
    const byMod = {};
    for (const entry of list) {
      byAction[entry.action_type] = (byAction[entry.action_type] || 0) + 1;
      byMod[entry.moderator_id] = (byMod[entry.moderator_id] || 0) + 1;
    }
    const topMods = Object.entries(byMod).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, count]) => ({ ...fmtModUser(membersFor().find((m) => m.id === id)), count }));
    const activity7d = {};
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date();
      day.setUTCDate(day.getUTCDate() - offset);
      activity7d[dayNames[day.getUTCDay()]] = 0;
    }
    for (const entry of list) {
      if (nowSeconds() - entry.timestamp < 604800) {
        const day = dayNames[new Date(entry.timestamp * 1000).getUTCDay()];
        activity7d[day] = (activity7d[day] || 0) + 1;
      }
    }
    return { total: list.length, by_action: byAction, top_mods: topMods, activity_7d: activity7d };
  }
  function userDossier(member) {
    const guild = GUILDS[0];
    const memberWarnings = warnings.get(member.id) || [];
    const history = guildLogs(guild.id).filter((entry) => entry.target_id === member.id && entry.action_type !== "note").slice(0, 20).map((entry) => ({
      action: entry.action_type, reason: entry.reason, timestamp: entry.timestamp,
      moderator: fmtModUser(membersFor().find((m) => m.id === entry.moderator_id)),
    }));
    return {
      user: { id: member.id, name: member.name, username: member.username, avatar: avatarFor(member), bot: Boolean(member.bot), joined_at: member.joined_at, created_at: nowSeconds() - 77760000, is_banned: bans.has(member.id), in_guild: true, timed_out: Boolean(member.timedOut) },
      guild_id: guild.id, guild_name: guild.name,
      roles: member.roles.map((role) => ({ id: role.id, name: role.name, color: role.color })),
      warn_count: memberWarnings.length,
      warnings: memberWarnings.map((warning) => ({ id: warning.id, reason: warning.reason, timestamp: warning.timestamp, moderator: fmtModUser(membersFor().find((m) => m.id === warning.moderator_id)) })),
      notes: (notes.get(member.id) || []).map((note) => ({ reason: note.reason, timestamp: note.timestamp, moderator: fmtModUser(membersFor().find((m) => m.id === note.moderator_id)) })),
      history,
    };
  }
  function portfolioSnapshot() {
    let stockValue = 0;
    const holdings = portfolio.holdings.map((holding) => {
      const stock = stockState.find((entry) => entry.symbol === holding.symbol);
      if (!stock) return null;
      const value = Number((stock.price * holding.qty).toFixed(2));
      stockValue += value;
      return { symbol: stock.symbol, name: stock.name, qty: holding.qty, price: stock.price, value, sector: stock.sector, change_pct: stock.change_pct };
    }).filter(Boolean);
    return { holdings, cash: Number(portfolio.cash.toFixed(2)), stock_value: Number(stockValue.toFixed(2)), net_worth: Number((portfolio.cash + stockValue).toFixed(2)) };
  }
  function marketPayload() {
    return { stocks: json(stockState).sort((a, b) => b.price - a.price), events, news, last_update: nowSeconds() };
  }
  function currentCall(userId) {
    for (const call of calls.values()) {
      if (call.side_a?.members?.some((member) => member.id === userId) || call.side_b?.members?.some((member) => member.id === userId)) return call;
    }
    return [...calls.values()].find((call) => call.active) || null;
  }
  // A waiting call still has a code and side A; side B appears once matched.
  const callState = (call) =>
    call ? { code: call.code, start_ts: call.start_ts, side_a: call.side_a, side_b: call.active ? call.side_b : null } : null;
  function publicAppeal(record) {
    return {
      id: record.id, status: record.status, reason: record.reason, evidence: record.evidence,
      evidence_attachment_ids: record.evidence_attachment_ids || [],
      messages: record.messages.map((message) => ({ author: message.author, is_staff: message.is_staff, text: message.text, ts: message.ts, attachment_ids: message.attachment_ids || [] })),
      created_at: record.created_at, resolved_at: record.resolved_at,
    };
  }
  function acceptImage(body) {
    const dataUrl = String(body?.image || "");
    if (!dataUrl.startsWith("data:image/") || dataUrl.length > 4.3 * 1024 * 1024) return null;
    attachmentCounter += 1;
    const match = /^data:([^;,]+)/.exec(dataUrl);
    const index = dataUrl.indexOf(",");
    attachments.set(String(attachmentCounter), { id: attachmentCounter, mime: match ? match[1] : "application/octet-stream", base64: index >= 0 ? dataUrl.slice(index + 1) : "", created_at: nowSeconds() });
    return { id: attachmentCounter };
  }

  async function handle({ method = "GET", path = "", query = new URLSearchParams(), body = null, headers = {} } = {}) {
    metrics.requests += 1;
    if (latency) await new Promise((resolve) => setTimeout(resolve, latency));
    const route = String(path || "").replace(/^\/api(?=\/|$)/, "").replace(/\/+$/, "") || "/";
    const upper = String(method || "GET").toUpperCase();
    const params = new URLSearchParams(query);
    const auth = authUser(headers);
    const reply = (status, payload, type = "application/json") => {
      if (status >= 400) metrics.errors += 1;
      return { status, body: payload, type };
    };
    const unauthorized = () => reply(401, { error: "Unauthorized" });

    if (route === "/demo/me") return reply(200, DEMO_USER);
    if (route === "/demo/guilds") return reply(200, DEMO_GUILDS);

    if (route === "/stats") {
      const stats = {
        guilds: GUILDS.length, users: GUILDS.reduce((s, g) => s + g.memberCount, 0), online: GUILDS.reduce((s, g) => s + g.onlineCount, 0),
        latency: Number((21 + random() * 14).toFixed(1)), uptime: Math.floor((Date.now() - startedAt) / 1000),
        shards: 2, shard_count: 2, commands_ran: 128421, songs_played: 9214, version: "3.8.2", python: "3.11.9", discord_py: "2.4.0",
        bot_name: "Rift", bot_id: "1329184069426348052", cached_users: 9812, ws_ping: Number((31 + random() * 8).toFixed(1)), last_updated: nowSeconds(),
      };
      if (auth) {
        stats.cpu = Number((12 + random() * 26).toFixed(1));
        stats.ram_percent = Number((41 + random() * 18).toFixed(1));
        stats.ram_used = Math.round(820 + random() * 260);
        stats.ram_total = 2048;
      }
      return reply(200, stats);
    }
    if (route === "/bot/guild-ids") {
      if (!auth) return unauthorized();
      return reply(200, GUILDS.slice(0, 2).map((guild) => guild.id));
    }

    const infoMatch = /^\/guild\/(\d+)\/info$/.exec(route);
    if (infoMatch) {
      if (!auth) return unauthorized();
      const guild = GUILDS.find((entry) => entry.id === infoMatch[1]);
      if (!guild) return reply(404, { error: "Guild not found" });
      return reply(200, { id: guild.id, name: guild.name, icon: null, member_count: guild.memberCount, prefix: getGuildSettings(guild.id).prefix?.value || "!", channels: CHANNELS, roles: ROLES });
    }
    const analyticsMatch = /^\/analytics\/(\d+)$/.exec(route);
    if (analyticsMatch) {
      if (!auth) return unauthorized();
      const guild = GUILDS.find((entry) => entry.id === analyticsMatch[1]);
      if (!guild) return reply(404, { error: "Guild not found" });
      const rng = lcg(seed + Number(guild.id.slice(-1)) * 97);
      const dates = Array.from({ length: 14 }, (_, index) => isoDay(index - 13));
      const scale = guild.memberCount / 300;
      return reply(200, {
        guild_name: guild.name, member_count: guild.memberCount, online_count: guild.onlineCount, dates,
        joins: dates.map((_, index) => Math.round((4 + index * 1.2 + rng() * 9) * scale)),
        leaves: dates.map(() => Math.round((2 + rng() * 5) * scale)),
        messages: dates.map(() => Math.round((700 + rng() * 1400) * scale)),
        voice: dates.map(() => Math.round((160 + rng() * 320) * scale)),
      });
    }

    const settingsMatch = /^\/guild\/(\d+)\/settings\/([\w-]+)$/.exec(route);
    if (settingsMatch) {
      if (!auth) return unauthorized();
      const [, guildId, sectionKey] = settingsMatch;
      if (!GUILDS.some((guild) => guild.id === guildId)) return reply(404, { error: "Guild not found" });
      const section = getSection(sectionKey);
      if (!section) return reply(404, { error: "Unknown settings section" });
      const all = getGuildSettings(guildId);
      if (upper === "GET") return reply(200, { section: sectionKey, data: json(all[sectionKey] || {}), editable: section.mode !== "readonly" });
      if (section.mode === "readonly") return reply(403, { error: "This section is read-only from the dashboard" });
      const payload = body && typeof body === "object" ? body : {};
      if (sectionKey === "starboard" && !payload.channel_id) return reply(400, { error: "channel_id is required" });
      if (sectionKey === "logging" && !payload.channel_id) return reply(400, { error: "channel_id is required" });
      if (sectionKey === "modmail" && !payload.category_id) return reply(400, { error: "category_id is required" });
      if (sectionKey === "verification" && !payload.role_id) return reply(400, { error: "role_id is required" });
      if (sectionKey === "socials") {
        all.socials = { subscriptions: (Array.isArray(payload.subscriptions) ? payload.subscriptions : []).filter((entry) => ["youtube", "twitch", "tiktok", "kick"].includes(String(entry.platform || "").toLowerCase()) && entry.username && entry.channel_id).map((entry) => ({ platform: String(entry.platform).toLowerCase(), username: String(entry.username).trim(), channel_id: String(entry.channel_id), last_alert_id: null })) };
      } else if (section.mode === "strict") {
        const next = {};
        for (const field of section.fields) {
          if (field.key === "password") {
            if (payload.password) all[sectionKey].password_configured = true;
            continue;
          }
          next[field.key] = payload[field.key] !== undefined ? payload[field.key] : all[sectionKey][field.key];
        }
        if (sectionKey === "verification") {
          next.channel_id = all.verification.channel_id;
          next.message_id = all.verification.message_id;
          next.password_configured = all.verification.password_configured || Boolean(payload.password);
        }
        all[sectionKey] = next;
      } else if (section.mode === "keys") {
        all[sectionKey] = { ...all[sectionKey], ...Object.fromEntries((section.keys || []).filter((key) => payload[key] !== undefined).map((key) => [key, payload[key]])) };
      } else {
        all[sectionKey] = { ...all[sectionKey], ...json(payload) };
      }
      return reply(200, { ok: true });
    }

    const modStatsMatch = /^\/mod\/stats\/(\d+)$/.exec(route);
    if (modStatsMatch) {
      if (!auth) return unauthorized();
      return reply(200, modStats(modStatsMatch[1]));
    }
    const modLogsMatch = /^\/mod\/logs\/(\d+)$/.exec(route);
    if (modLogsMatch) {
      if (!auth) return unauthorized();
      const guildId = modLogsMatch[1];
      const limit = clamp(Number(params.get("limit")) || 50, 1, 200);
      const offset = Math.max(0, Number(params.get("offset")) || 0);
      const type = params.get("type") || "";
      const userQuery = params.get("user") || "";
      let list = guildLogs(guildId);
      if (userQuery) {
        const member = resolveMember(userQuery);
        list = list.filter((entry) => entry.target_id === (member?.id || userQuery));
      }
      if (type) list = list.filter((entry) => entry.action_type === type);
      list = [...list].sort((a, b) => b.timestamp - a.timestamp);
      return reply(200, {
        logs: list.slice(offset, offset + limit).map((entry) => ({
          action: entry.action_type, reason: entry.reason, timestamp: entry.timestamp,
          target: fmtModUser(membersFor().find((m) => m.id === entry.target_id)),
          moderator: fmtModUser(membersFor().find((m) => m.id === entry.moderator_id)),
          extra: entry.extra || {},
        })),
        total: list.length,
      });
    }
    const bansMatch = /^\/mod\/bans\/(\d+)$/.exec(route);
    if (bansMatch) {
      if (!auth) return unauthorized();
      return reply(200, { bans: [...bans.values()].map((entry) => ({ ...entry, avatar: avatarFor({ username: entry.name }) })) });
    }
    const membersMatch = /^\/mod\/members\/(\d+)$/.exec(route);
    if (membersMatch) {
      if (!auth) return unauthorized();
      const query = (params.get("q") || "").toLowerCase();
      return reply(200, {
        members: membersFor()
          .filter((member) => !query || member.name.toLowerCase().includes(query) || member.username.toLowerCase().includes(query) || member.id.includes(query))
          .slice(0, 25)
          .map((member) => ({ id: member.id, name: member.name, username: member.username, avatar: avatarFor(member), bot: Boolean(member.bot), timed_out: Boolean(member.timedOut) })),
      });
    }
    const rolesMatch = /^\/mod\/roles\/(\d+)$/.exec(route);
    if (rolesMatch) {
      if (!auth) return unauthorized();
      return reply(200, { roles: ROLES });
    }
    const userMatch = /^\/mod\/user\/(\d+)$/.exec(route);
    if (userMatch) {
      if (!auth) return unauthorized();
      const member = resolveMember(params.get("q") || "");
      if (!member) return reply(404, { error: "User not found" });
      return reply(200, userDossier(member));
    }
    if (route === "/mod/action" && upper === "POST") {
      if (!auth) return unauthorized();
      const payload = body || {};
      const guildId = String(payload.guild_id || "");
      if (!GUILDS.some((guild) => guild.id === guildId)) return reply(404, { error: "Guild not found" });
      const target = String(payload.target || "").trim();
      if (!target) return reply(400, { error: "A target user is required" });
      const member = resolveMember(target);
      if (!member) return reply(404, { error: "User not found" });
      const action = String(payload.action || "");
      const ALLOWED_ACTIONS = ["ban", "unban", "kick", "warn", "delwarn", "clearwarns", "timeout", "untimeout", "note", "nick", "forcenick", "forcenick_reset", "role_add", "role_remove"];
      if (!ALLOWED_ACTIONS.includes(action)) return reply(400, { error: `Unknown moderation action: ${action}` });
      const reason = payload.reason || "No reason provided";
      const extra = payload.extra || {};
      let status = "ok";
      if (action === "ban") {
        bans.set(member.id, { id: member.id, name: member.name, reason, timestamp: nowSeconds() });
        status = "banned";
      } else if (action === "unban") {
        if (!bans.has(member.id)) return reply(400, { error: "User is not banned" });
        bans.delete(member.id);
        status = "unbanned";
      } else if (action === "delwarn") {
        const list = warnings.get(member.id) || [];
        const filtered = list.filter((warning) => warning.id !== extra.warn_id);
        warnings.set(member.id, filtered);
        return reply(200, { status: filtered.length < list.length ? "removed" : "not_found" });
      } else if (action === "clearwarns") {
        warnings.set(member.id, []);
        status = "cleared";
      }
      else if (action === "warn") {
        const list = warnings.get(member.id) || [];
        list.push({ id: `w${Date.now()}`, reason, timestamp: nowSeconds(), moderator_id: auth.id });
        warnings.set(member.id, list);
        addLog(guildId, auth.id, member.id, "warn", reason);
        return reply(200, { status: "warned", total_warns: list.length });
      } else if (action === "note") {
        const list = notes.get(member.id) || [];
        list.push({ id: `n${Date.now()}`, reason, timestamp: nowSeconds(), moderator_id: auth.id });
        notes.set(member.id, list);
        addLog(guildId, auth.id, member.id, "note", reason);
        return reply(200, { status: "note_added" });
      } else if (action === "timeout") {
        member.timedOut = true;
        status = "timed_out";
      } else if (action === "untimeout") {
        member.timedOut = false;
        status = "untimeout";
      } else if (action === "kick") {
        member.kicked = true;
        status = "kicked";
      } else if (action === "nick") {
        member.nickname = String(extra.nick || payload.nickname || member.name);
        status = "nick_changed";
      } else if (action === "forcenick") {
        const nick = String(extra.nick || "").trim();
        if (!nick) return reply(400, { error: "Nickname is required" });
        if (nick.length > 32) return reply(400, { error: "Nickname must be 32 characters or fewer" });
        member.nickname = nick;
        member.forcenick = nick;
        status = "forcenick_set";
      } else if (action === "forcenick_reset") {
        member.forcenick = null;
        member.nickname = member.name;
        status = "forcenick_released";
      } else if (action === "role_add" || action === "role_remove") {
        const roleId = String(extra.role_id || payload.role_id || "");
        if (!roleId) return reply(400, { error: "role_id is required" });
        const role = ROLES.find((entry) => entry.id === roleId);
        if (!role) return reply(404, { error: "Role not found" });
        member.roles = member.roles || [];
        if (action === "role_add" && !member.roles.includes(roleId)) member.roles.push(roleId);
        if (action === "role_remove") member.roles = member.roles.filter((id) => id !== roleId);
        status = action === "role_add" ? "role_added" : "role_removed";
      }
      addLog(guildId, auth.id, member.id, action, reason);
      return reply(200, { status, user: member.name, total_warns: (warnings.get(member.id) || []).length });
    }

    const flagsMatch = /^\/verification\/flags\/(\d+)$/.exec(route);
    if (flagsMatch) {
      if (!auth) return unauthorized();
      return reply(200, [
        { id: 7, guild_id: flagsMatch[1], user_id: "900000000000000077", matched_user_id: "900000000000000099", fingerprint_hash: "4f9c2ab0d4d1e8e8a2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4d6e8", reason: "Ban Evasion Detected (Fingerprint Match)", created_at: nowSeconds() - 172800 },
        { id: 8, guild_id: flagsMatch[1], user_id: "900000000000000078", matched_user_id: "900000000000000098", fingerprint_hash: "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b", reason: "Ban Evasion Detected (Fingerprint Match)", created_at: nowSeconds() - 518400 },
      ]);
    }
    const printsMatch = /^\/verification\/fingerprints\/(\d+)$/.exec(route);
    if (printsMatch) {
      if (!auth) return unauthorized();
      return reply(200, [
        { id: 1, guild_id: printsMatch[1], user_id: "900000000000000002", fingerprint_hash: "11aa22bb33cc44dd55ee66ff77008899aabbccddeeff00112233445566778899", metadata: { language: "en-US", screen: "2560x1440", platform: "Linux" }, created_at: nowSeconds() - 345600 },
        { id: 2, guild_id: printsMatch[1], user_id: "900000000000000003", fingerprint_hash: "22bb33cc44dd55ee66ff77008899aabbccddeeff00112233445566778899aa00", metadata: { language: "en-GB", screen: "1920x1080", platform: "Win32" }, created_at: nowSeconds() - 777600 },
      ]);
    }
    if (route === "/verify" && upper === "POST") {
      const payload = body || {};
      const token = String(payload.token || "");
      const fingerprint = String(payload.fingerprint || "");
      if (token.length < 16 || fingerprint.length < 16) return reply(400, { error: "Missing or invalid token/fingerprint" });
      if (/flag/i.test(token)) return reply(403, { error: "Verification failed. Secure system detected a mismatch.", flagged: true });
      return reply(200, { status: "success" });
    }

    const musicStateMatch = /^\/music\/state\/(\d+)$/.exec(route);
    if (musicStateMatch) {
      if (!auth) return unauthorized();
      return reply(200, json(music));
    }
    if (route === "/music/control" && upper === "POST") {
      if (!auth) return unauthorized();
      const payload = body || {};
      const action = String(payload.action || "");
      if (action === "pause") {
        music.paused = true;
        music.playing = false;
      } else if (action === "resume") {
        music.paused = false;
        music.playing = Boolean(music.current);
      }
      else if (action === "skip") {
        const next = music.queue.shift();
        music.current = next ? { ...next, requester: "Rift Demo" } : null;
        music.position = 0;
      } else if (action === "previous") music.current = music.current ? { ...music.current } : null;
      else if (action === "stop") {
        music.connected = false;
        music.playing = false;
        music.current = null;
        music.queue = [];
        music.channel_name = "";
      } else if (action === "volume") music.volume = clamp(Number(payload.volume ?? 100), 0, 100);
      else if (action === "seek") music.position = Math.max(0, Number(payload.position) || 0);
      else if (action === "loop") music.loop = ["off", "track", "queue"].includes(payload.value) ? payload.value : "off";
      else if (action === "shuffle") music.shuffle = Boolean(payload.value);
      else if (action === "autoplay") music.autoplay = Boolean(payload.value);
      else if (action === "shuffle_queue") music.queue = [...music.queue].sort(() => random() - 0.5);
      else if (action === "clear") music.queue = [];
      else if (action === "remove") music.queue.splice(Number(payload.index) || 0, 1);
      else if (action === "jump") {
        const chosen = music.queue.splice(Number(payload.index) || 0, 1)[0];
        if (chosen) music.current = { ...chosen, requester: "Rift Demo" };
      } else if (action === "play" || action === "queue") {
        const query = String(payload.query || payload.uri || "");
        const found = SEARCH_TRACKS.find((track) => query.toLowerCase().includes(track.title.toLowerCase()) || track.uri === query) || {
          title: payload.title || query || "Unknown track", author: "Unknown artist", duration: 200, uri: query,
          artwork: `https://picsum.photos/seed/${encodeURIComponent(query.slice(0, 12) || "track")}/200/200`,
        };
        if (!music.connected) {
          music.connected = true;
          music.channel_id = "200000000000000110";
          music.channel_name = "music";
        }
        if (action === "play" || !music.current) {
          music.current = { ...found, requester: "Rift Demo" };
          music.playing = true;
          music.paused = false;
          music.position = 0;
        } else music.queue.push({ ...found });
      } else return reply(400, { error: `Unknown control action: ${action}` });
      musicHistory.unshift({ title: music.current?.title || "Unknown", artist: music.current?.author || "Unknown", artwork: music.current?.artwork || null, duration: music.current?.duration || 0, url: music.current?.uri || null, played_at: nowSeconds() });
      return reply(200, { status: "ok", action });
    }
    if (route === "/music/search" && upper === "POST") {
      if (!auth) return unauthorized();
      const query = String(body?.query || "").trim();
      if (!query) return reply(400, { error: "No query" });
      const results = SEARCH_TRACKS.filter((track) => `${track.title} ${track.author}`.toLowerCase().includes(query.toLowerCase()) || query.startsWith("http"));
      return reply(200, { results: results.length ? results : SEARCH_TRACKS.slice(0, 3) });
    }
    const historyMatch = /^\/music\/history\/(\d+)$/.exec(route);
    if (historyMatch) {
      if (!auth) return unauthorized();
      return reply(200, { history: musicHistory.slice(0, clamp(Number(params.get("limit")) || 12, 1, 50)) });
    }
    const topsMatch = /^\/music\/topsongs\/(\d+)$/.exec(route);
    if (topsMatch) {
      if (!auth) return unauthorized();
      return reply(200, { top: musicHistory.slice(0, 5).map((track, index) => ({ ...track, plays: 14 - index * 2 })) });
    }
    if (route === "/music/lyrics") {
      if (!auth) return unauthorized();
      return reply(200, { lyrics: ["Neon skyline, city breathing slow", "We are static in the afterglow", "Every signal finds a way back home", "", "Hold the frequency, don't let go", "Midnight colours in the undertow"].join("\n"), source: "demo" });
    }
    if (route === "/music/fix" && upper === "POST") {
      if (!auth) return unauthorized();
      const fix = String(body?.fix || "");
      if (!["region", "rejoin", "filters"].includes(fix)) return reply(400, { error: `Unknown fix type: ${fix}` });
      if (!music.connected) return reply(400, { error: "Bot is not in a voice channel" });
      return reply(200, { status: fix === "region" ? "Region set to Automatic" : fix === "rejoin" ? "Rejoined and resumed" : "Filters cleared" });
    }
    const playlistMatch = /^\/playlists\/(\d+)(?:\/([\w-]+))?$/.exec(route);
    if (playlistMatch) {
      if (!auth) return unauthorized();
      const [, userId, action = ""] = playlistMatch;
      const list = playlistsStore.get(userId) || [];
      if (!action && upper === "GET") return reply(200, { playlists: list });
      if (action === "create" && upper === "POST") {
        const name = String(body?.name || "").trim();
        if (!name) return reply(400, { error: "Name is required" });
        if (list.some((playlist) => playlist.name.toLowerCase() === name.toLowerCase())) return reply(400, { error: "You already have a playlist with that name" });
        if (list.length >= 25) return reply(400, { error: "Max 25 playlists reached" });
        const playlist = { name, description: "", is_public: false, track_count: 0, created_at: nowSeconds(), updated_at: nowSeconds(), tracks: [] };
        list.push(playlist);
        return reply(200, { status: "created", playlist });
      }
      if (action === "delete" && upper === "POST") {
        const next = list.filter((playlist) => playlist.name !== String(body?.name || ""));
        if (next.length === list.length) return reply(404, { error: "Playlist not found" });
        playlistsStore.set(userId, next);
        return reply(200, { status: "deleted" });
      }
      if (action === "rename" && upper === "POST") {
        const playlist = list.find((entry) => entry.name === String(body?.name || ""));
        if (!playlist) return reply(404, { error: "Playlist not found" });
        playlist.name = String(body?.new_name || "").trim() || playlist.name;
        playlist.updated_at = nowSeconds();
        return reply(200, { status: "renamed", playlist });
      }
      if (action === "remove_track" && upper === "POST") {
        const playlist = list.find((entry) => entry.name === String(body?.name || ""));
        if (!playlist) return reply(404, { error: "Playlist not found" });
        const index = Number(body?.index);
        if (!Number.isInteger(index) || index < 0 || index >= playlist.tracks.length) return reply(400, { error: "Invalid track index" });
        playlist.tracks.splice(index, 1);
        playlist.track_count = playlist.tracks.length;
        return reply(200, { status: "removed", playlist });
      }
      if (action === "play" && upper === "POST") {
        const playlist = list.find((entry) => entry.name === String(body?.name || ""));
        if (!playlist) return reply(404, { error: "Playlist not found" });
        if (!music.connected) return reply(400, { error: "Bot is not in a voice channel" });
        for (const track of playlist.tracks.slice(1)) music.queue.push({ title: track.title, author: track.artist, duration: track.duration, uri: track.url });
        if (playlist.tracks[0]) music.current = { title: playlist.tracks[0].title, author: playlist.tracks[0].artist, duration: playlist.tracks[0].duration, uri: playlist.tracks[0].url, requester: "Rift Demo" };
        music.playing = true;
        music.paused = false;
        music.position = 0;
        return reply(200, { status: "playing", name: playlist.name, count: playlist.tracks.length });
      }
      return reply(404, { error: "Unknown playlist action" });
    }
    const userVoiceMatch = /^\/user\/voice\/(\d+)\/(\d+)$/.exec(route);
    if (userVoiceMatch) {
      if (!auth) return unauthorized();
      return reply(200, { in_voice: false });
    }

    if (route === "/stocks/market") {
      if (!auth) return unauthorized();
      return reply(200, marketPayload());
    }
    const stockPortfolioMatch = /^\/stocks\/portfolio\/(\d+)$/.exec(route);
    if (stockPortfolioMatch) {
      if (!auth) return unauthorized();
      return reply(200, portfolioSnapshot());
    }
    if (route === "/stocks/trade" && upper === "POST") {
      if (!auth) return unauthorized();
      const payload = body || {};
      const symbol = String(payload.symbol || "").toUpperCase();
      const quantity = Math.floor(Number(payload.quantity));
      const action = String(payload.action || "");
      const stock = stockState.find((entry) => entry.symbol === symbol);
      if (!stock) return reply(404, { error: `Stock ${symbol} not found` });
      if (!Number.isFinite(quantity) || quantity < 1 || !["buy", "sell"].includes(action)) return reply(400, { error: "Invalid trade parameters" });
      const cost = Number((stock.price * quantity).toFixed(2));
      const holding = portfolio.holdings.find((entry) => entry.symbol === symbol);
      if (action === "buy") {
        if (portfolio.cash < cost) return reply(400, { error: "Insufficient balance", balance: portfolio.cash });
        portfolio.cash -= cost;
        if (holding) holding.qty += quantity;
        else portfolio.holdings.push({ symbol, qty: quantity });
        stock.price = Number((stock.price * (1 + 0.0004 * quantity)).toFixed(2));
        stock.history.push(stock.price);
        return reply(200, { status: "bought", symbol, qty: quantity, new_price: stock.price, cost });
      }
      if (!holding || holding.qty < quantity) return reply(400, { error: "Insufficient shares", quantity: holding?.qty || 0 });
      holding.qty -= quantity;
      portfolio.cash += cost;
      if (holding.qty === 0) portfolio.holdings = portfolio.holdings.filter((entry) => entry !== holding);
      stock.price = Number((stock.price * 0.997).toFixed(2));
      stock.history.push(stock.price);
      return reply(200, { status: "sold", symbol, qty: quantity, new_price: stock.price, received: cost });
    }
    if (route === "/stocks/leaderboard") {
      if (!auth) return unauthorized();
      return reply(200, { leaderboard: MEMBERS.slice(0, 10).map((member, index) => ({ user_id: member.id, name: member.name, avatar: avatarFor(member), cash: Number((24000 - index * 1730).toFixed(2)), stock_value: Number((index * 640 + 120).toFixed(2)), net_worth: Number((24000 - index * 1090 + 120).toFixed(2)) })).sort((a, b) => b.net_worth - a.net_worth) });
    }

    if (/^\/lastfm\/profile\/\d+$/.test(route)) {
      if (!auth) return unauthorized();
      return reply(200, { username: "rift_demo", real_name: "Rift Demo", playcount: 184203, artist_count: 4120, track_count: 21480, album_count: 5320, registered: nowSeconds() - 155520000, avatar: avatarFor(DEMO_USER), url: "https://www.last.fm/user/rift_demo", country: "Egypt" });
    }
    if (/^\/lastfm\/nowplaying\/\d+$/.test(route)) {
      if (!auth) return unauthorized();
      return reply(200, {
        now_playing: { name: "Neon Skyline", artist: "Aster", album: "Afterglow", image: "https://picsum.photos/seed/neonskyline/300/300", url: "https://www.last.fm/music/Aster", now_playing: true, date: null },
        recent: [
          { name: "Neon Skyline", artist: "Aster", album: "Afterglow", image: "https://picsum.photos/seed/neonskyline/300/300", url: "https://www.last.fm/music/Aster", now_playing: true, date: null },
          { name: "Midnight Drive", artist: "Kaze", album: "Night Roads", image: "https://picsum.photos/seed/midnight/300/300", url: "https://www.last.fm/music/Kaze", now_playing: false, date: String(nowSeconds() - 900) },
          { name: "Low Orbit", artist: "Quanta", album: "Zero G", image: "https://picsum.photos/seed/loworbit/300/300", url: "https://www.last.fm/music/Quanta", now_playing: false, date: String(nowSeconds() - 2400) },
        ],
      });
    }
    if (/^\/lastfm\/topartists\/\d+$/.test(route)) {
      if (!auth) return unauthorized();
      return reply(200, { artists: [["Aster", 412], ["Kaze", 388], ["Lumen", 302], ["Quanta", 274], ["Nova Drift", 233], ["Echo Garden", 201], ["Iris Vale", 178], ["Sable", 164]].map(([name, playcount], index) => ({ name, playcount, url: `https://www.last.fm/music/${encodeURIComponent(name)}`, image: `https://picsum.photos/seed/artist${index}/200/200` })) });
    }
    if (/^\/lastfm\/toptracks\/\d+$/.test(route)) {
      if (!auth) return unauthorized();
      return reply(200, { tracks: [["Neon Skyline", "Aster", 92], ["Midnight Drive", "Kaze", 78], ["Glass Rivers", "Lumen", 71], ["Static Bloom", "Aster", 64], ["Low Orbit", "Quanta", 58], ["Signal Fires", "Nova Drift", 44]].map(([name, artist, playcount], index) => ({ name, artist, playcount, url: `https://www.last.fm/music/${encodeURIComponent(artist)}`, image: `https://picsum.photos/seed/track${index}/200/200` })) });
    }
    if (/^\/lastfm\/weeklyartists\/\d+$/.test(route)) {
      if (!auth) return unauthorized();
      return reply(200, { artists: [["Aster", 41], ["Kaze", 33], ["Lumen", 27], ["Quanta", 22], ["Nova Drift", 18], ["Echo Garden", 15]].map(([name, playcount], index) => ({ name, playcount, url: `https://www.last.fm/music/${encodeURIComponent(name)}`, image: `https://picsum.photos/seed/week${index}/200/200` })) });
    }
    if (/^\/lastfm\/genres\/\d+$/.test(route)) {
      if (!auth) return unauthorized();
      return reply(200, { genres: [{ name: "Synthwave", score: 31.2 }, { name: "Electronic", score: 24.8 }, { name: "Dream Pop", score: 17.5 }, { name: "Ambient", score: 12.1 }, { name: "Indie", score: 8.4 }, { name: "House", score: 6 }] });
    }
    if (/^\/lastfm\/heatmap\/\d+$/.test(route)) {
      if (!auth) return unauthorized();
      const rng = lcg(seed + 11);
      return reply(200, { weeks: Array.from({ length: 52 }, (_, index) => ({ from: nowSeconds() - (52 - index) * 604800, count: Math.round(120 + rng() * 380 + Math.sin(index / 4) * 60) })) });
    }
    const chartMatch = /^\/lastfm\/chart\/(\d+)$/.exec(route);
    if (chartMatch) {
      if (!auth) return unauthorized();
      const type = params.get("type") || "albums";
      const size = clamp(Number(params.get("size")) || 3, 1, 7);
      const cells = [];
      for (let index = 0; index < size * size; index += 1) {
        const x = (index % size) * 150;
        const y = Math.floor(index / size) * 150;
        cells.push(`<rect x="${x + 2}" y="${y + 2}" width="146" height="146" rx="8" fill="#1c1f2b"/><text x="${x + 75}" y="${y + 75}" fill="#8b9bb4" font-family="sans-serif" font-size="12" text-anchor="middle">${type === "artists" ? "Aster" : "Afterglow"} #${index + 1}</text>`);
      }
      return reply(200, `<svg xmlns="http://www.w3.org/2000/svg" width="${size * 150}" height="${size * 150}">${cells.join("")}</svg>`, "image/svg+xml");
    }

    if (route === "/vc/guilds") {
      if (!auth) return unauthorized();
      return reply(200, { guilds: GUILDS.slice(0, 2).map((guild) => ({ id: guild.id, name: guild.name, icon: null })) });
    }
    if (route === "/vc/status") {
      if (!auth) return unauthorized();
      return reply(200, callState(currentCall(auth.id)) || {});
    }
    if (route === "/vc/call" && upper === "POST") {
      if (!auth) return unauthorized();
      const guildId = String(body?.guild_id || "");
      if ([...calls.values()].some((call) => call.active && (call.side_a?.guild_id === guildId || call.side_b?.guild_id === guildId))) return reply(409, { error: "Server already in a call. Use /vc hangup first." });
      if ([...calls.values()].some((call) => !call.active && call.side_a?.guild_id === guildId)) return reply(409, { error: "You are already waiting for a match from this server. Use the existing code or hang up." });
      const waiting = [...calls.values()].find((call) => !call.active && call.side_a?.guild_id !== guildId);
      const guild = GUILDS.find((entry) => entry.id === guildId);
      const side = { guild_id: guildId, guild_name: guild?.name || "Guild", guild_icon: null, vc_name: "voice lounge", members: [{ id: auth.id, username: DEMO_USER.username, display_name: DEMO_USER.global_name, avatar: null }] };
      if (waiting) {
        waiting.active = true;
        waiting.side_b = side;
        return reply(200, { status: "ok", matched: true, code: waiting.code });
      }
      const code = `R${Math.floor(1000 + random() * 8999)}`;
      calls.set(code, { code, start_ts: nowSeconds(), active: false, side_a: side, side_b: null });
      return reply(200, { status: "ok", matched: false, code });
    }
    if (route === "/vc/join" && upper === "POST") {
      if (!auth) return unauthorized();
      const code = String(body?.code || "").toUpperCase();
      const call = calls.get(code);
      if (!call) return reply(404, { error: `No call found with code ${code}` });
      if (call.active) return reply(409, { error: `Call ${code} is already active` });
      const guild = GUILDS.find((entry) => entry.id === String(body?.guild_id || ""));
      call.side_b = { guild_id: String(body?.guild_id || ""), guild_name: guild?.name || "Guild", guild_icon: null, vc_name: "voice lounge", members: [{ id: auth.id, username: DEMO_USER.username, display_name: DEMO_USER.global_name, avatar: null }] };
      call.active = true;
      return reply(200, { status: "ok", code });
    }
    if (route === "/vc/hangup" && upper === "POST") {
      if (!auth) return unauthorized();
      const call = currentCall(auth.id);
      if (!call) return reply(404, { error: "No active call found" });
      calls.delete(call.code);
      return reply(200, { status: "ok" });
    }

    const prefsMatch = /^\/prefs\/(\d+)$/.exec(route);
    if (prefsMatch) {
      if (!auth) return unauthorized();
      if (upper === "GET") return reply(200, prefsStore.get(prefsMatch[1]) || {});
      const payload = body && typeof body === "object" ? body : {};
      if (JSON.stringify(payload).length > 65536) return reply(400, { error: "Preferences too large" });
      prefsStore.set(prefsMatch[1], { ...(prefsStore.get(prefsMatch[1]) || {}), ...payload });
      return reply(200, { ok: true });
    }

    if (route === "/appeals/lookup" && upper === "POST") {
      const raw = String(body?.user_id || "");
      if (!/^\d+$/.test(raw)) return reply(400, { error: "Please enter a valid Discord user ID (numbers only)." });
      const member = MEMBERS.find((entry) => entry.id === raw);
      if (!member) return reply(404, { error: "No Discord account found with that ID." });
      return reply(200, { user_id: member.id, username: `${member.username}#0001`, avatar: avatarFor(member) });
    }
    if (route === "/appeals/send-otp" && upper === "POST") {
      const raw = String(body?.user_id || "");
      if (!/^\d+$/.test(raw)) return reply(400, { error: "Invalid user ID" });
      otpStore.set(raw, { at: Date.now() });
      return reply(200, { status: "sent" });
    }
    if (route === "/appeals/verify-otp" && upper === "POST") {
      const raw = String(body?.user_id || "");
      const code = String(body?.code || "");
      if (!otpStore.has(raw) || !/^\d{4}$/.test(code)) return reply(401, { error: "That code is wrong or has expired." });
      const token = `vt-${raw}-${Math.random().toString(36).slice(2, 10)}`;
      verifyTokens.set(token, { user_id: raw });
      return reply(200, { verify_token: token });
    }
    if (route === "/appeals/upload" && upper === "POST") {
      const token = String(body?.verify_token || "");
      if (!verifyTokens.has(token)) return reply(401, { error: "Your verification has expired -- please verify again." });
      const upload = acceptImage(body);
      if (!upload) return reply(400, { error: "Not a valid image" });
      attachments.get(String(upload.id)).verify_token = token;
      return reply(200, { id: upload.id });
    }
    if (route === "/appeals/submit" && upper === "POST") {
      const identity = verifyTokens.get(String(body?.verify_token || ""));
      if (!identity) return reply(401, { error: "Your identity verification has expired -- please verify again." });
      const reason = String(body?.reason || "").trim();
      if (reason.length < 10) return reply(400, { error: "Please explain your appeal in a bit more detail." });
      if (reason.length > 4000) return reply(400, { error: "That's too long -- please keep it under 4000 characters." });
      const existingToken = appealsByUser.get(identity.user_id);
      if (existingToken && appeals.get(existingToken)?.status === "pending") return reply(409, { error: "You already have an appeal being reviewed. Please wait for staff to respond before submitting another." });
      const member = MEMBERS.find((entry) => entry.id === identity.user_id) || { id: identity.user_id, name: `User ${identity.user_id}`, username: "appeal_user" };
      appealCounter += 1;
      const token = `appeal-${appealCounter}-${Math.random().toString(36).slice(2, 12)}`;
      const attachmentIds = Array.isArray(body?.attachment_ids) ? body.attachment_ids.slice(0, 10).map(Number) : [];
      const record = {
        id: appealCounter, token, user_id: identity.user_id,
        username_snapshot: `${member.username}#0001`, avatar_snapshot: avatarFor(member),
        reason, evidence: body?.evidence || null, status: "pending", created_at: nowSeconds(), resolved_at: null,
        messages: [{ author: `${member.username}#0001`, is_staff: false, text: reason, ts: nowSeconds(), attachment_ids: attachmentIds }],
        evidence_attachment_ids: attachmentIds,
      };
      appeals.set(token, record);
      appealsByUser.set(identity.user_id, token);
      for (const id of attachmentIds) if (attachments.has(String(id))) attachments.get(String(id)).appeal_id = record.id;
      return reply(200, { status: "submitted", id: record.id, thread_url: `https://staff.rift.cool/appeal/${token}` });
    }
    const threadMatch = /^\/appeals\/thread\/([A-Za-z0-9_-]+)(?:\/(message|upload))?$/.exec(route);
    if (threadMatch) {
      const [, token, action = ""] = threadMatch;
      const record = appeals.get(token);
      if (!record) return reply(404, { error: "Appeal not found" });
      if (upper === "GET" && !action) return reply(200, publicAppeal(record));
      if (record.status === "approved" || record.status === "denied") return reply(409, { error: "This appeal has already been resolved." });
      if (action === "message" && upper === "POST") {
        const text = String(body?.text || "").trim();
        const ids = Array.isArray(body?.attachment_ids) ? body.attachment_ids.slice(0, 10).map(Number) : [];
        if (!text && !ids.length) return reply(400, { error: "Message can't be empty" });
        record.messages.push({ author: record.username_snapshot, is_staff: false, text, ts: nowSeconds(), attachment_ids: ids });
        return reply(200, { status: "sent" });
      }
      if (action === "upload" && upper === "POST") {
        const upload = acceptImage(body);
        if (!upload) return reply(400, { error: "Not a valid image" });
        attachments.get(String(upload.id)).appeal_id = record.id;
        return reply(200, { id: upload.id });
      }
    }
    const attachmentMatch = /^\/appeals\/attachments\/(\d+)$/.exec(route);
    if (attachmentMatch) {
      const attachment = attachments.get(attachmentMatch[1]);
      if (!attachment) return reply(404, { error: "Not found" });
      const token = params.get("token") || "";
      const authorised = Boolean(
        (attachment.appeal_id && [...appeals.values()].some((appeal) => appeal.id === attachment.appeal_id && appeal.token === token)) ||
          (attachment.verify_token && attachment.verify_token === token && verifyTokens.has(token))
      );
      if (!authorised) return reply(401, { error: "Unauthorised" });
      return reply(200, Buffer.from(attachment.base64, "base64"), attachment.mime);
    }

    if (route === "/bugreports/submit" && upper === "POST") {
      const payload = body || {};
      const reporter = String(payload.user_id || "").trim();
      const description = String(payload.description || "").trim();
      const uploadKey = String(payload.upload_key || "").trim();
      const ids = Array.isArray(payload.attachment_ids) ? payload.attachment_ids.slice(0, 5).map(Number) : [];
      if (!/^\d+$/.test(reporter)) return reply(400, { error: "Please enter a valid Discord user ID" });
      if (description.length < 10) return reply(400, { error: "Please describe the bug in a bit more detail" });
      if (description.length > 4000) return reply(400, { error: "Please keep the description under 4000 characters" });
      if (Array.isArray(payload.attachment_ids) && payload.attachment_ids.length > 5) return reply(400, { error: "Max 5 images" });
      const fingerprint = String(payload.fingerprint || "unknown");
      const dayAgo = nowSeconds() - 86400;
      const recent = bugReports.filter((report) => report.fingerprint === fingerprint && report.created_at > dayAgo);
      if (recent.length >= 3) return reply(429, { error: "You've hit the daily limit of 3 bug reports. Try again tomorrow." });
      for (const id of ids) {
        const attachment = bugAttachments.get(String(id));
        if (!attachment || (uploadKey && attachment.upload_key !== uploadKey)) return reply(400, { error: "One of those uploads has expired" });
        attachment.report_id = bugReports.length + 1;
      }
      bugReports.push({ id: bugReports.length + 1, reporter_user_id: reporter, description, fingerprint, status: "open", created_at: nowSeconds(), attachment_ids: ids });
      return reply(200, { status: "submitted", id: bugReports.length });
    }
    if (route === "/bugreports/upload" && upper === "POST") {
      const uploadKey = String(body?.upload_key || "").trim();
      if (!uploadKey || uploadKey.length > 128) return reply(400, { error: "Missing or invalid upload_key" });
      const upload = acceptImage(body);
      if (!upload) return reply(400, { error: "Not a valid image" });
      bugAttachments.set(String(upload.id), { id: upload.id, upload_key: uploadKey, created_at: nowSeconds(), report_id: null });
      return reply(200, { id: upload.id });
    }

    return reply(404, { error: `No demo route for ${upper} ${route}` });
  }

  function liveStats() {
    return {
      guilds: GUILDS.length, users: GUILDS.reduce((s, g) => s + g.memberCount, 0), online: GUILDS.reduce((s, g) => s + g.onlineCount, 0),
      latency: Number((21 + random() * 14).toFixed(1)), uptime: Math.floor((Date.now() - startedAt) / 1000),
      shards: 2, shard_count: 2, commands_ran: 128421, songs_played: 9214, version: "3.8.2", bot_name: "Rift",
      cpu: Number((12 + random() * 26).toFixed(1)), ram_percent: Number((41 + random() * 18).toFixed(1)), ram_used: 934, ram_total: 2048,
      last_updated: nowSeconds(),
    };
  }

  return {
    handle, liveStats,
    callStateFor: (userId) => callState(currentCall(userId)),
    musicState: () => json(music),
    getGuildSettings, metrics,
    state: { settingsStore, playlistsStore, attachments, appeals, calls, portfolio, stockState, warnings, notes, bans, verifyTokens, otpStore, bugReports, bugAttachments },
  };
}
