import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { api, errorMessage, hasNativeEngine } from "./lib/api";
import type { Behavior, Capability, DeviceReport, PluginInfo, Profile, Settings, Snapshot } from "./lib/types";

export interface Toast { id: number; tone: "info" | "ok" | "bad"; text: string }

interface AppCtx {
  /** null until the native engine answered (or failed to). */
  snapshot: Snapshot | null;
  devices: DeviceReport | null;
  capabilities: Capability[] | null;
  plugins: PluginInfo[];
  /** Set when the native engine is unreachable or a command failed. */
  error: string | null;
  native: boolean;
  toasts: Toast[];
  /** The profile being edited (the active profile). */
  profile: Profile | null;
  behavior: Behavior | null;
  /** Save a change right away (toggles, buttons). */
  patch: (p: Partial<Settings>) => Promise<boolean>;
  /** Edit settings optimistically and save shortly after the last change (text, sliders). */
  patchSettings: (fn: (s: Settings) => void) => void;
  /** Same, for the active profile's behaviour. */
  patchBehavior: (fn: (b: Behavior) => void) => void;
  reset: () => Promise<boolean>;
  importJson: (json: string) => Promise<boolean>;
  applyPreset: (id: string) => Promise<boolean>;
  refreshHardware: () => Promise<void>;
  refreshPlugins: () => Promise<void>;
  dismissNotice: () => void;
  clearError: () => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

function applyTheme(theme: Settings["theme"]) {
  const dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

const DEBOUNCE_MS = 160;

/** Top-level settings keys whose value differs between two settings objects. */
export function changedKeys(next: Settings, base: Settings): Partial<Settings> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(next) as (keyof Settings)[]) {
    if (k === "version") continue;
    if (JSON.stringify(next[k]) !== JSON.stringify(base[k])) out[k] = next[k];
  }
  return out as Partial<Settings>;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshotState] = useState<Snapshot | null>(null);
  // Refs always hold the latest values so edits are computed synchronously.
  const snapRef = useRef<Snapshot | null>(null);
  /** The last snapshot the engine itself reported: what is really saved. */
  const committed = useRef<Snapshot | null>(null);
  const pending = useRef<number | null>(null);

  const [devices, setDevices] = useState<DeviceReport | null>(null);
  const [capabilities, setCapabilities] = useState<Capability[] | null>(null);
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const native = hasNativeEngine();
  const nextToast = useRef(1);

  /** A snapshot from the engine: authoritative, unless the user is mid-edit. */
  const accept = useCallback((s: Snapshot) => {
    committed.current = s;
    if (pending.current === null) {
      snapRef.current = s;
      setSnapshotState(s);
    }
  }, []);

  const showLocal = useCallback((s: Snapshot) => {
    snapRef.current = s;
    setSnapshotState(s);
  }, []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = nextToast.current++;
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "bad" ? 7000 : 3500);
  }, []);
  const dismissToast = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refreshHardware = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api.devices(), api.capabilities()]);
      setDevices(d);
      setCapabilities(c);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  const refreshPlugins = useCallback(async () => {
    try {
      setPlugins(await api.plugins());
    } catch (e) {
      setError(errorMessage(e));
    }
  }, []);

  useEffect(() => {
    const offs: (() => void)[] = [];
    let cancelled = false;
    (async () => {
      try {
        accept(await api.snapshot());
        await Promise.all([refreshHardware(), refreshPlugins()]);
        const subs = await Promise.all([api.onState(accept), api.onActionError((m) => toast(m, "bad"))]);
        if (cancelled) subs.forEach((u) => u());
        else offs.push(...subs);
      } catch (e) {
        setError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
      offs.forEach((u) => u());
    };
  }, [refreshHardware, refreshPlugins, toast, accept]);

  const theme = snapshot?.settings.theme ?? "dark";
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  // Hook state and capabilities depend on settings, so re-probe when they change.
  const hookKey = snapshot ? `${snapshot.engine.hook_installed}|${snapshot.engine.hook_error}|${snapshot.runtime.overlay_visible}` : "";
  useEffect(() => {
    if (hookKey) void api.capabilities().then(setCapabilities).catch(() => {});
  }, [hookKey]);

  /** Run a command that returns the new snapshot; on failure show why and roll back. */
  const run = useCallback(async (op: () => Promise<Snapshot>) => {
    try {
      accept(await op());
      setError(null);
      return true;
    } catch (e) {
      setError(errorMessage(e));
      if (pending.current !== null) {
        window.clearTimeout(pending.current);
        pending.current = null;
      }
      void api.snapshot().then(accept).catch(() => {});
      return false;
    }
  }, [accept]);

  const patchSettings = useCallback(
    (fn: (s: Settings) => void) => {
      const s = snapRef.current;
      if (!s) return;
      const settings = structuredClone(s.settings);
      fn(settings);
      showLocal({ ...s, settings });
      if (pending.current !== null) window.clearTimeout(pending.current);
      pending.current = window.setTimeout(() => {
        pending.current = null;
        const base = committed.current?.settings;
        const latest = snapRef.current?.settings;
        if (!base || !latest) return;
        const delta = changedKeys(latest, base);
        if (Object.keys(delta).length > 0) void run(() => api.updateSettings(delta as Record<string, unknown>));
      }, DEBOUNCE_MS);
    },
    [run, showLocal],
  );

  const patchBehavior = useCallback(
    (fn: (b: Behavior) => void) =>
      patchSettings((s) => {
        const p = s.profiles.find((x) => x.id === s.active_profile);
        if (p) fn(p.behavior);
      }),
    [patchSettings],
  );

  const profile = useMemo(
    () => snapshot?.settings.profiles.find((p) => p.id === snapshot.settings.active_profile) ?? null,
    [snapshot],
  );

  const value = useMemo<AppCtx>(
    () => ({
      snapshot, devices, capabilities, plugins, error, native, toasts, profile,
      behavior: profile?.behavior ?? null,
      patch: async (p) => {
        // Flush anything still waiting so the order of edits is preserved.
        if (pending.current !== null) {
          window.clearTimeout(pending.current);
          pending.current = null;
        }
        const base = committed.current?.settings;
        const queued = base && snapRef.current ? changedKeys(snapRef.current.settings, base) : {};
        return run(() => api.updateSettings({ ...queued, ...p } as Record<string, unknown>));
      },
      patchSettings,
      patchBehavior,
      reset: () => run(() => api.resetSettings()),
      importJson: (json) => run(() => api.importSettings(json)),
      applyPreset: (id) => run(() => api.applyPreset(id)),
      refreshHardware,
      refreshPlugins,
      dismissNotice: () => {
        void api.dismissNotice().catch(() => {});
        if (snapRef.current) showLocal({ ...snapRef.current, notice: null });
      },
      clearError: () => setError(null),
      toast,
      dismissToast,
    }),
    [snapshot, devices, capabilities, plugins, error, native, toasts, profile, run, patchSettings, patchBehavior, refreshHardware, refreshPlugins, toast, dismissToast, showLocal],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
