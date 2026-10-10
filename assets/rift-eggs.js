/* Rift Easter Eggs — totally serious business module.
 * Hidden keybinds, console secrets, and confetti. As one does.
 * If you're reading this source: you found the treasure room. Take nothing,
 * touch everything. (Metaphorically. The code is load-bearing.) */
"use strict";

(() => {
  if (window.__riftEggs) return; // already partying

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const KONAMI = [
    "up up down down… okay, you know the ancient ways. respect.",
    "cheat mode: ON. (it does nothing. but it's ON.)",
    "the elders nod approvingly. confetti for you.",
    "konami code accepted. achievement unlocked: certified legend.",
  ];
  const VIBES = [
    "vibe check: 10/10. immaculate.",
    "vibe check: 7/10. acceptable levels of chill.",
    "vibe check: 11/10. the aux cord personally approves.",
    "vibe check passed. barely. we're watching you.",
    "vibe check: immaculate. somebody frame this moment.",
    "vibe check: immaculate energy. carry on.",
  ];
  const WORDS = [
    { word: "vibecheck", run: () => { toast(pick(VIBES)); blip(); } },
    { word: "touchgrass", run: () => toast("the grass says hi. it missed you.") },
    { word: "credits", run: () => toast("made with caffeine and questionable decisions.") },
    { word: "barrel", run: () => { roll(); toast("do a barrel roll!"); } },
    { word: "party", run: () => { confetti(); toast("PARTY MODE. it's just confetti. manage expectations."); } },
    { word: "vibe", run: () => { toast(pick(VIBES)); blip(); } },
    { word: "rift", run: () => toast("yo, welcome to the rift. shoes off at the door.") },
    { word: "sus", run: () => toast("that's pretty sus. calling an emergency meeting.") },
    { word: "dj", run: () => toast("you're the dj now. no pressure. everyone's judging.") },
    { word: "gg", run: () => toast("gg. no re.") },
  ];

  /* ----- tiny toast system (works on every page, React or not) ----- */
  let toastBox = null;
  const lastToastAt = new Map();
  function toast(message) {
    const now = Date.now();
    if (now - (lastToastAt.get(message) || 0) < 10000) return; // same joke, 10s cooldown
    lastToastAt.set(message, now);
    if (!toastBox) {
      toastBox = document.createElement("div");
      toastBox.setAttribute("style", "position:fixed;z-index:9998;right:20px;bottom:20px;display:flex;flex-direction:column;gap:8px;max-width:min(360px,calc(100vw - 32px))");
      document.body.appendChild(toastBox);
    }
    while (toastBox.children.length >= 3) toastBox.firstChild.remove();
    const el = document.createElement("div");
    el.setAttribute("style", "padding:10px 14px;border:1px solid rgba(255,255,255,0.12);border-radius:10px;background:rgba(17,21,29,0.97);color:#ece9e2;font-size:12px;line-height:1.5;box-shadow:0 12px 35px rgba(0,0,0,0.4)");
    el.textContent = message;
    toastBox.appendChild(el);
    setTimeout(() => { el.style.transition = "opacity .3s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 320); }, 3600);
  }

  /* ----- confetti: 120 pieces of pure joy, then gone without a trace ----- */
  const COLORS = ["#00b8ff", "#22c55e", "#a855f7", "#f59e0b", "#ec4899", "#ffffff"];
  let confettiAt = 0;
  function confetti() {
    const now = Date.now();
    if (now - confettiAt < 8000) return;
    confettiAt = now;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("style", "position:fixed;inset:0;z-index:9999;pointer-events:none");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    let ctx = null;
    try { ctx = canvas.getContext("2d"); } catch { ctx = null; }
    if (!ctx) { canvas.remove(); return; } // headless browsers get toast-only parties
    const bits = Array.from({ length: 130 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.25,
      w: 5 + Math.random() * 6,
      h: 8 + Math.random() * 8,
      vy: 2.2 + Math.random() * 3.2,
      vx: -1.6 + Math.random() * 3.2,
      rot: Math.random() * Math.PI * 2,
      vr: -0.15 + Math.random() * 0.3,
      color: pick(COLORS),
    }));
    const start = performance.now();
    const tick = () => {
      const alive = performance.now() - start < 2800;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const b of bits) {
        b.x += b.vx;
        b.y += b.vy;
        b.rot += b.vr;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
      if (alive) requestAnimationFrame(tick);
      else canvas.remove();
    };
    requestAnimationFrame(tick);
  }

  /* ----- the legendary barrel roll ----- */
  let rollAt = 0;
  function roll() {
    const now = Date.now();
    if (now - rollAt < 8000) return;
    rollAt = now;
    if (!document.getElementById("rift-roll-style")) {
      const style = document.createElement("style");
      style.id = "rift-roll-style";
      style.textContent = "@keyframes rift-roll{to{transform:rotate(360deg)}}.rift-rolling{animation:rift-roll .9s ease}";
      document.head.appendChild(style);
    }
    document.body.classList.add("rift-rolling");
    const done = () => document.body.classList.remove("rift-rolling");
    document.body.addEventListener("animationend", done, { once: true });
    setTimeout(done, 1200); // seatbelts. safety first.
  }

  /* ----- vibe blip: a tiny toast-adjacent console nod ----- */
  function blip() {
    console.log("%cvibe levels nominal.", "color:#22c55e;font-style:italic");
  }

  /* ----- keyboard spies ----- */
  const SEQ = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let seqPos = 0;
  let buffer = "";

  function typingField(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    const tag = (el.tagName || "").toUpperCase();
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (typingField(e.target) || typingField(document.activeElement)) { seqPos = 0; return; }
    // konami progress
    const want = SEQ[seqPos];
    if (e.key === want || (want.length === 1 && e.key.toLowerCase() === want)) {
      seqPos++;
      if (seqPos === SEQ.length) {
        seqPos = 0;
        buffer = "";
        confetti();
        toast(pick(KONAMI));
        console.log("%cachievement unlocked: ancient ways", "color:#f59e0b;font-weight:bold");
      }
      return;
    }
    seqPos = e.key === SEQ[0] ? 1 : 0;
    // typed words
    if (e.key === "Escape") { buffer = ""; return; }
    if (e.key.length !== 1) return;
    buffer = (buffer + e.key.toLowerCase()).slice(-24);
    for (const entry of WORDS) {
      if (buffer.endsWith(entry.word)) {
        buffer = "";
        entry.run();
        return;
      }
    }
  });

  /* ----- console treasure map ----- */
  function greet() {
    console.log(
      "%c RIFT DASHBOARD ",
      "background:#00b8ff;color:#000;font-weight:bold;border-radius:4px;padding:2px 6px"
    );
    console.log(
      "psst. console digger? respect.\n" +
      "cheat codes (type anywhere except text fields):\n" +
      "  party · vibe · dj · rift · gg · sus · credits · touchgrass · barrel\n" +
      "  konami: up up down down left right left right B A\n" +
      "or just call __riftEggs.party() from right here. we won't tell."
    );
    const d = new Date();
    if (d.getDay() === 5 && d.getDate() === 13) {
      console.log("oh also: it's friday the 13th. the bot is watching. (affectionately.)");
    }
  }

  window.__riftEggs = {
    toast,
    confetti,
    roll,
    vibe: () => toast(pick(VIBES)),
    party: () => { confetti(); toast("PARTY MODE. it's just confetti. manage expectations."); },
    codes: ["party", "vibe", "vibecheck", "dj", "rift", "gg", "sus", "credits", "touchgrass", "barrel", "konami ↑↑↓↓←→←→BA"],
    help: () => console.log("type one of these anywhere (not in text fields): " + window.__riftEggs.codes.join(" · ")),
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", greet, { once: true });
  else greet();
})();
