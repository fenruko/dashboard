/* Pure ordering logic for the Channels page.
 *
 * Discord shows channels as: uncategorised channels first, then categories,
 * and inside each category text-like channels before voice/stage channels.
 * The page keeps that shape as a "layout" ({ top: [ids], cats: [{ id, children: [ids] }] })
 * so drag-and-drop and the up/down buttons can never produce an order Discord
 * itself would not display. `layoutToItems` turns a layout into the exact
 * payload of POST /guild/:id/channels/reorder. Snowflakes are always strings
 * (they exceed 2^53, so Number() would corrupt them). */

const CATEGORY = new Set(["category", "4"]);
const VOICE = new Set(["voice", "stage_voice", "stage", "2", "13"]);

export const isCategory = (channel) => CATEGORY.has(String(channel?.type ?? "").toLowerCase());
export const isVoice = (channel) => VOICE.has(String(channel?.type ?? "").toLowerCase());

function byPosition(a, b) {
  const delta = (a.position ?? 0) - (b.position ?? 0);
  if (delta) return delta;
  try {
    return BigInt(a.id) < BigInt(b.id) ? -1 : 1;
  } catch {
    return String(a.id).localeCompare(String(b.id));
  }
}

function orderBuckets(list) {
  const sorted = [...list].sort(byPosition);
  return [...sorted.filter((c) => !isVoice(c)), ...sorted.filter(isVoice)].map((c) => c.id);
}

export function indexById(channels) {
  return new Map((channels || []).map((channel) => [String(channel.id), channel]));
}

export function buildLayout(channels = []) {
  const categories = channels.filter(isCategory).sort(byPosition);
  const categoryIds = new Set(categories.map((c) => c.id));
  const rest = channels.filter((c) => !isCategory(c));
  return {
    top: orderBuckets(rest.filter((c) => !c.parent_id || !categoryIds.has(c.parent_id))),
    cats: categories.map((cat) => ({ id: cat.id, children: orderBuckets(rest.filter((c) => c.parent_id === cat.id)) })),
  };
}

function cloneLayout(layout) {
  return { top: [...layout.top], cats: layout.cats.map((cat) => ({ id: cat.id, children: [...cat.children] })) };
}

function removeId(layout, id) {
  layout.top = layout.top.filter((entry) => entry !== id);
  for (const cat of layout.cats) cat.children = cat.children.filter((entry) => entry !== id);
}

function keepBuckets(list, byId) {
  const text = list.filter((id) => !isVoice(byId.get(id)));
  const voice = list.filter((id) => isVoice(byId.get(id)));
  list.splice(0, list.length, ...text, ...voice);
}

/** Move a non-category channel into `parentId` (null = uncategorised), before `beforeId` (null = end). */
export function moveChannel(layout, byId, id, { parentId = null, beforeId = null } = {}) {
  const channel = byId.get(id);
  if (!channel || isCategory(channel) || id === beforeId) return layout;
  const next = cloneLayout(layout);
  removeId(next, id);
  const list = parentId ? next.cats.find((cat) => cat.id === parentId)?.children : next.top;
  if (!list) return layout;
  const at = beforeId ? list.indexOf(beforeId) : -1;
  list.splice(at < 0 ? list.length : at, 0, id);
  keepBuckets(list, byId);
  return next;
}

/** Move a category before `beforeId` (another category) or to the end. */
export function moveCategory(layout, id, beforeId = null) {
  if (id === beforeId) return layout;
  const next = cloneLayout(layout);
  const index = next.cats.findIndex((cat) => cat.id === id);
  if (index < 0) return layout;
  const [cat] = next.cats.splice(index, 1);
  const at = beforeId ? next.cats.findIndex((entry) => entry.id === beforeId) : -1;
  next.cats.splice(at < 0 ? next.cats.length : at, 0, cat);
  return next;
}

/** Swap with the neighbour above (-1) / below (+1) inside the same bucket. Returns the same layout at an edge. */
export function nudge(layout, byId, id, delta) {
  const next = cloneLayout(layout);
  const category = next.cats.findIndex((cat) => cat.id === id);
  if (category >= 0) {
    const to = category + delta;
    if (to < 0 || to >= next.cats.length) return layout;
    [next.cats[category], next.cats[to]] = [next.cats[to], next.cats[category]];
    return next;
  }
  const list = next.top.includes(id) ? next.top : next.cats.find((cat) => cat.children.includes(id))?.children;
  if (!list) return layout;
  const voice = isVoice(byId.get(id));
  let at = list.indexOf(id);
  let to = at + delta;
  while (to >= 0 && to < list.length && isVoice(byId.get(list[to])) !== voice) to += delta;
  if (to < 0 || to >= list.length) return layout;
  [list[at], list[to]] = [list[to], list[at]];
  return next;
}

/** Exact body for POST /channels/reorder. */
export function layoutToItems(layout) {
  const items = [];
  let position = 0;
  for (const id of layout.top) items.push({ id, position: position++, parent_id: null });
  for (const cat of layout.cats) items.push({ id: cat.id, position: position++ });
  for (const cat of layout.cats) cat.children.forEach((id, index) => items.push({ id, position: index, parent_id: cat.id }));
  return items;
}

/** Apply a layout to channel objects (returns new objects; unknown ids untouched). */
export function applyLayout(channels, layout) {
  const placed = new Map(layoutToItems(layout).map((item) => [item.id, item]));
  return channels.map((channel) => {
    const item = placed.get(channel.id);
    if (!item) return channel;
    return { ...channel, position: item.position, parent_id: isCategory(channel) ? null : item.parent_id ?? null };
  });
}

export function sameLayout(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ---------------- permission helpers ---------------- */

export const PERMISSION_GROUPS = [
  { id: "general", label: "General", names: ["view_channel", "manage_channels", "manage_permissions", "manage_webhooks", "create_instant_invite"] },
  {
    id: "text",
    label: "Text",
    names: [
      "send_messages", "send_messages_in_threads", "create_public_threads", "create_private_threads", "embed_links",
      "attach_files", "add_reactions", "use_external_emojis", "use_external_stickers", "mention_everyone",
      "manage_messages", "manage_threads", "read_message_history", "send_tts_messages", "use_application_commands",
    ],
  },
  { id: "voice", label: "Voice", names: ["connect", "speak", "stream", "use_voice_activation", "priority_speaker", "mute_members", "deafen_members", "move_members"] },
];

const LABELS = {
  manage_permissions: "Manage permissions",
  create_instant_invite: "Create invite",
  use_application_commands: "Use app commands",
  use_external_emojis: "Use external emoji",
  use_external_stickers: "Use external stickers",
  mention_everyone: "Mention @everyone, @here & all roles",
  send_tts_messages: "Send text-to-speech messages",
  use_voice_activation: "Use voice activity",
};

export function permissionLabel(name) {
  if (LABELS[name]) return LABELS[name];
  const text = String(name).replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Which permission groups make sense for a channel. */
export function groupsFor(channel, available = null) {
  const keep = (group) => {
    if (isCategory(channel)) return true;
    if (group.id === "text") return !isVoice(channel);
    if (group.id === "voice") return isVoice(channel);
    return true;
  };
  const known = available ? new Set(available) : null;
  return PERMISSION_GROUPS.filter(keep)
    .map((group) => ({ ...group, names: known ? group.names.filter((n) => known.has(n)) : group.names }))
    .filter((group) => group.names.length);
}

/** "allow" | "deny" | "inherit" for one permission in an overwrite. */
export function stateOf(overwrite, name) {
  if (overwrite?.allow?.includes(name)) return "allow";
  if (overwrite?.deny?.includes(name)) return "deny";
  return "inherit";
}

export function withState(overwrite, name, state) {
  const allow = (overwrite?.allow || []).filter((n) => n !== name);
  const deny = (overwrite?.deny || []).filter((n) => n !== name);
  if (state === "allow") allow.push(name);
  if (state === "deny") deny.push(name);
  return { ...overwrite, allow, deny };
}
