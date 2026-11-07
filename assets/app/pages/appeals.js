/* Blacklist appeals — the one place users deal with a Rift blacklist.
 *
 * Signed in with Discord: the page shows the account's blacklist status
 * (including how long it lasts), its appeal and blacklist history, lets the
 * user resume an open appeal, and starts a new appeal with a single click — no
 * ID, no DM code, because the Discord login already proves who they are.
 *
 * Signed out: step 1 proves the visitor owns the blacklisted account with an
 * OTP sent by the bot over DM, step 2 submits the appeal. A visitor can also
 * choose to sign in instead.
 *
 * `mode: "blocked"` is how app.js renders this page for a blacklisted account
 * that tries to open the dashboard: the same account view, framed as "you
 * can't access the dashboard".
 *
 * The thread view is the follow-up channel between the user and staff (who
 * review appeals on staff.rift.cool); its token is the only credential, so it
 * is kept out of URLs we log and never sent anywhere but the bot API.
 */

import { h, mount, clear, on } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { badge, button, callout, checkboxControl, spinner, textInput } from "../ui/components.js";
import { fmtDateTime, fmtDuration, fmtRelative, plural, toEpochMs } from "../core/format.js";

const MAX_REASON = 4000;
const MAX_IMAGES = 10;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const THREAD_STORAGE = "rift_last_appeal_token";
const OPEN_STATUSES = new Set(["open", "claimed", "pending"]);

/* ------------------------------------------------------------ image utils */

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Couldn't read that file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image couldn't be decoded"));
    image.src = src;
  });
}

async function prepareImage(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Only PNG, JPEG, GIF or WEBP images are allowed.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`That image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 3 MB.`);
  }
  const dataUrl = await readFileAsDataUrl(file);
  // Animated GIFs stay byte-for-byte; re-encoding would lose the animation.
  if (file.type === "image/gif" || file.size < 900 * 1024) {
    return { dataUrl, name: file.name || "image", size: file.size, type: file.type };
  }
  try {
    const image = await loadImage(dataUrl);
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
    if (scale === 1) return { dataUrl, name: file.name || "image", size: file.size, type: file.type };
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const shrunk = canvas.toDataURL(outputType, 0.9);
    return { dataUrl: shrunk, name: file.name || "image", size: Math.round((shrunk.length * 3) / 4), type: outputType };
  } catch {
    return { dataUrl, name: file.name || "image", size: file.size, type: file.type };
  }
}

/** A pasted screenshot (Ctrl/Cmd+V) from the clipboard, if there is one. */
function imageFromClipboard(event) {
  const items = event.clipboardData?.items || [];
  for (const item of items) {
    if (item.type?.startsWith("image/")) return item.getAsFile();
  }
  return null;
}

/* ---------------------------------------------------------------- helpers */

function statusTone(status) {
  if (status === "approved") return "success";
  if (status === "denied") return "danger";
  if (OPEN_STATUSES.has(status)) return "warning";
  return "neutral";
}

function statusLabel(status) {
  switch (status) {
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case "open":
      return "Waiting for staff";
    case "claimed":
      return "Being reviewed";
    case "pending":
      return "Under review";
    default:
      return String(status || "Unknown");
  }
}

/** The bot sends unix seconds; older shapes send ms or ISO strings. */
function relativeOrDate(value) {
  const ms = toEpochMs(value);
  if (ms == null) return "";
  return `${fmtRelative(ms)} (${fmtDateTime(ms)})`;
}

function parseThreadToken(threadUrl) {
  if (!threadUrl) return "";
  try {
    const url = new URL(threadUrl, location.origin);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  } catch {
    return "";
  }
}

/** How long a blacklist lasts, for the status card and the blocked screen. */
function expiryText(blacklist) {
  if (!blacklist?.blacklisted) return "";
  const ms = blacklist.expires_at ? toEpochMs(blacklist.expires_at) : null;
  if (blacklist.permanent || !blacklist.expires_at) return "Permanent — it doesn't expire on its own";
  if (ms == null) return blacklist.duration_label ? `Lasts ${blacklist.duration_label}` : "Timed";
  const left = Math.round((ms - Date.now()) / 1000);
  if (left <= 0) return "Ended — refresh to continue";
  return `${fmtDuration(left, { units: 2 })} remaining`;
}

const HISTORY_LABEL = { add: "Blacklisted", remove: "Removed from blacklist", expired: "Blacklist expired" };
const HISTORY_TONE = { add: "danger", remove: "success", expired: "success" };

/* ------------------------------------------------------------------ page */

export async function mountPage(ctx) {
  const { root, endpoints, router, config, auth, ctx: routeCtx } = ctx;
  const routeToken = String(routeCtx?.params?.token || "").trim();
  const blockedMode = ctx.mode === "blocked";

  const session = auth?.get?.() || {};
  const signedIn = session.status === "ready" && Boolean(session.user);
  const me = signedIn
    ? {
        id: String(session.user.id || ""),
        username: session.user.globalName || session.user.global_name || session.user.username || "Your account",
        avatar: session.user.avatarUrl || "",
      }
    : null;

  let disposed = false;
  const cleanupFns = [];
  const page = h("div", { class: "auth-page" });
  const shell = h("main", { class: "auth-shell auth-shell--wide", role: "main" });
  mount(page, shell);
  mount(root, page);
  ctx.setTitle?.(routeToken ? "Appeal thread" : blockedMode ? "Access blocked" : "Blacklist appeal");

  const state = {
    step: signedIn ? "account" : "identify",
    userId: me?.id || "",
    user: me ? { username: me.username, avatar: me.avatar } : null,
    lookupBusy: false,
    otpSending: false,
    otpSentAt: 0,
    otpCode: "",
    verifyBusy: false,
    verifyToken: "",
    startingAppeal: false,
    reason: "",
    evidence: "",
    attachments: [],
    uploading: 0,
    consent: false,
    submitting: false,
    error: "",
    fieldError: "",
    result: null,
    account: null,
    accountLoading: false,
    accountError: "",
    lastToken: signedIn ? "" : readLastToken(),
  };

  /* ------------------------------- branding ------------------------------- */

  function brandLabel() {
    if (routeToken) return "Appeal thread";
    return blockedMode ? "Access blocked" : "Blacklist appeal";
  }

  function brand() {
    return h(
      "div",
      { class: "auth-brand" },
      h("img", { src: "/assets/riftlogo.jpg", alt: "", width: 30, height: 30, style: "border-radius:8px", onerror: (event) => { event.target.style.display = "none"; } }),
      h("div", null, h("strong", null, config?.siteName || "Rift"), h("div", { class: "muted", style: "font-size:10.5px;letter-spacing:.08em;text-transform:uppercase" }, brandLabel())),
      h("span", { style: "flex:1" }),
      blockedMode
        ? h("button", { class: "btn btn--ghost btn--sm", type: "button", onClick: () => auth?.logout?.() }, "Sign out")
        : h("a", { class: "btn btn--ghost btn--sm", href: "/", onClick: (event) => { event.preventDefault(); router.navigate("/guilds"); } }, "Dashboard")
    );
  }

  function steps(current) {
    const items = [
      { id: signedIn ? "account" : "identify", label: signedIn ? "Signed in" : "Verify account" },
      { id: "form", label: "Explain appeal" },
      { id: "done", label: "Submitted" },
    ];
    const order = items.map((item) => item.id);
    const position = current === "code" ? 0 : order.indexOf(current);
    return h(
      "ol",
      { class: "auth-steps", "aria-label": "Appeal progress" },
      ...items.map((item, index) =>
        h(
          "li",
          { class: `auth-step${index === position ? " is-active" : index < position ? " is-done" : ""}` },
          h("span", { class: "auth-step-index" }, index < position ? "✓" : String(index + 1)),
          h("span", null, item.label)
        )
      )
    );
  }

  function errorCallout() {
    if (!state.error) return null;
    return callout({ tone: "danger", title: "Something went wrong", children: state.error });
  }

  /* -------------------------------- flow -------------------------------- */

  function renderFlow() {
    if (disposed) return;
    clear(shell);
    shell.append(brand());
    // The account overview is a status page, not a step in the wizard.
    if (state.step !== "account") shell.append(steps(state.step));

    if (state.step === "account") renderAccount();
    else if (state.step === "identify" || state.step === "code") renderIdentify();
    else if (state.step === "form") renderForm();
    else if (state.step === "done") renderDone();
  }

  function stepHeader(title, description) {
    return h("div", { class: "auth-hero" }, h("h1", null, title), h("p", { class: "auth-sub" }, description));
  }

  /* ---------------------- signed in: status + history ---------------------- */

  function renderAccount() {
    const account = state.account;
    const bl = account?.blacklist;

    if (state.accountLoading && !account) {
      shell.append(stepHeader(blockedMode ? "Checking your account" : "Blacklist & appeals", "Loading your blacklist status…"), h("div", { style: "display:grid;place-items:center;padding:16px" }, spinner({ size: 20, label: "Loading your account" })));
      return;
    }
    if (state.accountError && !account) {
      shell.append(
        stepHeader("Couldn't load your account", "Rift's backend didn't answer. Try again in a moment."),
        callout({ tone: "danger", children: state.accountError }),
        button({ label: "Try again", icon: "refresh", variant: "primary", full: true, onClick: () => loadAccount() })
      );
      return;
    }
    if (!account) return;

    const blacklisted = Boolean(bl?.blacklisted);
    const title = blacklisted ? (blockedMode ? "You can't access the dashboard" : "You're blacklisted from Rift") : "Blacklist & appeals";
    const description = blacklisted
      ? blockedMode
        ? "Your Discord account is blacklisted from Rift, so the bot and this dashboard are unavailable until the blacklist ends or an appeal is approved."
        : "While you're blacklisted you can't use Rift's commands or the dashboard. You can appeal below."
      : "Your account is in good standing. If you're ever blacklisted from Rift, you can appeal right here.";

    const openAppeal = account.appeals.find((appeal) => OPEN_STATUSES.has(appeal.status));

    shell.append(
      stepHeader(title, description),
      h(
        "div",
        { class: "stack" },
        h(
          "div",
          { class: "list-row", style: "padding:0 0 4px" },
          state.user?.avatar ? h("img", { class: "result-art", style: "width:32px;height:32px;border-radius:50%", src: state.user.avatar, alt: "", referrerpolicy: "no-referrer" }) : null,
          h("div", { class: "list-row-main" }, h("div", { class: "list-row-title" }, state.user?.username || "Your account"), h("div", { class: "list-row-sub" }, `ID ${state.userId} · signed in with Discord`)),
          blacklisted ? badge({ label: "Blacklisted", tone: "danger", dot: true }) : badge({ label: "Good standing", tone: "success", dot: true })
        ),
        blacklisted ? statusCard(bl) : null,
        errorCallout(),
        accountActions(blacklisted, openAppeal),
        appealHistory(account.appeals),
        blacklistHistory(account.history),
        h(
          "div",
          { class: "auth-scopes" },
          "This is about being blocked from the Rift bot itself — not a ban from an individual Discord server. For server bans, contact that server's own staff."
        ),
        h(
          "div",
          { class: "auth-links", style: "justify-content:center" },
          blockedMode ? h("a", { href: "#", onClick: (event) => { event.preventDefault(); window.open("https://discord.com/app", "_blank", "noreferrer"); } }, "Open Discord") : null,
          blockedMode ? h("span", { class: "muted" }, "·") : null,
          h("a", { href: "#", onClick: (event) => { event.preventDefault(); loadAccount({ silent: true }); } }, "Refresh")
        )
      )
    );
  }

  function statusCard(bl) {
    const expiresMs = bl.expires_at ? toEpochMs(bl.expires_at) : null;
    const row = (label, value) =>
      h("div", { class: "row row--between", style: "gap:12px;padding:6px 0;border-bottom:1px solid var(--line)" }, h("span", { class: "muted", style: "font-size:12px" }, label), h("span", { style: "font-size:12.5px;text-align:right;white-space:pre-wrap" }, value));
    return h(
      "div",
      { class: "card", style: "padding:14px" },
      h("div", { class: "row", style: "gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:6px" }, icon("clock", { size: 15 }), h("strong", { class: "js-countdown" }, expiryText(bl))),
      row("Reason", bl.reason || "No reason provided"),
      row("Blacklisted", bl.banned_at ? relativeOrDate(bl.banned_at) : "—"),
      row("Length", bl.permanent || !bl.expires_at ? "Permanent" : bl.duration_label || "Timed"),
      expiresMs ? row("Ends", fmtDateTime(expiresMs)) : null
    );
  }

  function accountActions(blacklisted, openAppeal) {
    if (openAppeal) {
      const token = openAppeal.token;
      return h(
        "div",
        { class: "stack-tight" },
        callout({
          tone: "info",
          title: `Appeal #${openAppeal.id} is in progress`,
          children: `${statusLabel(openAppeal.status)}${openAppeal.staff_replied ? " · staff have replied" : ""}. You'll get a DM when staff reply or decide.`,
        }),
        token ? button({ label: "Resume appeal", icon: "message-square", variant: "primary", full: true, onClick: () => router.navigate(`/appeals/thread/${encodeURIComponent(token)}`) }) : null
      );
    }
    if (!blacklisted) {
      if (blockedMode) return button({ label: "Continue to the dashboard", variant: "primary", full: true, onClick: () => ctx.recheckStanding?.() });
      return null;
    }
    const ended = state.account?.blacklist?.expires_at && toEpochMs(state.account.blacklist.expires_at) <= Date.now();
    return h(
      "div",
      { class: "stack-tight" },
      button({ label: "Appeal this blacklist", icon: "send", variant: "primary", full: true, loading: state.startingAppeal, onClick: () => startAccountAppeal() }),
      ended ? button({ label: "My blacklist ended — check again", variant: "ghost", full: true, onClick: () => loadAccount({ silent: true }) }) : null
    );
  }

  function appealHistory(appeals) {
    return h(
      "div",
      { class: "card", style: "padding:14px" },
      h("div", { class: "section-label" }, "Your appeals"),
      appeals.length
        ? h(
            "div",
            { class: "stack-tight" },
            ...appeals.map((appeal) => {
              const open = OPEN_STATUSES.has(appeal.status);
              const bits = [`Submitted ${fmtRelative(appeal.created_at)}`];
              if (appeal.resolved_at) bits.push(`decided ${fmtRelative(appeal.resolved_at)}`);
              if (appeal.message_count) bits.push(plural(appeal.message_count, "message"));
              return h(
                "div",
                { class: "list-row" },
                h(
                  "div",
                  { class: "list-row-main" },
                  h("div", { class: "list-row-title" }, `Appeal #${appeal.id} `, badge({ label: statusLabel(appeal.status), tone: statusTone(appeal.status), dot: true })),
                  h("div", { class: "list-row-sub" }, bits.join(" · ")),
                  appeal.reason ? h("div", { class: "list-row-sub", style: "white-space:pre-wrap" }, appeal.reason.length > 140 ? `${appeal.reason.slice(0, 139)}…` : appeal.reason) : null
                ),
                appeal.token ? button({ label: open ? "Resume" : "View", size: "sm", variant: open ? "primary" : "outline", onClick: () => router.navigate(`/appeals/thread/${encodeURIComponent(appeal.token)}`) }) : null
              );
            })
          )
        : h("p", { class: "muted", style: "font-size:12px;margin:6px 0 0" }, "No appeals yet.")
    );
  }

  function blacklistHistory(history) {
    if (!history.length) return null;
    return h(
      "div",
      { class: "card", style: "padding:14px" },
      h("div", { class: "section-label" }, "Blacklist history"),
      h(
        "div",
        { class: "stack-tight" },
        ...history.map((entry) =>
          h(
            "div",
            { class: "list-row" },
            h(
              "div",
              { class: "list-row-main" },
              h("div", { class: "list-row-title" }, badge({ label: HISTORY_LABEL[entry.action] || String(entry.action || "Update"), tone: HISTORY_TONE[entry.action] || "neutral" })),
              entry.reason ? h("div", { class: "list-row-sub", style: "white-space:pre-wrap" }, entry.reason) : null,
              h("div", { class: "list-row-sub" }, [entry.duration_label ? `Length ${entry.duration_label}` : entry.action === "add" ? "Permanent" : "", entry.created_at ? fmtRelative(entry.created_at) : ""].filter(Boolean).join(" · "))
            )
          )
        )
      )
    );
  }

  async function loadAccount({ silent = false } = {}) {
    if (!signedIn || disposed) return;
    if (!silent) {
      state.accountLoading = true;
      state.accountError = "";
      if (state.step === "account") renderFlow();
    }
    try {
      const data = await endpoints.appealsMe();
      if (disposed) return;
      state.account = {
        blacklist: data?.blacklist || { blacklisted: false, blocked: false },
        appeals: Array.isArray(data?.appeals) ? data.appeals : [],
        history: Array.isArray(data?.history) ? data.history : [],
      };
      state.accountError = "";
      // The blacklist ended (timed out, or staff lifted it): let the app let them in.
      if (blockedMode && !state.account.blacklist.blocked) ctx.recheckStanding?.();
    } catch (error) {
      if (disposed) return;
      state.accountError = error?.message || "Couldn't load your appeals.";
    } finally {
      state.accountLoading = false;
      if (!disposed && state.step === "account") renderFlow();
    }
  }

  async function startAccountAppeal() {
    if (state.startingAppeal) return;
    state.startingAppeal = true;
    state.error = "";
    renderFlow();
    try {
      const response = await endpoints.appealsMeVerify();
      state.verifyToken = response?.verify_token || "";
      if (!state.verifyToken) throw new Error("The server didn't return a verification token.");
      state.attachments = [];
      state.step = "form";
    } catch (error) {
      if (error?.status === 409) {
        state.error = error.message || "You already have an appeal under review.";
        await loadAccount({ silent: true });
      } else if (error?.status === 400) {
        state.error = error.message || "You aren't blacklisted, so there's nothing to appeal.";
        await loadAccount({ silent: true });
      } else {
        state.error = error?.message || "Couldn't start your appeal.";
      }
    } finally {
      state.startingAppeal = false;
      renderFlow();
    }
  }

  /* ------------------- signed out: ID lookup + DM code ------------------- */

  function renderIdentify() {
    const verifying = state.step === "code";
    shell.append(
      stepHeader(
        verifying ? "Check your DMs" : "Appeal your blacklist",
        verifying
          ? `We sent a 4-digit code to ${state.user?.username || "your Discord account"}. Enter it below — the code expires in 10 minutes.`
          : "Use this form if Rift blacklisted you from the bot (not for a ban from an individual server — contact that server's staff for those). Start by confirming the Discord account. We'll send a one-time code to your DMs."
      )
    );

    if (!verifying) {
      const idInput = textInput({
        value: state.userId,
        placeholder: "Your Discord user ID (numbers only)",
        ariaLabel: "Discord user ID",
        className: "mono",
        inputMode: "numeric",
        maxLength: 32,
        onInput: (value) => {
          state.userId = value.replace(/[^\d]/g, "");
          idInput.value = state.userId;
          state.fieldError = "";
        },
      });
      const findButton = button({ label: "Find my account", icon: "search", variant: "primary", full: true, loading: state.lookupBusy, onClick: () => lookupUser() });
      shell.append(
        h(
          "div",
          { class: "stack" },
          h(
            "label",
            { class: "field" },
            h("span", { class: "field-label" }, "Discord user ID"),
            idInput,
            h("span", { class: "field-help" }, "In Discord: Settings → Advanced → Developer Mode, then right-click your name → Copy User ID. We never ask for your password or token.")
          ),
          state.fieldError ? h("p", { class: "field-error" }, state.fieldError) : null,
          errorCallout(),
          state.user
            ? h(
                "div",
                { class: "list-row", style: "padding:10px 0" },
                state.user.avatar ? h("img", { class: "result-art", style: "width:40px;height:40px;border-radius:50%", src: state.user.avatar, alt: "", referrerpolicy: "no-referrer" }) : h("div", { class: "result-art", style: "width:40px;height:40px;border-radius:50%;display:grid;place-items:center" }, icon("user", { size: 16 })),
                h("div", { class: "list-row-main" }, h("div", { class: "list-row-title" }, state.user.username || `User ${state.userId}`), h("div", { class: "list-row-sub" }, `ID ${state.userId}`)),
                badge({ label: "Found", tone: "success", dot: true })
              )
            : null,
          state.user
            ? button({ label: "Send code to my DMs", icon: "mail", variant: "primary", full: true, loading: state.otpSending, onClick: () => sendOtp() })
            : findButton,
          h("div", { class: "auth-scopes", style: "text-align:center" }, "Prefer not to look up your ID?"),
          button({ label: "Sign in with Discord instead", icon: "log-in", variant: "outline", full: true, onClick: () => auth?.beginLogin?.({ returnTo: "/appeals" }) }),
          state.lastToken
            ? h(
                "div",
                { class: "auth-links", style: "justify-content:center" },
                h("a", { href: `/appeals/thread/${encodeURIComponent(state.lastToken)}`, onClick: (event) => { event.preventDefault(); router.navigate(`/appeals/thread/${encodeURIComponent(state.lastToken)}`); } }, "Resume my last appeal")
              )
            : null,
          h("div", { class: "auth-scopes" }, "If your DMs are closed, the code can't be delivered. Open Discord → Privacy & Safety → allow direct messages from server members, then try again.")
        )
      );
      requestAnimationFrame(() => idInput.focus());
    } else {
      const codeInput = h("input", {
        class: "input mono",
        inputmode: "numeric",
        autocomplete: "one-time-code",
        maxlength: "4",
        value: state.otpCode,
        placeholder: "0000",
        "aria-label": "Verification code",
        style: "letter-spacing:.6em;text-align:center;font-size:22px",
      });
      let verifyButton = null;
      on(codeInput, "input", () => {
        state.otpCode = codeInput.value.replace(/[^\d]/g, "").slice(0, 4);
        codeInput.value = state.otpCode;
        state.fieldError = "";
        if (verifyButton) verifyButton.disabled = state.otpCode.length !== 4;
      });
      on(codeInput, "keydown", (event) => {
        if (event.key === "Enter" && state.otpCode.length === 4) verifyCode();
      });
      shell.append(
        h(
          "div",
          { class: "stack" },
          h("label", { class: "field" }, h("span", { class: "field-label" }, "4-digit code"), codeInput),
          state.fieldError ? h("p", { class: "field-error" }, state.fieldError) : null,
          errorCallout(),
          (verifyButton = button({ label: "Verify code", icon: "shield-check", variant: "primary", full: true, loading: state.verifyBusy, disabled: state.otpCode.length !== 4, onClick: () => verifyCode() })),
          h(
            "div",
            { class: "auth-links", style: "justify-content:center" },
            h("a", { href: "#", onClick: (event) => { event.preventDefault(); sendOtp(); } }, state.otpSending ? "Sending…" : "Send a new code"),
            h("span", { class: "muted" }, "·"),
            h("a", { href: "#", onClick: (event) => { event.preventDefault(); state.step = "identify"; state.user = null; state.otpCode = ""; state.error = ""; renderFlow(); } }, "Use a different account")
          ),
          state.otpSentAt ? h("div", { class: "auth-scopes", style: "text-align:center" }, `Code requested ${fmtRelative(state.otpSentAt)}. Check your spam / message requests folder too.`) : null
        )
      );
      requestAnimationFrame(() => codeInput.focus());
    }
  }

  /* --------------------------------- form --------------------------------- */

  function renderForm() {
    let submitBtn = null;
    shell.append(
      stepHeader(
        "Tell us what happened",
        "A human moderator reads every appeal. Be honest and specific — what happened, why it should be reconsidered, and anything staff should know. Threats or spam can get your account blocked from appealing."
      )
    );

    const reasonCounter = h("span", { class: "field-help" }, `${state.reason.length} / ${MAX_REASON}`);
    const reasonInput = h("textarea", {
      class: "input",
      rows: "7",
      maxlength: String(MAX_REASON),
      placeholder: "Explain why you believe the blacklist should be lifted…",
      "aria-label": "Appeal reason",
    });
    reasonInput.value = state.reason;
    on(reasonInput, "input", () => {
      state.reason = reasonInput.value;
      reasonCounter.textContent = `${state.reason.length} / ${MAX_REASON}`;
      state.fieldError = "";
    });

    const evidenceInput = h("textarea", {
      class: "input",
      rows: "3",
      maxlength: String(MAX_REASON),
      placeholder: "Optional: links, context, or paste (Ctrl/Cmd+V) a screenshot",
      "aria-label": "Evidence",
    });
    evidenceInput.value = state.evidence;
    on(evidenceInput, "input", () => {
      state.evidence = evidenceInput.value;
    });

    // Pasting a screenshot into either box attaches it, like the old staff form.
    const onPasteImage = (event) => {
      const file = imageFromClipboard(event);
      if (!file) return;
      event.preventDefault();
      handleFiles([file]);
    };
    on(reasonInput, "paste", onPasteImage);
    on(evidenceInput, "paste", onPasteImage);

    const fileInput = h("input", {
      type: "file",
      accept: ALLOWED_TYPES.join(","),
      multiple: true,
      class: "sr-only",
      id: "appeal-images",
      onchange: (event) => handleFiles(event.target.files),
    });
    const previews = h("div", { class: "art-grid", style: "grid-template-columns:repeat(auto-fill,minmax(84px,1fr))" });
    renderPreviews(previews);

    shell.append(
      h(
        "div",
        { class: "stack" },
        h(
          "div",
          { class: "list-row", style: "padding:0 0 4px" },
          state.user?.avatar ? h("img", { class: "result-art", style: "width:32px;height:32px;border-radius:50%", src: state.user.avatar, alt: "", referrerpolicy: "no-referrer" }) : null,
          h("div", { class: "list-row-main" }, h("div", { class: "list-row-title" }, state.user?.username || "Verified account"), h("div", { class: "list-row-sub" }, signedIn ? `ID ${state.userId} · signed in with Discord` : `ID ${state.userId} · verified with a DM code`)),
          badge({ label: signedIn ? "Signed in" : "Verified", tone: "success", dot: true })
        ),
        h("label", { class: "field" }, h("span", { class: "field-label" }, "Why should the blacklist be lifted?"), reasonInput, reasonCounter),
        h("label", { class: "field" }, h("span", { class: "field-label" }, "Evidence / context"), evidenceInput),
        h(
          "div",
          { class: "field" },
          h("span", { class: "field-label" }, `Screenshots (optional, max ${MAX_IMAGES})`),
          h(
            "div",
            { class: "row", style: "gap:8px;flex-wrap:wrap" },
            h("label", { class: "btn btn--outline btn--sm", for: "appeal-images" }, icon("upload", { size: 13 }), h("span", { class: "btn-label" }, state.uploading ? `Uploading ${state.uploading}…` : "Add images")),
            h("span", { class: "field-help" }, `PNG, JPEG, GIF or WEBP · 3 MB each · ${state.attachments.length}/${MAX_IMAGES} added`)
          ),
          fileInput,
          previews
        ),
        h(
          "div",
          { class: "field", style: "padding:10px;border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--bg-elev-2)" },
          checkboxControl({
            checked: state.consent,
            label: "I understand this appeal is reviewed by a human, my Discord account may be looked up, and abusive appeals can be blocked.",
            onChange: (value) => {
              state.consent = value;
              if (submitBtn) submitBtn.disabled = !value || state.submitting;
            },
          })
        ),
        state.fieldError ? h("p", { class: "field-error" }, state.fieldError) : null,
        errorCallout(),
        h(
          "div",
          { class: "form-actions" },
          button({ label: "Back", variant: "ghost", onClick: () => { state.step = signedIn ? "account" : "identify"; state.error = ""; renderFlow(); } }),
          (submitBtn = button({ label: "Submit appeal", icon: "send", variant: "primary", loading: state.submitting, disabled: !state.consent, onClick: () => submitAppeal() }))
        )
      )
    );
    requestAnimationFrame(() => reasonInput.focus());
  }

  function renderPreviews(host) {
    clear(host);
    for (const attachment of state.attachments) {
      host.append(
        h(
          "div",
          { class: "art-tile", style: "aspect-ratio:1" },
          h("img", { src: attachment.dataUrl, alt: attachment.name || "Evidence", style: "width:100%;height:100%;object-fit:cover" }),
          h(
            "button",
            {
              type: "button",
              class: "btn btn--icon btn--ghost btn--sm",
              style: "position:absolute;top:3px;right:3px;background:rgba(0,0,0,.6)",
              "aria-label": `Remove ${attachment.name || "image"}`,
              onClick: () => {
                state.attachments = state.attachments.filter((entry) => entry !== attachment);
                if (state.step === "form") renderFlow();
              },
            },
            icon("x", { size: 13 })
          )
        )
      );
    }
  }

  /** The verification token is tied to uploads; when it dies, start over cleanly. */
  function verificationExpired() {
    state.verifyToken = "";
    state.attachments = [];
    if (signedIn) {
      state.step = "account";
      state.error = "Your appeal session expired. Start the appeal again — what you wrote was kept, but re-add any screenshots.";
      loadAccount({ silent: true });
    } else {
      state.step = "identify";
      state.error = "Your verification expired. Verify again — what you wrote was kept, but re-add any screenshots.";
    }
  }

  async function handleFiles(fileList) {
    const files = [...(fileList || [])].slice(0, MAX_IMAGES - state.attachments.length);
    if (!files.length) return;
    state.error = "";
    state.uploading = files.length;
    try {
      for (const file of files) {
        if (state.attachments.length >= MAX_IMAGES) throw new Error(`You can attach up to ${MAX_IMAGES} images.`);
        const prepared = await prepareImage(file);
        const response = await endpoints.appealsUpload(state.verifyToken, prepared.dataUrl);
        if (!response?.id) throw new Error("The upload didn't return an attachment id.");
        state.attachments.push({ id: response.id, dataUrl: prepared.dataUrl, name: prepared.name, size: prepared.size });
        state.uploading -= 1;
        if (state.step === "form") renderFlow();
      }
    } catch (error) {
      if (error?.status === 401) verificationExpired();
      else state.error = error?.message || "Couldn't upload that image.";
    } finally {
      state.uploading = 0;
      if (state.step === "form" || state.step === "account" || state.step === "identify") renderFlow();
    }
  }

  /* --------------------------------- done --------------------------------- */

  function renderDone() {
    const result = state.result || {};
    const token = parseThreadToken(result.thread_url) || state.lastToken;
    shell.append(
      h(
        "div",
        { class: "stack" },
        h("div", { style: "display:grid;place-items:center;padding:8px" }, h("div", { style: "width:56px;height:56px;border-radius:50%;background:var(--success-soft);color:var(--success);display:grid;place-items:center" }, icon("check", { size: 28 }))),
        stepHeader("Appeal submitted", `Appeal #${result.id ?? "—"} is now in the staff inbox. You'll get a DM when someone replies or resolves it.`),
        callout({
          tone: "info",
          title: signedIn ? "Find it again any time" : "Keep this link",
          children: signedIn
            ? "Your appeal and the conversation with staff stay on this page whenever you're signed in."
            : "The thread below is your private conversation with staff. Anyone with the link can read it — don't share it publicly.",
        }),
        h(
          "div",
          { class: "auth-actions" },
          token
            ? button({ label: "Open my appeal thread", icon: "message-square", variant: "primary", full: true, onClick: () => router.navigate(`/appeals/thread/${encodeURIComponent(token)}`) })
            : null,
          signedIn ? button({ label: "Back to my appeals", variant: "outline", full: true, onClick: () => { state.step = "account"; state.reason = ""; state.evidence = ""; state.attachments = []; state.consent = false; state.verifyToken = ""; renderFlow(); loadAccount({ silent: true }); } }) : null,
          button({ label: "Open Discord", variant: "ghost", full: true, onClick: () => window.open("https://discord.com/app", "_blank", "noreferrer") })
        ),
        h("div", { class: "auth-scopes" }, "A copy of the thread link was also sent to your DMs. If you don't see it, check message requests.")
      )
    );
  }

  /* -------------------------------- actions -------------------------------- */

  function saveLastToken(token) {
    state.lastToken = token;
    try {
      if (token) localStorage.setItem(THREAD_STORAGE, token);
      else localStorage.removeItem(THREAD_STORAGE);
    } catch {
      /* ignore */
    }
  }

  function readLastToken() {
    try {
      return localStorage.getItem(THREAD_STORAGE) || "";
    } catch {
      return "";
    }
  }

  async function lookupUser() {
    if (state.lookupBusy) return;
    if (!/^\d{15,25}$/.test(state.userId)) {
      state.fieldError = "Discord user IDs are 15–25 digits. Right-click your name in Discord with Developer Mode on to copy it.";
      renderFlow();
      return;
    }
    state.lookupBusy = true;
    state.error = "";
    state.fieldError = "";
    renderFlow();
    try {
      const user = await endpoints.appealsLookup(state.userId);
      state.user = { username: user?.username || "", avatar: user?.avatar || "" };
    } catch (error) {
      state.user = null;
      state.error =
        error?.status === 404
          ? "No Discord account exists with that ID. Double-check the number."
          : error?.status === 429
            ? "Too many lookups from this network. Wait ten minutes and try again."
            : error?.message || "Couldn't look that account up.";
    } finally {
      state.lookupBusy = false;
      renderFlow();
    }
  }

  async function sendOtp() {
    if (state.otpSending) return;
    state.otpSending = true;
    state.error = "";
    state.fieldError = "";
    renderFlow();
    try {
      await endpoints.appealsSendOtp(state.userId);
      state.otpSentAt = Date.now();
      state.step = "code";
    } catch (error) {
      state.error =
        error?.status === 429
          ? "Too many codes requested. Wait a few minutes before trying again."
          : error?.status === 404
            ? "No Discord account exists with that ID."
            : error?.message || "Couldn't send the code.";
    } finally {
      state.otpSending = false;
      renderFlow();
    }
  }

  async function verifyCode() {
    if (state.verifyBusy) return;
    if (state.otpCode.length !== 4) {
      state.fieldError = "Enter the 4-digit code from the DM.";
      renderFlow();
      return;
    }
    state.verifyBusy = true;
    state.error = "";
    state.fieldError = "";
    renderFlow();
    try {
      const response = await endpoints.appealsVerifyOtp(state.userId, state.otpCode);
      state.verifyToken = response?.verify_token || "";
      if (!state.verifyToken) throw new Error("The server didn't return a verification token.");
      state.step = "form";
    } catch (error) {
      state.fieldError = error?.status === 401 ? "That code is wrong or has expired. Request a new one." : error?.message || "Couldn't verify that code.";
    } finally {
      state.verifyBusy = false;
      renderFlow();
    }
  }

  async function submitAppeal() {
    if (state.submitting) return;
    const reason = state.reason.trim();
    if (reason.length < 10) {
      state.fieldError = "Please explain your appeal in at least 10 characters.";
      renderFlow();
      return;
    }
    if (reason.length > MAX_REASON) {
      state.fieldError = `Please keep it under ${MAX_REASON} characters.`;
      renderFlow();
      return;
    }
    if (!state.consent) {
      state.fieldError = "Please confirm the review notice before submitting.";
      renderFlow();
      return;
    }
    state.submitting = true;
    state.error = "";
    state.fieldError = "";
    renderFlow();
    try {
      const response = await endpoints.appealsSubmit({
        verify_token: state.verifyToken,
        reason,
        evidence: state.evidence.trim(),
        attachment_ids: state.attachments.map((attachment) => attachment.id),
      });
      state.result = response || {};
      state.step = "done";
      const token = parseThreadToken(response?.thread_url);
      if (token) saveLastToken(token);
      notifySafe("Appeal submitted");
    } catch (error) {
      if (error?.status === 409) state.error = error.message || "You already have an appeal under review.";
      else if (error?.status === 401) verificationExpired();
      else state.error = error?.message || "Couldn't submit the appeal.";
    } finally {
      state.submitting = false;
      renderFlow();
    }
  }

  function notifySafe(message) {
    try {
      ctx.toast?.success?.(message);
    } catch {
      /* ignore */
    }
  }

  /* -------------------------------- thread -------------------------------- */

  async function renderThread() {
    const token = routeToken;
    if (!token) {
      renderFlow();
      return;
    }
    clear(shell);
    shell.append(brand());
    const body = h("div", { class: "stack" });
    shell.append(body);
    body.append(spinner({ size: 20, label: "Loading the thread" }));

    let thread = null;
    let error = null;
    try {
      thread = await endpoints.appealsThread(token);
      saveLastToken(token);
    } catch (err) {
      error = err;
    }
    if (disposed) return;
    clear(body);

    if (error) {
      body.append(
        stepHeader("Thread unavailable", "This appeal thread doesn't exist, or the link has been revoked."),
        callout({ tone: "danger", children: error?.status === 404 ? "We couldn't find an appeal with that link. If you have another link from your DMs, try that one." : error?.message || "The appeal service didn't respond." }),
        button({ label: signedIn ? "Back to my appeals" : "Start a new appeal", variant: "primary", full: true, onClick: () => router.navigate("/appeals") }),
        button({ label: "Open Discord", variant: "ghost", full: true, onClick: () => window.open("https://discord.com/app", "_blank", "noreferrer") })
      );
      return;
    }

    const resolved = ["approved", "denied"].includes(thread.status);
    const header = h(
      "div",
      { class: "auth-hero" },
      h("div", { class: "row", style: "gap:6px;flex-wrap:wrap;margin-bottom:6px" }, badge({ label: statusLabel(thread.status), tone: statusTone(thread.status), dot: true }), badge({ label: `Appeal #${thread.id}`, tone: "neutral" })),
      h("h1", null, resolved ? (thread.status === "approved" ? "Your appeal was approved" : "Your appeal was denied") : "Your Rift appeal"),
      h("p", { class: "auth-sub" }, resolved ? "This thread is now read-only. You can still read everything below." : "Reply here with anything else staff should know. New messages and images appear for staff immediately.")
    );

    const messageList = h("div", { class: "stack-tight" });
    renderMessages(messageList, thread, token);

    body.append(
      header,
      h(
        "div",
        { class: "card", style: "padding:14px" },
        h("div", { class: "muted", style: "font-size:11px;text-transform:uppercase;letter-spacing:.06em" }, "Original appeal"),
        h("p", { style: "margin:6px 0 0;white-space:pre-wrap;line-height:1.6;font-size:13px" }, thread.reason || "—"),
        thread.evidence ? h("p", { class: "muted", style: "white-space:pre-wrap;line-height:1.5;font-size:12px;margin-top:8px" }, thread.evidence) : null,
        h("div", { class: "muted", style: "font-size:11px;margin-top:8px" }, thread.created_at ? `Submitted ${relativeOrDate(thread.created_at)}` : ""),
        (thread.evidence_attachment_ids || []).length
          ? h("div", { class: "art-grid", style: "margin-top:10px" }, ...thread.evidence_attachment_ids.map((id) => h("a", { href: endpoints.appealsAttachmentUrl(id, token), target: "_blank", rel: "noreferrer", class: "art-tile" }, h("img", { src: endpoints.appealsAttachmentUrl(id, token), alt: "Evidence", loading: "lazy", style: "width:100%;height:100%;object-fit:cover" }))))
          : null
      ),
      h("div", { class: "card", style: "padding:14px" }, h("div", { class: "section-label" }, "Conversation"), messageList),
      resolved
        ? callout({ tone: thread.status === "approved" ? "success" : "danger", title: thread.status === "approved" ? "Resolved — approved" : "Resolved — denied", children: thread.resolved_at ? `Decision made ${relativeOrDate(thread.resolved_at)}.` : "Staff have closed this appeal." })
        : composer(thread, token, messageList),
      h("div", { class: "auth-links", style: "justify-content:center" }, h("a", { href: "#", onClick: (event) => { event.preventDefault(); router.navigate("/appeals"); } }, signedIn ? "Back to my appeals" : "Submit a new appeal"))
    );

    /* Light polling so staff replies appear without a reload. */
    let poll = null;
    if (!resolved) {
      poll = setInterval(async () => {
        if (disposed || document.visibilityState === "hidden") return;
        try {
          const fresh = await endpoints.appealsThread(token);
          if (disposed) return;
          if (fresh?.status !== thread.status) {
            renderThread();
            return;
          }
          if ((fresh?.messages?.length || 0) !== (thread.messages?.length || 0)) {
            thread = fresh;
            renderMessages(messageList, thread, token);
          }
        } catch {
          /* keep the last good view; a manual reload is available */
        }
      }, 10_000);
      cleanupFns.push(() => clearInterval(poll));
    }
  }

  function renderMessages(host, thread, token) {
    clear(host);
    const messages = Array.isArray(thread.messages) ? thread.messages : [];
    if (!messages.length) {
      host.append(h("p", { class: "muted", style: "font-size:12px" }, "No replies yet. Staff will respond here (and by DM) when they pick up the appeal."));
      return;
    }
    for (const message of messages) {
      const mine = !message.is_staff;
      // The bot stamps messages with `ts` (unix seconds).
      const when = message.ts ?? message.created_at;
      host.append(
        h(
          "div",
          { style: "display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--line)" },
          h("div", { style: `width:26px;height:26px;border-radius:50%;display:grid;place-items:center;flex-shrink:0;background:${mine ? "var(--accent-soft)" : "var(--violet-soft, rgba(167,139,250,.16))"};color:${mine ? "var(--accent)" : "var(--violet)"};font-size:11px;font-weight:700` }, mine ? "You" : "S"),
          h(
            "div",
            { style: "flex:1;min-width:0" },
            h("div", { class: "row", style: "gap:6px;flex-wrap:wrap" }, h("strong", { style: "font-size:12px" }, mine ? "You" : "Staff"), message.is_staff ? badge({ label: "Staff", tone: "violet" }) : null, when ? h("span", { class: "muted", style: "font-size:10.5px" }, relativeOrDate(when)) : null),
            message.text ? h("p", { style: "margin:4px 0 0;white-space:pre-wrap;line-height:1.55;font-size:12.5px" }, message.text) : null,
            (message.attachment_ids || []).length
              ? h("div", { class: "art-grid", style: "margin-top:6px" }, ...message.attachment_ids.map((id) => h("a", { href: endpoints.appealsAttachmentUrl(id, token), target: "_blank", rel: "noreferrer", class: "art-tile" }, h("img", { src: endpoints.appealsAttachmentUrl(id, token), alt: "Attachment", loading: "lazy", style: "width:100%;height:100%;object-fit:cover" }))))
              : null
          )
        )
      );
    }
    host.append(h("div", { class: "muted", style: "font-size:10.5px;text-align:center;padding-top:6px" }, `${plural(messages.length, "message")} · refreshes automatically`));
  }

  function composer(thread, token, messageList) {
    let attachment = null;
    let sending = false;
    let uploadBusy = false;

    const textarea = h("textarea", { class: "input", rows: "3", maxlength: "4000", placeholder: "Write a reply to staff… (paste a screenshot with Ctrl/Cmd+V)", "aria-label": "Reply to staff" });
    const preview = h("div", { class: "art-grid", style: "grid-template-columns:repeat(auto-fill,minmax(72px,1fr))" });
    const errorHost = h("div");
    const sendBtn = button({ label: "Send reply", icon: "send", variant: "primary", onClick: () => send() });

    async function addImage(file) {
      if (!file) return;
      uploadBusy = true;
      errorHost.replaceChildren();
      try {
        const prepared = await prepareImage(file);
        const response = await endpoints.appealsThreadUpload(token, prepared.dataUrl);
        if (!response?.id) throw new Error("Upload failed");
        attachment = { id: response.id, dataUrl: prepared.dataUrl, name: prepared.name };
        renderPreview();
      } catch (err) {
        errorHost.replaceChildren(callout({ tone: "danger", children: err?.message || "Couldn't upload that image." }));
      } finally {
        uploadBusy = false;
      }
    }

    const fileInput = h("input", {
      type: "file",
      accept: ALLOWED_TYPES.join(","),
      class: "sr-only",
      id: "appeal-reply-image",
      onchange: (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        addImage(file);
      },
    });

    function renderPreview() {
      clear(preview);
      if (!attachment) return;
      preview.append(
        h("div", { class: "art-tile" }, h("img", { src: attachment.dataUrl, alt: "", style: "width:100%;height:100%;object-fit:cover" }), h("button", { type: "button", class: "btn btn--icon btn--ghost btn--sm", style: "position:absolute;top:3px;right:3px;background:rgba(0,0,0,.6)", "aria-label": "Remove attachment", onClick: () => { attachment = null; renderPreview(); } }, icon("x", { size: 13 })))
      );
    }

    async function send() {
      if (sending) return;
      const value = textarea.value.trim();
      if (!value && !attachment) {
        errorHost.replaceChildren(callout({ tone: "warning", children: "Write a message or add an image first." }));
        return;
      }
      if (uploadBusy) {
        errorHost.replaceChildren(callout({ tone: "warning", children: "Wait for the image to finish uploading." }));
        return;
      }
      sending = true;
      sendBtn.disabled = true;
      errorHost.replaceChildren();
      try {
        await endpoints.appealsThreadMessage(token, value, attachment ? [attachment.id] : []);
        textarea.value = "";
        attachment = null;
        renderPreview();
        const fresh = await endpoints.appealsThread(token);
        renderMessages(messageList, fresh, token);
      } catch (err) {
        errorHost.replaceChildren(callout({ tone: "danger", title: "Couldn't send", children: err?.message || "The appeal service didn't accept that reply." }));
      } finally {
        sending = false;
        sendBtn.disabled = false;
      }
    }

    on(textarea, "keydown", (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        send();
      }
    });
    on(textarea, "paste", (event) => {
      const file = imageFromClipboard(event);
      if (!file) return;
      event.preventDefault();
      addImage(file);
    });

    return h(
      "div",
      { class: "card", style: "padding:14px" },
      h(
        "div",
        { class: "stack-tight" },
        textarea,
        preview,
        fileInput,
        h(
          "div",
          { class: "row", style: "gap:6px;flex-wrap:wrap;align-items:center" },
          h("label", { class: "btn btn--ghost btn--sm", for: "appeal-reply-image" }, icon("image", { size: 13 }), h("span", { class: "btn-label" }, "Attach image")),
          h("span", { class: "muted", style: "font-size:10.5px" }, "⌘/Ctrl + Enter sends"),
          h("span", { style: "flex:1" }),
          sendBtn
        ),
        errorHost
      )
    );
  }

  /* -------------------------------- boot -------------------------------- */

  if (routeToken) {
    await renderThread();
  } else {
    renderFlow();
    if (signedIn) {
      await loadAccount();
      // Keep the countdown honest, and (on the blocked screen) notice the
      // moment a timed blacklist ends or staff lift it.
      const timer = setInterval(() => {
        if (disposed || state.step !== "account" || document.visibilityState === "hidden") return;
        const bl = state.account?.blacklist;
        const ended = bl?.blacklisted && bl.expires_at && toEpochMs(bl.expires_at) <= Date.now();
        if (blockedMode || ended) {
          loadAccount({ silent: true });
          return;
        }
        for (const node of shell.querySelectorAll(".js-countdown")) node.textContent = expiryText(bl);
      }, 30_000);
      cleanupFns.push(() => clearInterval(timer));
    } else if (state.lastToken) {
      endpoints.appealsThread(state.lastToken).catch(() => {
        if (!disposed) saveLastToken("");
      });
    }
  }

  return () => {
    disposed = true;
    for (const fn of cleanupFns) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  };
}
