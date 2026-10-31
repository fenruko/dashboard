/* History-API router with a hash fallback for static hosts that cannot rewrite
 * deep links. Supports params, wildcards, query strings, route guards (used by
 * the settings page to protect unsaved edits) and link interception. */

export function compilePath(pattern) {
  const clean = String(pattern || "/").replace(/\/+$/, "") || "/";
  const keys = [];
  const regex = clean
    .split("/")
    .map((segment) => {
      if (!segment) return "";
      if (segment === "*") {
        keys.push("wildcard");
        return "(.*)";
      }
      if (segment.startsWith(":")) {
        const key = segment.slice(1).replace(/\?$/, "");
        keys.push(key);
        return segment.endsWith("?") ? "([^/]*)" : "([^/]+)";
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return { regex: new RegExp(`^${regex}/?$`), keys };
}

export function matchRoute(routes, pathname) {
  const path = pathname || "/";
  for (const route of routes) {
    const { regex, keys } = compilePath(route.path);
    const match = regex.exec(path);
    if (!match) continue;
    const params = {};
    keys.forEach((key, index) => {
      const value = match[index + 1];
      if (value !== undefined) {
        try {
          params[key] = decodeURIComponent(value);
        } catch {
          params[key] = value;
        }
      }
    });
    return { route, params };
  }
  return null;
}

function currentPath() {
  if (typeof location === "undefined") return "/";
  return location.pathname + location.search;
}

export function createRouter({
  routes,
  fallback = "/guilds",
  notFound = null,
  basePath = "/",
  useHash = typeof location !== "undefined" && location.protocol === "file:",
  onChange = () => {},
} = {}) {
  let started = false;
  let current = null;
  const guards = new Set();

  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;

  function stripBase(pathname) {
    if (base && pathname.startsWith(base)) return pathname.slice(base.length) || "/";
    return pathname;
  }

  function toPublic(path) {
    return `${base}${path.startsWith("/") ? path : `/${path}`}` || "/";
  }

  function readLocation() {
    if (typeof location === "undefined") return { pathname: "/", search: "", hash: "" };
    if (useHash) {
      const raw = location.hash.replace(/^#/, "") || "/";
      const [pathname, search = ""] = raw.split("?");
      return { pathname, search: search ? `?${search}` : "", hash: "" };
    }
    return { pathname: stripBase(location.pathname), search: location.search, hash: location.hash };
  }

  function queryOf(search) {
    return Object.fromEntries(new URLSearchParams(search || ""));
  }

  async function resolve(nextUrl, { replace = false, skipGuards = false } = {}) {
    const absolute = new URL(nextUrl, typeof location !== "undefined" ? location.origin : "http://localhost");
    const pathname = useHash ? nextUrl.split("?")[0] : stripBase(absolute.pathname);
    if (!skipGuards) {
      for (const guard of guards) {
        let result;
        try {
          result = await guard({ from: current?.path, to: pathname + absolute.search });
        } catch {
          result = null;
        }
        if (result === false) return false;
        if (typeof result === "string") {
          await resolve(result, { replace: true, skipGuards: true });
          return false;
        }
      }
    }

    const matched = matchRoute(routes, pathname);
    const context = {
      path: pathname,
      fullPath: pathname + absolute.search,
      search: absolute.search,
      query: queryOf(absolute.search),
      hash: absolute.hash,
      params: matched?.params || {},
      route: matched?.route || null,
      href: absolute.pathname + absolute.search + absolute.hash,
    };
    current = context;

    if (typeof location !== "undefined") {
      const target = useHash ? `${absolute.pathname}${absolute.search}${absolute.hash}` : absolute.pathname + absolute.search + absolute.hash;
      if (useHash) {
        const desired = `#${target}`;
        if (location.hash !== desired) history[replace ? "replaceState" : "pushState"](null, "", desired);
      } else if (location.pathname + location.search + location.hash !== target) {
        history[replace ? "replaceState" : "pushState"](null, "", target);
      }
    }
    try {
      onChange(context, matched);
    } catch (err) {
      console.error("router listener failed", err);
    }
    return context;
  }

  function navigate(path, options = {}) {
    return resolve(path, options);
  }

  function onLinkClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target?.closest?.("a[href]");
    if (!anchor) return;
    if (anchor.target && anchor.target !== "_self") return;
    if (anchor.hasAttribute("download") || anchor.dataset.external === "true") return;
    const raw = anchor.getAttribute("href");
    if (!raw || raw.startsWith("http") || raw.startsWith("mailto:") || raw.startsWith("#")) return;
    event.preventDefault();
    navigate(raw);
  }

  function start() {
    if (started) return;
    started = true;
    if (typeof window !== "undefined") {
      window.addEventListener("popstate", () => {
        const loc = readLocation();
        resolve(loc.pathname + loc.search, { skipGuards: true });
      });
      document.addEventListener("click", onLinkClick);
    }
    const loc = readLocation();
    const initial = loc.pathname === "/" ? fallback : loc.pathname + loc.search;
    return resolve(initial, { replace: loc.pathname === "/" && fallback !== "/" });
  }

  function stop() {
    started = false;
    if (typeof window !== "undefined") document.removeEventListener("click", onLinkClick);
  }

  return {
    start,
    stop,
    navigate,
    back: () => {
      if (typeof history !== "undefined") history.back();
    },
    replace: (path) => resolve(path, { replace: true }),
    getCurrent: () => current,
    beforeLeave: (guard) => {
      guards.add(guard);
      return () => guards.delete(guard);
    },
    routes,
    basePath: base,
    toPublic,
    notFound,
  };
}

/** Build an app path for a guild page. */
export function guildPath(guildId, suffix = "") {
  const tail = String(suffix || "").replace(/^\/+/, "");
  return `/g/${encodeURIComponent(guildId)}${tail ? `/${tail}` : ""}`;
}
