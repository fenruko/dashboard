/* Lightweight settings index: just what the sidebar and command palette need,
 * so the 30 KB settings schema loads only when a settings page is opened.
 * tests/unit/settings-nav.test.mjs fails if this drifts from settings-schema.js. */

export const SETTINGS_GROUPS = [
  { id: "protection", label: "Protection", icon: "shield" },
  { id: "community", label: "Community", icon: "users" },
  { id: "support", label: "Support", icon: "ticket" },
  { id: "reference", label: "Reference", icon: "database" },
];

export const SETTINGS_NAV = [
  { key: "automod", title: "AutoMod", icon: "bot", group: "protection" },
  { key: "antinuke", title: "Anti-Nuke", icon: "shield-alert", group: "protection" },
  { key: "antiraid", title: "Anti-Raid", icon: "zap", group: "protection" },
  { key: "jail", title: "Jail", icon: "lock", group: "protection" },
  { key: "welcome", title: "Welcome", icon: "door-open", group: "community" },
  { key: "goodbye", title: "Goodbye", icon: "log-out", group: "community" },
  { key: "leveling", title: "Leveling", icon: "trending-up", group: "community" },
  { key: "voice_xp", title: "Voice XP", icon: "mic", group: "community" },
  { key: "invites", title: "Invites", icon: "link", group: "community" },
  { key: "vanity", title: "Vanity", icon: "sparkles", group: "community" },
  { key: "boost", title: "Boosts", icon: "gift", group: "community" },
  { key: "boosterrole", title: "Booster Roles", icon: "crown", group: "community" },
  { key: "reports", title: "Reports", icon: "flag", group: "support" },
  { key: "tickets", title: "Tickets", icon: "ticket", group: "support" },
  { key: "suggestions", title: "Suggestions", icon: "star", group: "support" },
  { key: "modmail", title: "ModMail", icon: "mail", group: "support" },
  { key: "counting", title: "Counting", icon: "hash", group: "support" },
  { key: "confessions", title: "Confessions", icon: "eye-off", group: "support" },
  { key: "bump", title: "Bump reminders", icon: "arrow-up-right", group: "community" },
  { key: "starboard", title: "Starboard", icon: "star", group: "reference" },
  { key: "logging", title: "Logging", icon: "file-text", group: "reference" },
  { key: "verification", title: "Verification", icon: "shield", group: "reference" },
  { key: "prefix", title: "Prefix", icon: "terminal", group: "reference" },
  { key: "disabled_commands", title: "Disabled commands", icon: "list", group: "reference" },
  { key: "autoresponder", title: "Auto-responders", icon: "inbox", group: "reference" },
  { key: "reaction_roles", title: "Reaction roles", icon: "sparkles", group: "reference" },
  { key: "giveaways", title: "Giveaways", icon: "gift", group: "reference" },
  { key: "socials", title: "Social feeds", icon: "globe", group: "reference" },
];
