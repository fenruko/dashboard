/* Public verification hand-off. The bot DMs a single-use link with ?token=…
 * and this page fingerprints the browser, submits it, and shows the result.
 * No Discord login is required (and none would work here). */

import { h, mount, clear } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { badge, button, callout, spinner, textInput } from "../ui/components.js";
import { copyToClipboard, fmtDuration } from "../core/format.js";

/* ---------------------------------------------------------------- sha-256 */

async function sha256Hex(text) {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return fallbackSha256(text);
}

/* Minimal SHA-256 for insecure contexts (or browsers without WebCrypto).
 * Public-domain style implementation, kept local so the public page has no
 * dependency on the app's authenticated modules. */
function fallbackSha256(input) {
  const ascii = String(input).replace(/[^\x00-\x7F]/g, "?");
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";
  const words = [];
  const asciiBitLength = ascii.length * 8;
  let hash = (fallbackSha256.h = fallbackSha256.h || []);
  const k = (fallbackSha256.k = fallbackSha256.k || []);
  let primeCounter = k.length;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      primeCounter += 1;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i += 1) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) throw new Error("SHA-256 fallback only supports ASCII fingerprints");
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; j += 16) {
    const w = words.slice(j, j + 16);
    const oldHash = hash;
    hash = hash.slice(0, 8);
    for (let i = 0; i < 64; i += 1) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        ((e >>> 6) | (e << 26)) +
        ((e >>> 11) | (e << 21)) +
        ((e >>> 25) | (e << 7)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3)) +
                w[i - 7] +
                (((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        ((a >>> 2) | (a << 30)) +
        ((a >>> 13) | (a << 19)) +
        ((a >>> 22) | (a << 10)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i += 1) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i += 1) {
    for (let j = 3; j + 1; j -= 1) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? "0" : "") + b.toString(16);
    }
  }
  return result;
}

/* ------------------------------------------------------------- fingerprint */

function deviceMetadata() {
  const metadata = {
    source: "rift-dashboard",
    language: String(navigator.language || "").slice(0, 32),
    platform: String(navigator.userAgentData?.platform || navigator.platform || "").slice(0, 48),
    screen: `${screen.width}x${screen.height}`,
    timezone_offset: new Date().getTimezoneOffset(),
  };
  return metadata;
}

async function computeFingerprint(metadata) {
  const entropy = [
    navigator.userAgent,
    navigator.language,
    ...(navigator.languages || []),
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    metadata.platform,
    navigator.hardwareConcurrency || 0,
    navigator.maxTouchPoints || 0,
    Boolean(navigator.cookieEnabled),
  ].join("|");
  return sha256Hex(entropy);
}

/* ---------------------------------------------------------------- helpers */

function maskToken(token) {
  if (!token) return "";
  if (token.length <= 10) return `${token.slice(0, 2)}…`;
  return `${token.slice(0, 6)}…${token.slice(-4)}`;
}

export async function mountPage(ctx) {
  const { root, config, endpoints, router, ctx: routeCtx } = ctx;
  const query = new URLSearchParams(location.search);
  let token = String(query.get("token") || query.get("t") || "").trim();

  let disposed = false;
  let stage = token ? "verifying" : "missing";
  let message = "";
  let flagged = false;
  let fingerprint = "";
  let attempts = 0;
  let startedAt = Date.now();
  let customToken = "";

  const page = h("div", { class: "auth-page" });
  const shell = h("main", { class: "auth-shell", role: "main" });
  mount(page, shell);
  mount(root, page);
  ctx.setTitle?.("Verification");

  function logo() {
    return h(
      "div",
      { class: "auth-brand" },
      h("img", { src: "/assets/riftlogo.jpg", alt: "", width: 30, height: 30, style: "border-radius:8px", onerror: (event) => { event.target.style.display = "none"; } }),
      h("div", null, h("strong", null, config?.siteName || "Rift"), h("div", { class: "muted", style: "font-size:10.5px;letter-spacing:.08em;text-transform:uppercase" }, "Security check"))
    );
  }

  function render() {
    if (disposed) return;
    clear(shell);
    shell.append(logo());
    shell.append(
      h(
        "div",
        { class: "auth-hero" },
        h("h1", null, stage === "done" ? "You're verified" : stage === "flagged" ? "Security check flagged" : stage === "error" ? "Verification failed" : "Security check"),
        h(
          "p",
          { class: "auth-sub" },
          stage === "verifying"
            ? "Checking your browser and validating the one-time link. This takes a couple of seconds."
            : stage === "done"
              ? message || "You're verified — you can close this tab and return to Discord."
              : stage === "flagged"
                ? message || "This verification was blocked by the server's fingerprint protection."
                : stage === "error"
                  ? message || "The link couldn't be used."
                  : "Paste the token from your verification DM to continue."
        )
      )
    );

    if (stage === "verifying") {
      shell.append(
        h(
          "div",
          { class: "stack-tight", style: "padding:14px;border:1px solid var(--line);border-radius:var(--radius);background:var(--bg-elev-2)" },
          h("div", { class: "row", style: "gap:8px;align-items:center" }, spinner({ size: 16 }), h("span", { style: "font-size:12.5px" }, attempts > 1 ? "Retrying the secure check…" : "Fingerprinting this browser…")),
          fingerprint ? h("div", { class: "muted", style: "font-size:10.5px;word-break:break-all" }, `SHA-256 ${maskToken(fingerprint)}`) : null,
          h("div", { class: "muted", style: "font-size:10.5px" }, `Elapsed ${fmtDuration(Math.max(1, Math.round((Date.now() - startedAt) / 1000)))}`)
        )
      );
    }

    if (stage === "done") {
      shell.append(
        h(
          "div",
          { class: "stack" },
          h(
            "div",
            { class: "status-hero", style: "display:grid;place-items:center;padding:10px" },
            h("div", { style: "width:56px;height:56px;border-radius:50%;background:var(--success-soft);color:var(--success);display:grid;place-items:center" }, icon("check", { size: 28 }))
          ),
          callout({ tone: "success", title: "Verified", children: "Your account has been given the verified role. If you removed roles that were replaced, they're handled automatically." }),
          h("div", { class: "auth-scopes" }, "You can close this tab. The bot may also send a confirmation DM."),
          h(
            "div",
            { class: "auth-actions" },
            button({ label: "Open Discord", icon: "external-link", variant: "primary", full: true, onClick: () => window.open("https://discord.com/app", "_blank", "noreferrer") }),
            fingerprint ? button({ label: "Copy verification ID", variant: "ghost", full: true, icon: "copy", onClick: async () => { await copyToClipboard(fingerprint); } }) : null
          )
        )
      );
    }

    if (stage === "flagged") {
      shell.append(
        h(
          "div",
          { class: "stack" },
          callout({
            tone: "danger",
            title: "Fingerprint match",
            children: "This browser was previously used by an account that is banned in this server. If you believe this is a mistake, open a ban appeal and a human will review it.",
          }),
          h(
            "div",
            { class: "auth-actions" },
            button({ label: "Open ban appeal", icon: "message-square", variant: "primary", full: true, onClick: () => router.navigate("/appeals") }),
            button({ label: "Return to Discord", variant: "ghost", full: true, icon: "external-link", onClick: () => window.open("https://discord.com/app", "_blank", "noreferrer") })
          ),
          h("div", { class: "auth-scopes" }, "The server only sees a one-way hash — no browsing history, device IDs or personal files are collected.")
        )
      );
    }

    if (stage === "error") {
      shell.append(
        h(
          "div",
          { class: "stack" },
          callout({ tone: "danger", title: "Couldn't complete the check", children: message || "The token may have expired or already been used." }),
          attempts > 0 && token
            ? button({ label: "Try again", icon: "refresh", variant: "outline", full: true, onClick: () => runVerification(token) })
            : null,
          h(
            "div",
            { class: "auth-actions" },
            button({ label: "Use a different token", variant: "ghost", full: true, icon: "key", onClick: () => { stage = "missing"; render(); } }),
            button({ label: "Ban appeal", variant: "ghost", full: true, icon: "message-square", onClick: () => router.navigate("/appeals") })
          ),
          h("div", { class: "auth-scopes" }, "Verification links are single-use and expire quickly. Request a new one from the server's verify panel.")
        )
      );
    }

    if (stage === "missing") {
      const input = textInput({
        value: customToken,
        placeholder: "Paste your verification token",
        ariaLabel: "Verification token",
        className: "mono",
        onInput: (value) => {
          customToken = value.trim();
        },
      });
      const submit = () => {
        if (customToken.length < 16) {
          message = "That token looks too short. Copy the full token from the DM.";
          stage = "error";
          render();
          return;
        }
        token = customToken;
        runVerification(token);
      };
      shell.append(
        h(
          "div",
          { class: "stack" },
          h("label", { class: "field" }, h("span", { class: "field-label" }, "Verification token"), input),
          button({ label: "Verify my account", icon: "shield-check", variant: "primary", full: true, onClick: submit }),
          h("div", { class: "auth-scopes" }, "The token is sent directly to the bot's API. It is never stored in this browser."),
          h("div", { class: "auth-links" }, h("a", { href: "#", onClick: (event) => { event.preventDefault(); router.navigate("/appeals"); } }, "Banned? Open a ban appeal"))
        )
      );
      requestAnimationFrame(() => input.focus());
    }

    if (stage === "verifying" || (stage === "done" && token)) {
      shell.append(h("div", { class: "auth-scopes" }, token ? `Link ${maskToken(token)}` : ""));
    }
  }

  async function runVerification(value) {
    if (disposed) return;
    stage = "verifying";
    message = "";
    attempts += 1;
    startedAt = Date.now();
    render();
    try {
      const metadata = deviceMetadata();
      fingerprint = await computeFingerprint(metadata);
      render();
      const payload = await endpoints.verify({ token: value, fingerprint, metadata });
      if (disposed) return;
      if (payload?.flagged || payload?.error) {
        stage = "flagged";
        message = payload?.error || "";
        render();
        return;
      }
      stage = "done";
      render();
    } catch (error) {
      if (disposed) return;
      const flaggedError = /fingerprint|mismatch|secure system/i.test(error?.message || "");
      stage = flaggedError || error?.payload?.flagged ? "flagged" : "error";
      message = error?.message || "The verification service didn't respond. Try again.";
      render();
    }
  }

  if (token) {
    if (token.length < 16) {
      stage = "error";
      message = "That verification token is invalid. Use the link from the DM exactly as sent.";
      render();
    } else {
      runVerification(token);
    }
  } else {
    render();
  }

  return () => {
    disposed = true;
  };
}
