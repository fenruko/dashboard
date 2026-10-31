/* Tiny observable state + async query layer.
 *
 * Deliberately not a framework: pages subscribe, render, and dispose. Queries
 * own their AbortController so navigating away can never update unmounted UI,
 * and refresh() coalesces overlapping requests. */

export function createStore(initial = {}, { name = "store" } = {}) {
  let state = { ...initial };
  const listeners = new Set();
  let version = 0;

  function get() {
    return state;
  }

  function set(patch) {
    const next = typeof patch === "function" ? patch(state) : patch;
    if (!next || next === state) return state;
    const merged = { ...state, ...next };
    let changed = false;
    for (const key of Object.keys(next)) {
      if (!Object.is(state[key], merged[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return state;
    state = merged;
    version += 1;
    for (const fn of [...listeners]) {
      try {
        fn(state, { version, changed: next });
      } catch (err) {
        // A broken subscriber must not take down the app or other subscribers.
        console.error(`[${name}] subscriber failed`, err);
      }
    }
    return state;
  }

  function subscribe(fn, { immediate = false } = {}) {
    listeners.add(fn);
    if (immediate) fn(state, { version, changed: state });
    return () => listeners.delete(fn);
  }

  function select(selector, fn, options) {
    let previous = selector(state);
    return subscribe((next) => {
      const value = selector(next);
      if (!Object.is(value, previous)) {
        previous = value;
        fn(value, next);
      }
    }, options);
  }

  return { get, set, subscribe, select, reset: (next = initial) => set({ ...initial, ...next }), listeners };
}

export function createQuery(
  fetcher,
  {
    key = "query",
    cacheTtl = 0,
    autoRefresh = 0,
    enabled = true,
    transform = (value) => value,
    initialData = null,
    onStateChange = null,
  } = {}
) {
  const store = createStore({
    status: initialData != null ? "success" : "idle",
    data: initialData,
    error: null,
    updatedAt: initialData != null ? Date.now() : 0,
    fetching: false,
  }, { name: `query:${key}` });

  let controller = null;
  let timer = null;
  let disposed = false;
  let requestId = 0;

  function set(patch) {
    if (disposed) return;
    store.set(patch);
    try {
      onStateChange?.(store.get());
    } catch {
      /* ignore */
    }
  }

  async function run({ force = false } = {}) {
    if (disposed) return store.get().data;
    if (controller) {
      if (!force) return controller.promise;
      controller.abort();
    }
    const id = ++requestId;
    const ac = new AbortController();
    const promise = (async () => {
      set({ fetching: true, error: null, status: store.get().data == null ? "loading" : "refreshing" });
      try {
        const raw = await fetcher({ signal: ac.signal, force });
        if (disposed || id !== requestId) return store.get().data;
        const data = transform(raw);
        set({ status: "success", data, error: null, updatedAt: Date.now(), fetching: false });
        return data;
      } catch (error) {
        if (disposed || id !== requestId) return store.get().data;
        if (error?.name === "AbortError") {
          set({ fetching: false, status: store.get().data == null ? "idle" : store.get().status });
          return store.get().data;
        }
        set({ status: "error", error, fetching: false });
        return store.get().data;
      } finally {
        if (controller?.ac === ac) controller = null;
      }
    })();
    controller = { ac, promise };
    try {
      return await promise;
    } finally {
      if (controller?.ac === ac) controller = null;
    }
  }

  function schedule() {
    if (!autoRefresh || disposed || typeof document === "undefined") return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (document.hidden) {
        schedule();
        return;
      }
      run().finally(schedule);
    }, autoRefresh);
  }

  function start() {
    if (!enabled) return Promise.resolve(store.get().data);
    const promise = run();
    schedule();
    return promise;
  }

  const query = {
    key,
    store,
    get: store.get,
    subscribe: store.subscribe,
    start,
    run,
    refresh: () => run({ force: true }),
    reload: () => run({ force: true }),
    setData: (data) => set({ data, status: "success", updatedAt: Date.now(), error: null }),
    patchData: (fn) => set({ data: fn(store.get().data), updatedAt: Date.now() }),
    setEnabled: (value) => {
      enabled = value;
      if (value) start();
    },
    stop: () => {
      clearTimeout(timer);
      controller?.ac.abort();
      controller = null;
    },
    dispose: () => {
      disposed = true;
      clearTimeout(timer);
      controller?.ac.abort();
      controller = null;
      store.listeners.clear();
    },
    isLoading: () => store.get().status === "loading",
    isError: () => store.get().status === "error",
    isFresh: (ttl = cacheTtl) => Date.now() - store.get().updatedAt < ttl,
    get cacheTtl() {
      return cacheTtl;
    },
  };

  return query;
}

/** Subscribe to many stores and render the same element once per change. */
export function bindMany(stores, render) {
  let scheduled = false;
  const unsubscribes = stores.map((store) =>
    store.subscribe(() => {
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        render();
      });
    })
  );
  render();
  return () => unsubscribes.forEach((off) => off());
}

export function createEventBus() {
  const handlers = new Map();
  return {
    on(type, fn) {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
      return () => handlers.get(type)?.delete(fn);
    },
    emit(type, payload) {
      for (const fn of [...(handlers.get(type) || [])]) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[bus:${type}]`, err);
        }
      }
    },
    clear: () => handlers.clear(),
  };
}
