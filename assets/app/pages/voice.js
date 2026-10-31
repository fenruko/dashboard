/* Voice call: a two-server "call" bridge run by the bot's VCCall cog.
 * The API is intentionally simple — start, join by code, hang up — while the
 * state arrives over /ws/vc so both sides see joiners in real time. */

import { h, mount, clear, on } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import {
  avatar,
  badge,
  button,
  callout,
  card,
  copyButton,
  emptyState,
  errorState,
  iconButton,
  pageHeader,
  selectInput,
  skeleton,
  spinner,
  statusDot,
  textInput,
  toast,
} from "../ui/components.js";
import { asList } from "../data/endpoints.js";
import { fmtClock, fmtRelative, fmtInt, plural, toEpochMs } from "../core/format.js";

function normalizeCall(raw) {
  if (!raw || typeof raw !== "object") return null;
  const code = String(raw.code || "").trim();
  if (!code) return null;
  const start = toEpochMs(raw.start_ts ?? raw.started_at ?? raw.start_time);
  return {
    code,
    startedAt: start > 0 ? start : null,
    sideA: normalizeSide(raw.side_a || raw.sideA || raw.a),
    sideB: normalizeSide(raw.side_b || raw.sideB || raw.b),
    raw,
  };
}

function normalizeSide(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    guildId: String(raw.guild_id || raw.guildId || ""),
    guildName: raw.guild_name || raw.guildName || "Server",
    guildIcon: raw.guild_icon || raw.guildIcon || null,
    vcName: raw.vc_name || raw.vcName || raw.channel_name || "Voice channel",
    members: asList(raw, ["members"]).map((member) => ({
      id: String(member.id || ""),
      username: member.username || member.name || "Member",
      displayName: member.display_name || member.displayName || member.username || "Member",
      avatar: member.avatar || null,
    })),
  };
}

function guildIconUrl(guildId, iconHash, size = 64) {
  if (!iconHash || !guildId) return "";
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.png?size=${size}`;
}

function memberAvatarUrl(member) {
  if (!member.avatar || !member.id) return "";
  return `https://cdn.discordapp.com/avatars/${member.id}/${member.avatar}.png?size=64`;
}

export async function mountPage(ctx) {
  const { root, guild, guildId, user, endpoints, live, toast: notify, signal } = ctx;

  let disposed = false;
  let tickTimer = null;
  let pollTimer = null;
  const state = {
    guilds: { status: "loading", items: [], error: null },
    call: { status: "loading", data: null, error: null },
    selectedGuild: guildId || "",
    joinCode: "",
    busy: "",
    formError: null,
    matchedCode: "",
  };

  const page = h("div", { class: "page" });
  const headerActions = h("div", { class: "row" });
  const header = pageHeader({
    eyebrow: "Voice",
    title: "Voice call",
    description: "Bridge two servers into one call. Start a call from your voice channel, share the five-character code, and the bot relays both sides until one of you hangs up.",
    actions: headerActions,
  });
  let liveBadge = badge({ label: "Connecting…", tone: "neutral", dot: true });
  const refreshBtn = iconButton({ icon: "refresh", label: "Refresh", onClick: () => loadAll(true) });
  mount(headerActions, h("div", { class: "row", style: "gap:6px;align-items:center" }, liveBadge, refreshBtn));

  const content = h("div", { class: "stack" });
  mount(page, header, content);
  mount(root, page);

  const callHost = h("div");
  const setupHost = h("div");
  const infoCard = card({
    title: "How calls work",
    children: h(
      "ul",
      { class: "note-list" },
      h("li", null, "You must be connected to a voice channel in a server where the bot is present."),
      h("li", null, "Starting a call puts the bot in your channel. Another server can join with the code — if a call is already waiting, the bot matches you automatically."),
      h("li", null, "Both servers have to hang up separately? No — a single hangup tears down the whole bridge for both sides."),
      h("li", null, "Calls are relayed through the bot; audio never touches this dashboard.")
    ),
  });
  mount(content, callHost, setupHost, infoCard);

  /* ------------------------------ chrome ------------------------------ */

  function renderLiveBadge() {
    const status = live?.statusStore?.get()?.vc;
    const tone = status === "open" ? "success" : status === "connecting" || status === "reconnecting" ? "warning" : "neutral";
    const label = status === "open" ? "Live" : status === "connecting" ? "Connecting…" : status === "reconnecting" ? "Reconnecting…" : status === "unauthorized" ? "Sign in again" : "Polling";
    liveBadge.replaceWith((liveBadge = badge({ label, tone, dot: true })));
  }

  /* ------------------------------ call ------------------------------ */

  function renderCall() {
    clear(callHost);
    const call = state.call.data;
    if (state.call.status === "loading") {
      callHost.append(h("div", { class: "grid grid--2" }, skeleton({ h: 180 }), skeleton({ h: 180 })));
      return;
    }
    if (state.call.status === "error") {
      callHost.append(errorState({ error: state.call.error, title: "Couldn't load call state", onRetry: () => loadCall(true) }));
      return;
    }
    if (!call) {
      callHost.append(
        emptyState({
          icon: "phone-off",
          title: "No active call",
          message: "Start a call from your voice channel or join one with a code below.",
        })
      );
      return;
    }
    const participants = [...(call.sideA?.members || []), ...(call.sideB?.members || [])];
    const youAreIn = participants.some((member) => String(member.id) === String(user?.id));
    const duration = call.startedAt ? Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000)) : 0;
    const durationNode = h("span", { id: "vc-duration" }, fmtClock(duration));

    callHost.append(
      card({
        title: `Call ${call.code}`,
        className: "vc-card",
        actions: h(
          "div",
          { class: "row", style: "gap:6px;align-items:center" },
          badge({ label: youAreIn ? "You're in the call" : "Ongoing", tone: youAreIn ? "success" : "accent", dot: true }),
          copyButton({ text: call.code, label: "Copy code", successMessage: "Call code copied" }),
          button({ label: "Hang up", icon: "phone-off", variant: "danger", size: "sm", loading: state.busy === "hangup", onClick: () => hangup() })
        ),
        children: h(
          "div",
          { class: "stack" },
          h(
            "div",
            { class: "row", style: "gap:16px;flex-wrap:wrap;align-items:center" },
            h("div", null, h("div", { class: "muted", style: "font-size:11px" }, "Call code"), h("div", { class: "vc-code" }, call.code)),
            h("div", null, h("div", { class: "muted", style: "font-size:11px" }, "Duration"), h("strong", { style: "font-size:18px;font-variant-numeric:tabular-nums" }, durationNode)),
            h("div", null, h("div", { class: "muted", style: "font-size:11px" }, "Participants"), h("strong", { style: "font-size:18px" }, fmtInt(participants.length))),
            call.startedAt ? h("div", { class: "muted", style: "font-size:11px" }, `Started ${fmtRelative(call.startedAt)}`) : null
          ),
          h("div", { class: "vc-grid" }, sidePanel(call.sideA, "A"), h("div", { class: "vc-vs" }, icon("arrow-left-right", { size: 18 })), sidePanel(call.sideB, "B")),
          !youAreIn
            ? callout({ tone: "info", children: "You can watch this call but only participants can hang it up. Ask one of them to end it, or use the bot's /vc hangup command." })
            : null
        ),
      })
    );
  }

  function sidePanel(side, letter) {
    if (!side) {
      return h("div", { class: "vc-side" }, emptyState({ icon: "phone", title: `Side ${letter} connecting…`, message: "The bot is still joining this server's voice channel.", compact: true }));
    }
    return h(
      "div",
      { class: "vc-side" },
      h(
        "div",
        { class: "row", style: "gap:10px;align-items:flex-start;margin-bottom:10px" },
        side.guildIcon
          ? h("img", { src: guildIconUrl(side.guildId, side.guildIcon), alt: "", class: "guild-card-icon", style: "width:38px;height:38px" })
          : h("div", { class: "guild-card-icon guild-card-icon--fallback", style: "width:38px;height:38px;font-size:15px" }, (side.guildName || "?").slice(0, 1).toUpperCase()),
        h("div", { style: "min-width:0;flex:1" }, h("div", { class: "guild-card-title" }, h("h3", null, side.guildName)), h("div", { class: "muted", style: "font-size:11.5px" }, side.vcName)),
        badge({ label: `Side ${letter}`, tone: letter === "A" ? "accent" : "violet" })
      ),
      side.members.length
        ? h(
            "div",
            { class: "stack-tight" },
            ...side.members.map((member) =>
              h(
                "div",
                { class: "vc-member" },
                avatar({ name: member.displayName, src: memberAvatarUrl(member), size: 26 }),
                h("div", { style: "min-width:0;flex:1" }, h("div", { style: "font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" }, member.displayName), member.username && member.username !== member.displayName ? h("div", { class: "muted", style: "font-size:10.5px" }, `@${member.username}`) : null),
                String(member.id) === String(user?.id) ? badge({ label: "You", tone: "success" }) : null
              )
            )
          )
        : h("p", { class: "muted", style: "font-size:11.5px" }, "No human members in the channel yet.")
    );
  }

  /* ------------------------------ setup ------------------------------ */

  function renderSetup() {
    clear(setupHost);
    if (state.call.data) return; // hide start/join while a call is live

    const guildOptions = state.guilds.items.map((item) => ({ value: item.id, label: item.name }));
    const selected = state.selectedGuild || guildOptions[0]?.value || "";
    if (selected && selected !== state.selectedGuild) state.selectedGuild = selected;
    const selectedGuild = state.guilds.items.find((item) => item.id === selected);

    const startCard = card({
      title: "Start a call",
      subtitle: "The bot joins your current voice channel and waits for another server.",
      children: h(
        "div",
        { class: "stack" },
        state.guilds.status === "loading"
          ? spinner({ size: 16, label: "Loading your servers" })
          : state.guilds.status === "error"
            ? errorState({ error: state.guilds.error, compact: true, onRetry: () => loadGuilds(true) })
            : !guildOptions.length
              ? emptyState({ icon: "server", title: "No callable servers", message: "You need to share a server with the bot and be in one of its voice channels.", compact: true })
              : h(
                  "div",
                  { class: "stack" },
                  h("label", { class: "field" }, h("span", { class: "field-label" }, "Server"), selectInput({ value: selected, options: guildOptions, onChange: (value) => { state.selectedGuild = value; renderSetup(); } })),
                  selectedGuild?.icon ? h("div", { class: "row", style: "gap:8px" }, h("img", { class: "guild-card-icon", style: "width:32px;height:32px", src: guildIconUrl(selectedGuild.id, selectedGuild.icon), alt: "" }), h("span", { class: "muted", style: "font-size:11.5px" }, "Join a voice channel in this server before starting.")) : h("p", { class: "muted", style: "font-size:11.5px" }, "Join a voice channel in this server before starting."),
                  state.formError ? callout({ tone: "danger", children: state.formError }) : null,
                  button({ label: "Start call", icon: "phone", variant: "primary", full: true, loading: state.busy === "start", disabled: !selected, onClick: () => startCall(selected) })
                )
      ),
    });

    const codeInput = textInput({
      value: state.joinCode,
      placeholder: "e.g. A7K2Q",
      ariaLabel: "Call code",
      className: "mono",
      maxLength: 12,
      onInput: (value) => {
        state.joinCode = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        codeInput.value = state.joinCode;
      },
    });
    const joinCard = card({
      title: "Join a call",
      subtitle: "Enter the code from the other server. You must be in a voice channel too.",
      children: h(
        "div",
        { class: "stack" },
        h("label", { class: "field" }, h("span", { class: "field-label" }, "Call code"), codeInput),
        h("p", { class: "muted", style: "font-size:11.5px" }, "Codes are not case-sensitive. A waiting call in your server is matched automatically when you start one."),
        button({ label: "Join call", icon: "log-in", variant: "outline", full: true, loading: state.busy === "join", disabled: state.joinCode.length < 3 || !selected, onClick: () => joinCall(selected) })
      ),
    });

    setupHost.append(
      h(
        "div",
        { class: "grid grid--2" },
        startCard,
        joinCard
      )
    );
    if (state.matchedCode) {
      setupHost.append(
        callout({
          tone: "success",
          title: "Call started",
          children: `Share code ${state.matchedCode} with the other server. The bot is waiting in your voice channel.`,
          action: copyButton({ text: state.matchedCode, label: "Copy code", size: "sm" }),
        })
      );
    }
  }

  /* ------------------------------ actions ------------------------------ */

  async function startCall(selected) {
    if (state.busy) return;
    state.busy = "start";
    state.formError = null;
    renderSetup();
    try {
      const response = await endpoints.vcCall({ user_id: user.id, guild_id: selected });
      state.matchedCode = response?.code || "";
      notify.success(response?.matched ? `Matched into call ${response.code}` : `Call ready — code ${response.code}`);
      await loadCall(true);
      live?.requestVcState?.();
    } catch (error) {
      state.formError = error?.message || "Couldn't start the call";
      notify.error(state.formError);
    } finally {
      state.busy = "";
      renderSetup();
      renderCall();
    }
  }

  async function joinCall(selected) {
    if (state.busy || !state.joinCode) return;
    state.busy = "join";
    state.formError = null;
    renderSetup();
    try {
      const response = await endpoints.vcJoin({ user_id: user.id, guild_id: selected, code: state.joinCode });
      notify.success(`Joining call ${response?.code || state.joinCode}`);
      state.joinCode = "";
      state.matchedCode = response?.code || "";
      await loadCall(true);
      live?.requestVcState?.();
    } catch (error) {
      state.formError = error?.message || "Couldn't join the call";
      notify.error(state.formError);
    } finally {
      state.busy = "";
      renderSetup();
      renderCall();
    }
  }

  async function hangup() {
    const ok = await ctx.confirm({
      title: "Hang up the call?",
      message: "This ends the bridge for both servers immediately. The bot will leave both voice channels.",
      confirmLabel: "Hang up",
      danger: true,
    });
    if (!ok) return;
    state.busy = "hangup";
    renderCall();
    try {
      await endpoints.vcHangup({ user_id: user.id, guild_id: state.selectedGuild || guildId || null });
      notify.success("Call ended");
      state.matchedCode = "";
      await loadCall(true);
      live?.requestVcState?.();
    } catch (error) {
      notify.error(error?.message || "Couldn't hang up");
    } finally {
      state.busy = "";
      renderCall();
      renderSetup();
    }
  }

  /* ------------------------------- loads ------------------------------- */

  async function loadGuilds(force = false) {
    if (!force && state.guilds.items.length) return;
    if (!state.guilds.items.length) state.guilds.status = "loading";
    renderSetup();
    try {
      const payload = await endpoints.vcGuilds();
      state.guilds = { status: "ready", items: asList(payload, ["guilds"]), error: null };
      if (!state.selectedGuild && state.guilds.items.length) {
        state.selectedGuild = (state.guilds.items.find((item) => item.id === guildId) || state.guilds.items[0]).id;
      }
    } catch (error) {
      state.guilds = { status: "error", items: [], error };
    }
    renderSetup();
  }

  async function loadCall(force = false) {
    if (!force && state.call.data) return;
    if (!state.call.data) state.call.status = "loading";
    renderCall();
    try {
      const payload = await endpoints.vcStatus();
      const candidate =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? payload.code
            ? payload
            : payload.data ?? payload.call_state ?? payload.call ?? payload.state ?? payload
          : payload;
      const call = normalizeCall(candidate);
      state.call = { status: "ready", data: call, error: null };
    } catch (error) {
      state.call = { status: "error", data: null, error };
    }
    renderCall();
    renderSetup();
  }

  async function loadAll(force = false) {
    await Promise.allSettled([loadGuilds(force), loadCall(true)]);
    renderLiveBadge();
  }

  /* -------------------------------- live -------------------------------- */

  const unsubscribers = [];
  if (live) {
    live.attachVc?.();
    unsubscribers.push(
      live.subscribe("call_state", (payload) => {
        if (disposed) return;
        const call = normalizeCall(payload);
        state.call = { status: "ready", data: call, error: null };
        if (!call) state.matchedCode = "";
        renderCall();
        renderSetup();
      })
    );
    unsubscribers.push(
      live.subscribe("status", ({ channel }) => {
        if (channel === "vc" && !disposed) renderLiveBadge();
      })
    );
  }

  tickTimer = setInterval(() => {
    if (disposed) return;
    const node = document.getElementById("vc-duration");
    const call = state.call.data;
    if (!node || !call?.startedAt) return;
    node.textContent = fmtClock(Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000)));
  }, 1000);

  pollTimer = setInterval(() => {
    if (disposed || document.visibilityState === "hidden") return;
    if (live?.statusStore?.get()?.vc === "open") return;
    loadCall(true);
  }, 12_000);

  renderLiveBadge();
  renderCall();
  renderSetup();
  renderGuildsPlaceholder();

  function renderGuildsPlaceholder() {
    /* keeps layout stable before the async load resolves */
  }

  await loadAll();
  live?.requestVcState?.();

  return () => {
    disposed = true;
    clearInterval(tickTimer);
    clearInterval(pollTimer);
    for (const unsubscribe of unsubscribers) {
      try {
        unsubscribe?.();
      } catch {
        /* ignore */
      }
    }
    live?.detachVc?.();
  };
}
