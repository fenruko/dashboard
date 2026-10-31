/* Minimal DOM toolkit. Text is always set via textContent (never innerHTML
 * unless a caller explicitly passes `html`), so user-controlled data from
 * Discord cannot inject markup. */

const SVG_NS = "http://www.w3.org/2000/svg";

export function cx(...parts) {
  const out = [];
  for (const part of parts) {
    if (!part) continue;
    if (typeof part === "string") out.push(part);
    else if (Array.isArray(part)) out.push(cx(...part));
    else if (typeof part === "object") {
      for (const [key, value] of Object.entries(part)) if (value) out.push(key);
    }
  }
  return out.join(" ");
}

export function h(tag, props, ...children) {
  return create(tag, props, children, false);
}

export function s(tag, props, ...children) {
  return create(tag, props, children, true);
}

function create(tag, props, children, forceSvg) {
  const isSvg = forceSvg || tag === "svg" || tag === "path" || tag === "circle" || tag === "rect" || tag === "g" || tag === "line" || tag === "polyline" || tag === "polygon" || tag === "text" || tag === "defs" || tag === "linearGradient" || tag === "stop";
  const node = isSvg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);

  if (props && (typeof props !== "object" || props instanceof Node || Array.isArray(props))) {
    children = [props, ...children];
    props = null;
  }

  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === "class" || key === "className") {
      const cls = cx(value);
      if (cls) node.setAttribute("class", cls);
    } else if (key === "style") {
      if (typeof value === "string") node.style.cssText = value;
      else for (const [prop, val] of Object.entries(value)) {
        if (val == null) continue;
        if (prop.startsWith("--")) node.style.setProperty(prop, String(val));
        else node.style[prop] = typeof val === "number" && !["zIndex", "opacity", "flexGrow", "flexShrink", "lineHeight"].includes(prop) ? `${val}px` : val;
      }
    } else if (key === "dataset") {
      for (const [prop, val] of Object.entries(value)) if (val != null) node.dataset[prop] = String(val);
    } else if (key === "html") {
      node.innerHTML = String(value);
    } else if (key === "ref") {
      if (typeof value === "function") value(node);
    } else if (key === "text") {
      node.textContent = String(value);
    } else if (key === "key") {
      continue;
    } else if (key.startsWith("on") && typeof value === "function") {
      const eventName = key.slice(2).toLowerCase();
      node.addEventListener(eventName, value);
    } else if (key === "value" && !isSvg && !(node instanceof SVGElement) && (tag === "input" || tag === "textarea" || tag === "select")) {
      if (tag === "select" && node.options.length === 0) node.dataset.pendingValue = String(value);
      else node.value = value == null ? "" : String(value);
    } else if (key === "checked") {
      node.checked = Boolean(value);
      if (value) node.setAttribute("checked", "");
    } else if (key === "disabled" || key === "selected" || key === "readOnly" || key === "required" || key === "multiple" || key === "novalidate" || key === "autofocus") {
      const attr = key === "readOnly" ? "readonly" : key === "novalidate" ? "novalidate" : key.toLowerCase();
      if (value) node.setAttribute(attr, "");
      if (key === "disabled") node.disabled = true;
      if (key === "readOnly") node.readOnly = true;
    } else if (key === "innerText") {
      node.innerText = String(value);
    } else if (isSvg) {
      const attr = key === "className" ? "class" : key;
      node.setAttribute(attr, String(value));
    } else {
      node.setAttribute(key, value === true ? "" : String(value));
    }
  }

  append(node, children);
  return node;
}

export function append(parent, children) {
  for (const child of flatten(children)) {
    if (child == null || child === false || child === true) continue;
    if (child instanceof Node) parent.appendChild(child);
    else parent.appendChild(document.createTextNode(String(child)));
  }
  return parent;
}

export function flatten(children) {
  if (!Array.isArray(children)) return [children];
  return children.flatMap((child) => (Array.isArray(child) ? flatten(child) : [child]));
}

export function frag(...children) {
  return append(document.createDocumentFragment(), children);
}

export function clear(node) {
  if (!node) return node;
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function mount(target, ...children) {
  clear(target);
  append(target, children);
  return target;
}

export function qs(selector, root = document) {
  return root.querySelector(selector);
}

export function qsa(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

export function on(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/** Scoped listener bag; call .dispose() when the page unmounts. */
export function createDisposer() {
  const offs = [];
  const abort = typeof AbortController !== "undefined" ? new AbortController() : null;
  return {
    listen(target, event, handler, options) {
      const opts = { ...(options || {}), signal: abort?.signal };
      target.addEventListener(event, handler, opts);
      const off = () => target.removeEventListener(event, handler, opts);
      offs.push(off);
      return off;
    },
    add(off) {
      if (typeof off === "function") offs.push(off);
    },
    interval(fn, ms) {
      const id = setInterval(fn, ms);
      offs.push(() => clearInterval(id));
      return id;
    },
    timeout(fn, ms) {
      const id = setTimeout(fn, ms);
      offs.push(() => clearTimeout(id));
      return id;
    },
    dispose() {
      abort?.abort();
      while (offs.length) {
        try {
          offs.pop()();
        } catch {
          /* ignore */
        }
      }
    },
    get signal() {
      return abort?.signal;
    },
  };
}

export function text(value) {
  return document.createTextNode(value == null ? "" : String(value));
}

export function when(condition, node, fallback = null) {
  return condition ? node : fallback;
}

export function list(items, render) {
  return (items || []).map((item, index) => render(item, index)).filter((node) => node != null);
}

export function setText(node, value) {
  if (node) node.textContent = value == null ? "" : String(value);
}

export function toggleClass(node, className, enabled) {
  if (!node) return;
  node.classList.toggle(className, Boolean(enabled));
}

let uidCounter = 0;
export function uid(prefix = "rift") {
  uidCounter += 1;
  return `${prefix}-${uidCounter}`;
}

/** Wire a value into a <select> once its options exist. */
export function selectValue(select, value) {
  if (!select) return;
  select.value = value == null ? "" : String(value);
  if (select.value !== String(value ?? "") && value != null) {
    // Fall back to matching by option text for legacy numeric/string mismatches.
    const match = [...select.options].find((option) => option.value === String(value));
    if (match) select.value = match.value;
  }
}

export function isNode(value) {
  return typeof Node !== "undefined" && value instanceof Node;
}
