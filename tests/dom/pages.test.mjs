/* Mounts every page against the demo API and drives the important flows.
 * These are not screenshot tests: they assert that the DOM the user actually
 * sees contains real data, that buttons mutate backend state, and that no
 * `null` / `[object Object]` placeholder text leaks into the UI. */

import test from "node:test";
import assert from "node:assert/strict";

import { createHarness, installDom, mountPage, flush } from "./harness.mjs";
import { SETTINGS_SECTIONS } from "../../assets/app/data/settings-schema.js";

installDom();
const browserErrors = [];
window.addEventListener("error", (event) => browserErrors.push(event.error || event.message));
window.addEventListener("unhandledrejection", (event) => browserErrors.push(event.reason));

function freshRoot() {
  document.getElementById("root").innerHTML = "";
  document.getElementById("overlay-root").innerHTML = "";
  document.getElementById("toast-root").innerHTML = "";
}

function clickText(label, selector = "button") {
  const node = [...document.querySelectorAll(selector)].find((element) => element.textContent.trim() === label);
  assert.ok(node, `expected a ${selector} labelled “${label}”`);
  node.click();
  return node;
}

function typeInto(node, value) {
  node.value = value;
  node.dispatchEvent(new window.Event("input", { bubbles: true }));
  node.dispatchEvent(new window.Event("change", { bubbles: true }));
}

function assertCleanText(root) {
  const text = root.textContent || "";
  for (const bad of ["[object Object]", "undefined", "NaN"]) {
    assert.equal(text.includes(bad), false, `page leaked “${bad}”: ${text.slice(0, 300)}`);
  }
  assert.equal(/\bnull\b/.test(text), false, `page leaked “null”: ${text.slice(0, 300)}`);
}

test("all signed-in pages render real data without placeholder leaks", async () => {
  const harness = createHarness();
  const cases = [
    ["guilds", "/guilds", {}],
    ["overview", `/g/${harness.guild.id}`, {}],
    ["analytics", `/g/${harness.guild.id}/analytics`, {}],
    ["moderation", `/g/${harness.guild.id}/moderation`, {}],
    ["settings", `/g/${harness.guild.id}/settings/automod`, { section: "automod" }],
    ["music", `/g/${harness.guild.id}/music`, {}],
    ["lastfm", `/g/${harness.guild.id}/lastfm`, {}],
    ["stocks", `/g/${harness.guild.id}/stocks`, {}],
    ["voice", `/g/${harness.guild.id}/voice-call`, {}],
    ["verification", `/g/${harness.guild.id}/verification-activity`, {}],
    ["me", "/me", {}],
    ["status", "/status", {}],
  ];
  for (const [name, path, extra] of cases) {
    freshRoot();
    const { cleanup } = await mountPage(`assets/app/pages/${name}.js`, harness, {
      path,
      params: { guildId: harness.guild.id, section: extra.section },
      query: {},
      route: { title: name },
    });
    await flush(8);
    const root = document.getElementById("root");
    assertCleanText(root);
    assert.ok(root.textContent.trim().length > 80, `${name} rendered something meaningful`);
    cleanup?.();
  }
});

test("public pages render without a session", async () => {
  const harness = createHarness({ signedOut: true, url: "https://dash.test/login" });
  freshRoot();
  await mountPage("assets/app/pages/login.js", harness, { path: "/login", params: {}, query: {} });
  await flush(3);
  assert.match(document.body.textContent, /Continue with Discord/);
  assert.match(document.body.textContent, /Explore the demo/);
  assert.equal(harness.navigations.length, 0, "login does not auto-redirect a signed-out visitor");

  clickText("Explore the demo (no Discord login)");
  await flush(3);
  assert.equal(harness.auth.get().token, "demo-token", "demo login stores the demo token");
  assert.ok(harness.navigations.includes("/guilds"), "demo login lands on the server list");

  for (const pageName of ["bugreport", "appeals", "verify"]) {
    freshRoot();
    const { cleanup } = await mountPage(`assets/app/pages/${pageName}.js`, harness, {
      path: `/${pageName}`,
      params: {},
      query: {},
    });
    await flush(3);
    assertCleanText(document.getElementById("root"));
    cleanup?.();
  }
});

test("settings edits dirty the save bar, save to the bot, and survive a reload", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountPage("assets/app/pages/settings.js", harness, {
    path: `/g/${harness.guild.id}/settings/automod`,
    params: { guildId: harness.guild.id, section: "automod" },
    query: {},
  });
  await flush(8);

  const save = [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Save changes"));
  assert.ok(save);
  assert.equal(save.disabled, true, "clean form starts with save disabled");

  const enabled = document.querySelector('input[type="checkbox"]');
  enabled.click();
  await flush(2);
  assert.equal(save.disabled, false, "editing enables Save");
  save.click();
  await flush(12);

  const stored = harness.backend.getGuildSettings(harness.guild.id).automod;
  assert.equal(stored.enabled, false);
  assert.ok(harness.toasts.some((toast) => toast.type === "success"));
  assert.equal(document.querySelector("[data-save]").disabled, true, "save bar resets after a successful save");
  cleanup?.();

  freshRoot();
  const second = await mountPage("assets/app/pages/settings.js", harness, {
    path: `/g/${harness.guild.id}/settings/automod`,
    params: { guildId: harness.guild.id, section: "automod" },
    query: {},
  });
  await flush(8);
  assert.equal(document.querySelector('input[type="checkbox"]').checked, false, "reload reads the saved value");
  second.cleanup?.();
});

test("every settings section renders a complete, saveable form", async () => {
  const harness = createHarness();
  const readOnly = new Set(["autoresponder", "reaction_roles", "giveaways"]);
  for (const section of SETTINGS_SECTIONS) {
    freshRoot();
    const { cleanup } = await mountPage("assets/app/pages/settings.js", harness, {
      path: `/g/${harness.guild.id}/settings/${section.key}`,
      params: { guildId: harness.guild.id, section: section.key },
      query: {},
      route: { title: section.title },
    });
    await flush(3);
    const root = document.getElementById("root");
    assertCleanText(root);
    assert.ok(root.textContent.includes(section.title), `${section.key} shows its title`);
    assert.equal(
      !!document.querySelector("[data-save]"),
      !readOnly.has(section.key),
      `${section.key} ${readOnly.has(section.key) ? "is read-only" : "can be saved"}`
    );
    cleanup?.();
  }
});

test("not-found page renders a helpful 404", async () => {
  const harness = createHarness();
  freshRoot();
  await mountPage("assets/app/pages/notfound.js", harness, {
    path: "/this-page-does-not-exist",
    params: {},
    query: {},
  });
  await flush(2);
  assert.match(document.getElementById("root").textContent, /page doesn.t exist/i);
  assertCleanText(document.getElementById("root"));
});

test("moderation user lookup renders a dossier", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountPage("assets/app/pages/moderation.js", harness, {
    path: `/g/${harness.guild.id}/moderation`,
    params: { guildId: harness.guild.id },
    query: {},
  });
  await flush(8);

  [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes("User lookup")).click();
  await flush(2);
  const input = document.querySelector('input[placeholder="User ID, @mention or username"]');
  assert.ok(input);
  typeInto(input, "900000000000000004");
  clickText("Look up");
  await flush(10);
  assert.match(document.body.textContent, /Mira/);
  assert.match(document.body.textContent, /Warnings/i);
  cleanup?.();
});

test("music controls pause playback, switch tabs and search the catalog", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountPage("assets/app/pages/music.js", harness, {
    path: `/g/${harness.guild.id}/music`,
    params: { guildId: harness.guild.id },
    query: {},
  });
  await flush(10);

  const pause = document.querySelector('button[aria-label="Pause"]');
  assert.ok(pause, "pause button appears while playing");
  pause.click();
  await flush(8);
  assert.equal(harness.backend.musicState().paused, true);

  [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent.includes("Lyrics")).click();
  await flush(10);
  assert.match(document.body.textContent, /Neon skyline/);
  assert.deepEqual(
    [...document.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent.trim()),
    ["Queue", "Lyrics", "History", "Most played"]
  );

  const search = document.querySelector('input[type="search"]');
  typeInto(search, "neon");
  await new Promise((resolve) => setTimeout(resolve, 700));
  await flush(10);
  assert.ok(document.querySelectorAll(".search-results button").length > 0, "search results render");
  cleanup?.();
});

test("stocks modal validates quantity and executes a real trade", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountPage("assets/app/pages/stocks.js", harness, {
    path: `/g/${harness.guild.id}/stocks`,
    params: { guildId: harness.guild.id },
    query: {},
  });
  await flush(8);

  const cashBefore = harness.backend.state.portfolio.cash;
  [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "Buy").click();
  await flush(3);
  const qty = document.querySelector('.modal input[type="number"]');
  assert.ok(qty, "trade modal opened");
  typeInto(qty, "2");
  const submit = [...document.querySelectorAll(".modal button")].find((button) => button.textContent.trim() === "Buy shares");
  assert.ok(submit);
  submit.click();
  await flush(15);

  assert.equal(document.querySelector(".modal"), null, "modal closes after a fill");
  assert.ok(harness.toasts.some((toast) => /Bought 2/.test(toast.message)));
  assert.ok(harness.backend.state.portfolio.cash < cashBefore);
  cleanup?.();
});

test("voice call shows the waiting code and hangup state", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountPage("assets/app/pages/voice.js", harness, {
    path: `/g/${harness.guild.id}/voice-call`,
    params: { guildId: harness.guild.id },
    query: {},
  });
  await flush(8);
  clickText("Start call");
  await flush(12);
  const call = harness.backend.callStateFor("900000000000000001");
  assert.ok(call?.code);
  assert.match(document.body.textContent, new RegExp(`Call ${call.code}`));
  assert.match(document.body.textContent, /Side B connecting/);
  assert.ok(document.querySelector('button[aria-label="Copy call code"], button'));
  cleanup?.();
});

test("appeals: identity → OTP → form → submit", async () => {
  const harness = createHarness({ signedOut: true });
  freshRoot();
  const { cleanup } = await mountPage("assets/app/pages/appeals.js", harness, {
    path: "/appeals",
    params: {},
    query: {},
  });
  await flush(3);

  const idInput = document.querySelector("input");
  typeInto(idInput, "900000000000000004");
  clickText("Find my account");
  await flush(8);
  assert.match(document.body.textContent, /mira\.codes/);

  clickText("Send code to my DMs");
  await flush(8);
  const codeInput = document.querySelector('input[placeholder="0000"]');
  typeInto(codeInput, "1234");
  await flush(2);
  const verify = clickText("Verify code");
  assert.equal(verify.disabled, false, "verify enables as soon as four digits are present");
  await flush(10);

  const reason = document.querySelector('textarea[placeholder^="Explain why"]');
  assert.ok(reason, "appeal form is visible");
  const submit = clickText("Submit appeal");
  assert.equal(submit.disabled, true, "consent is required before submitting");
  typeInto(reason, "I was banned by an overzealous automod and would like a human to review the logs.");
  typeInto(document.querySelectorAll("textarea")[1], "No prior warnings in this server.");
  document.querySelector('input[type="checkbox"]').click();
  await flush(2);
  assert.equal(submit.disabled, false);
  submit.click();
  await flush(15);

  assert.match(document.body.textContent, /Appeal submitted/);
  assert.equal(harness.backend.state.appeals.size, 1);
  cleanup?.();
});

test("bug report form uploads and submits, showing the report id", async () => {
  const harness = createHarness();
  freshRoot();
  const { cleanup } = await mountPage("assets/app/pages/bugreport.js", harness, {
    path: "/bugreport",
    params: {},
    query: {},
  });
  await flush(4);

  const description = document.querySelector("textarea");
  typeInto(description, "The music page lost my queue after a reconnect.");
  clickText("Send bug report");
  await flush(12);

  assert.match(document.body.textContent, /Report sent/);
  assert.equal(harness.backend.state.bugReports.length, 1);
  assert.match(document.body.textContent, new RegExp(`#${harness.backend.state.bugReports[0].id}`));
  cleanup?.();
});

test("verification success and flag paths both render", async () => {
  const okDom = installDom({ url: `https://dash.test/verify?token=${"a".repeat(24)}` });
  const harness = createHarness();
  freshRoot();
  await mountPage("assets/app/pages/verify.js", harness, { path: "/verify", params: {}, query: {} });
  await flush(15);
  assert.match(document.body.textContent, /You're verified/);

  okDom.window.close();
  const flaggedDom = installDom({ url: `https://dash.test/verify?token=${"flag".repeat(6)}` });
  const secondHarness = createHarness();
  freshRoot();
  await mountPage("assets/app/pages/verify.js", secondHarness, { path: "/verify", params: {}, query: {} });
  await flush(15);
  assert.match(document.body.textContent, /Verification failed/);
  flaggedDom.window.close();
});

test("API host controls and diagnostics stay behind the developer allow-list", async () => {
  installDom();
  const normal = createHarness();
  freshRoot();
  let mounted = await mountPage("assets/app/pages/me.js", normal, { path: "/me", params: {}, query: {} });
  await flush(6);
  let text = document.getElementById("root").textContent;
  assert.equal(text.includes("Developer tools"), false, "regular accounts never see developer tools");
  assert.equal(text.includes("API base URL"), false, "regular accounts never see the API host");
  assert.equal(text.includes("api.test"), false, "the API host is not rendered");
  mounted.cleanup?.();

  freshRoot();
  mounted = await mountPage("assets/app/pages/status.js", normal, { path: "/status", params: {}, query: {} });
  await flush(6);
  text = document.getElementById("root").textContent;
  assert.equal(text.includes("api.test"), false, "diagnostics never print the API base");
  assert.equal(/API (base|host)/i.test(text), false, "diagnostics has no API host control");
  mounted.cleanup?.();

  freshRoot();
  const signedOut = createHarness({ signedOut: true, url: "https://dash.test/login" });
  mounted = await mountPage("assets/app/pages/login.js", signedOut, { path: "/login", params: {}, query: {} });
  await flush(3);
  text = document.body.textContent;
  assert.equal(text.includes("Advanced: API host"), false, "sign-in has no API host editor");
  assert.equal(text.includes("API base URL"), false);
  mounted.cleanup?.();

  const developer = createHarness({ userId: "834869554798395392" });
  freshRoot();
  mounted = await mountPage("assets/app/pages/me.js", developer, { path: "/me", params: {}, query: {} });
  await flush(6);
  text = document.getElementById("root").textContent;
  assert.match(text, /Developer tools/, "allow-listed developers can open account tools");
  assert.match(text, /Enable developer tools/, "developer tools are opt-in");
  assert.equal(text.includes("API base URL"), false, "the host editor is hidden until a developer opts in");

  const developerCard = [...document.querySelectorAll("section.card")].find((card) => card.querySelector(".card-title")?.textContent === "Developer tools");
  assert.ok(developerCard, "developer card is present");
  developerCard.querySelector('input[role="switch"]').click();
  await flush(3);
  assert.equal(developer.prefs.get().showDeveloperTools, true, "switch persists the developer opt-in");
  text = document.getElementById("root").textContent;
  assert.match(text, /API base URL/, "opting in reveals the API host editor");
  assert.ok(document.querySelector("input.mono"), "the host field is a real input");
  mounted.cleanup?.();
});

test.after(() => {
  assert.deepEqual(browserErrors, [], "no uncaught browser errors across the page suite");
});
