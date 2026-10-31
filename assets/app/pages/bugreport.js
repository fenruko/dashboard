/* Public bug-report form.
 *
 * Matches /api/bugreports/* in web_server.py: images are uploaded first against
 * a one-off upload_key, then the report is submitted with their ids. No Discord
 * login is required, but signed-in visitors get their user id prefilled.
 * The bot rate-limits to three reports per fingerprint/IP per day.
 */

import { h, mount, clear, on } from "../ui/dom.js";
import { icon } from "../ui/icons.js";
import { badge, button, callout, field, spinner, textInput } from "../ui/components.js";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_DESCRIPTION = 4000;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

function randomKey() {
  try {
    if (globalThis.crypto?.randomUUID) return `bug-${crypto.randomUUID()}`;
  } catch {
    /* insecure context */
  }
  return `bug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.readAsDataURL(file);
  });
}

/* A stable, privacy-friendly identifier used only for the bot's daily rate
 * limit. It deliberately hashes coarse browser traits rather than anything
 * that identifies the person. */
function browserFingerprint() {
  try {
    const stored = localStorage.getItem("rift_bug_fingerprint");
    if (stored) return stored;
    const seed = [navigator.userAgent, navigator.language, screen.width, screen.height, new Date().getTimezoneOffset()].join("|");
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) {
      hash ^= seed.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    const value = `dash-${(hash >>> 0).toString(16)}`;
    localStorage.setItem("rift_bug_fingerprint", value);
    return value;
  } catch {
    return "dash-unknown";
  }
}

export async function mountPage(ctx) {
  const { root, endpoints, router, user } = ctx;
  const shell = h("main", { class: "auth-shell auth-shell--wide", role: "main" });
  mount(root, shell);

  const uploadKey = randomKey();
  const state = {
    userId: user?.id ? String(user.id) : "",
    description: "",
    images: [],
    uploading: 0,
    submitting: false,
    error: "",
    result: null,
  };
  let disposed = false;

  const header = h(
    "div",
    { class: "auth-brand" },
    h("div", { class: "auth-brand-mark" }, icon("bug", { size: 26 })),
    h(
      "div",
      null,
      h("div", { class: "auth-brand-name" }, "Report a bug"),
      h("div", { class: "auth-brand-sub" }, "Sent straight to the Rift staff inbox")
    )
  );

  async function handleFiles(fileList) {
    const files = [...(fileList || [])].slice(0, MAX_IMAGES - state.images.length);
    if (!files.length) return;
    state.error = "";
    state.uploading = files.length;
    render();
    try {
      for (const file of files) {
        if (!ALLOWED_TYPES.includes(file.type)) throw new Error("Only PNG, JPEG, GIF or WEBP images are allowed.");
        if (file.size > MAX_IMAGE_BYTES) throw new Error("Each screenshot must be 3 MB or smaller.");
        const dataUrl = await readFileAsDataUrl(file);
        const response = await endpoints.bugReportUpload(uploadKey, dataUrl);
        if (!response?.id) throw new Error("The upload didn't return an attachment id.");
        if (disposed) return;
        state.images.push({ id: response.id, dataUrl, name: file.name || "screenshot" });
        state.uploading = Math.max(0, state.uploading - 1);
        render();
      }
    } catch (error) {
      state.error = error?.message || "Couldn't upload that screenshot.";
      if (error?.status === 429) state.error = "Too many uploads from this browser. Try again in an hour.";
    } finally {
      state.uploading = 0;
      if (!disposed) render();
    }
  }

  async function submit() {
    if (state.submitting) return;
    state.error = "";
    const userId = state.userId.trim();
    const description = state.description.trim();
    if (!/^\d+$/.test(userId)) {
      state.error = "Enter your Discord user ID (numbers only).";
      render();
      return;
    }
    if (description.length < 10) {
      state.error = "Please describe the bug in at least 10 characters — what happened, and what you expected.";
      render();
      return;
    }
    state.submitting = true;
    render();
    try {
      const result = await endpoints.bugReportSubmit({
        user_id: userId,
        description,
        upload_key: uploadKey,
        attachment_ids: state.images.map((image) => image.id),
        fingerprint: browserFingerprint(),
      });
      if (disposed) return;
      state.result = result;
      state.submitting = false;
      render();
    } catch (error) {
      if (disposed) return;
      state.submitting = false;
      state.error =
        error?.status === 429
          ? "You've reached the daily limit of three reports. Please try again tomorrow."
          : error?.message || "Couldn't send the report. Try again in a moment.";
      render();
    }
  }

  function imageGrid() {
    return h(
      "div",
      { class: "art-grid", style: "margin-top:10px" },
      ...state.images.map((image) =>
        h(
          "div",
          { class: "art-tile", style: "position:relative" },
          h("img", { src: image.dataUrl, alt: image.name, style: "width:100%;height:100%;object-fit:cover" }),
          h(
            "button",
            {
              type: "button",
              class: "btn btn--icon btn--ghost btn--sm",
              style: "position:absolute;top:3px;right:3px;background:rgba(0,0,0,.6)",
              "aria-label": `Remove ${image.name}`,
              onClick: () => {
                state.images = state.images.filter((entry) => entry !== image);
                render();
              },
            },
            icon("x", { size: 13 })
          )
        )
      )
    );
  }

  function renderForm() {
    const userInput = textInput({
      value: state.userId,
      placeholder: "e.g. 1329184069426348052",
      inputMode: "numeric",
      autocomplete: "off",
      onInput: (event) => {
        state.userId = event.target.value;
      },
    });
    const description = h("textarea", {
      class: "input",
      rows: 7,
      maxlength: String(MAX_DESCRIPTION),
      placeholder: "What went wrong? Include the page, the command or the server, and what you expected to happen.",
      value: state.description,
      onInput: (event) => {
        state.description = event.target.value;
        counter.textContent = `${state.description.length} / ${MAX_DESCRIPTION}`;
      },
    });
    const counter = h("span", { class: "field-help" }, `${state.description.length} / ${MAX_DESCRIPTION}`);
    const fileInput = h("input", {
      type: "file",
      accept: ALLOWED_TYPES.join(","),
      multiple: true,
      hidden: true,
      onChange: (event) => {
        handleFiles(event.target.files);
        event.target.value = "";
      },
    });

    shell.append(
      h(
        "div",
        { class: "stack" },
        header,
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "card-body stack" },
            callout({
              tone: "info",
              title: "Before you send",
              children:
                "Screenshots help enormously. Reports are read by a human; you'll only get a DM if staff need more detail. For ban appeals or verification problems, use the dedicated pages instead.",
            }),
            field({
              label: "Your Discord user ID",
              help: user?.id ? "Prefilled from your signed-in account — change it if you're reporting for someone else." : "Right-click your name in Discord → Copy User ID (enable Developer Mode in Discord settings).",
              required: true,
              children: userInput,
            }),
            field({
              label: "What happened?",
              help: "Minimum 10 characters. Mention the exact error text if you can see it.",
              required: true,
              children: h("div", { class: "stack-tight" }, description, counter),
            }),
            h(
              "div",
              { class: "field" },
              h("div", { class: "field-label" }, "Screenshots ", h("span", { class: "field-optional" }, "(optional, up to 5)")),
              fileInput,
              h(
                "div",
                { class: "auth-actions", style: "flex-direction:row;flex-wrap:wrap" },
                button({
                  label: state.images.length >= MAX_IMAGES ? "Image limit reached" : "Attach screenshots",
                  icon: "image",
                  variant: "outline",
                  disabled: state.images.length >= MAX_IMAGES || state.uploading > 0,
                  onClick: () => fileInput.click(),
                }),
                state.uploading ? h("span", { class: "inline-actions" }, spinner({ size: 14 }), ` Uploading ${state.uploading}…`) : null
              ),
              imageGrid(),
              h("div", { class: "field-help" }, "PNG, JPEG, GIF or WEBP · 3 MB each · 5 images")
            ),
            state.error
              ? callout({ tone: "danger", title: "Couldn't send that", children: state.error })
              : null,
            h(
              "div",
              { class: "auth-actions" },
              button({
                label: state.submitting ? "Sending…" : "Send bug report",
                icon: "send",
                variant: "primary",
                full: true,
                disabled: state.submitting || state.uploading > 0,
                onClick: submit,
              }),
              button({
                label: "Back to dashboard",
                variant: "ghost",
                full: true,
                onClick: () => router.navigate(user ? "/guilds" : "/login"),
              })
            )
          )
        ),
        h("div", { class: "auth-scopes" }, "Reports are rate-limited to three per day per browser. Never include passwords, tokens or private messages.")
      )
    );
  }

  function renderDone() {
    shell.append(
      h(
        "div",
        { class: "stack" },
        header,
        h(
          "div",
          { class: "card" },
          h(
            "div",
            { class: "card-body stack" },
            h(
              "div",
              { style: "display:flex;align-items:center;gap:10px" },
              h("div", { class: "auth-brand-mark" }, icon("check", { size: 24 })),
              h("h1", { class: "page-title", style: "margin:0" }, "Report sent"),
              badge({ label: `#${state.result?.id ?? "—"}`, tone: "success" })
            ),
            h("p", { class: "muted" }, "Thank you — the report is in the staff inbox with your screenshots attached. You can keep using the dashboard while it's reviewed."),
            callout({
              tone: "info",
              title: "What happens next",
              children: "Staff triage reports in Discord. If they need more information they'll DM you. You can send another report if you find something new.",
            }),
            h(
              "div",
              { class: "auth-actions" },
              button({ label: "Report something else", icon: "plus", variant: "outline", full: true, onClick: () => reset() }),
              button({ label: "Back to dashboard", variant: "primary", full: true, onClick: () => router.navigate(user ? "/guilds" : "/login") })
            )
          )
        )
      )
    );
  }

  function reset() {
    state.userId = user?.id ? String(user.id) : "";
    state.description = "";
    state.images = [];
    state.error = "";
    state.result = null;
    state.submitting = false;
    // Images uploaded under the old key stay orphaned; the bot cleans those up.
    render();
  }

  function render() {
    clear(shell);
    if (state.result) renderDone();
    else renderForm();
  }

  on(window, "beforeunload", () => {
    disposed = true;
  });
  render();
  ctx.setTitle?.("Report a bug");

  return () => {
    disposed = true;
    clear(shell);
  };
}
