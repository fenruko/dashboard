/* Entry point. Boots the app, surfaces a useful error instead of a blank page. */

import { createApp } from "./app.js";

const root = document.getElementById("root");

function showBootError(error) {
  console.error("[rift] boot failed", error);
  if (!root) return;
  root.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = "boot";
  const title = document.createElement("h1");
  title.textContent = "Rift Dashboard didn't start";
  const message = document.createElement("p");
  message.textContent = error?.message || String(error);
  const hint = document.createElement("p");
  hint.className = "boot-note";
  hint.textContent = "A hard refresh usually fixes this. If not, your browser may be blocking module scripts.";
  const reload = document.createElement("button");
  reload.className = "btn btn--primary";
  reload.textContent = "Reload";
  reload.addEventListener("click", () => location.reload());
  wrap.append(title, message, hint, reload);
  root.append(wrap);
}

let app = null;
try {
  app = createApp({ root });
  app.start().catch(showBootError);
  window.__rift = app;
} catch (error) {
  showBootError(error);
}

// Keep the preview/iframe friendly: never let a transient unhandled rejection
// clear the document, and do not trap focus inside the app shell.
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.name === "AbortError") event.preventDefault();
});
