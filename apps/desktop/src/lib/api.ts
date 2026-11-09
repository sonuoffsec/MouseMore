import type {
  Action, Activity, Capability, DeviceReport, ImportPreview, PluginInfo, PresetInfo, Snapshot, ToggleKind,
} from "./types";

/** True only inside the Tauri shell. In a plain browser there is no native engine. */
export const hasNativeEngine = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function call<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!hasNativeEngine()) {
    throw new Error("The native engine is not running. Launch MouseMore as a desktop app.");
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

export async function listen<T>(event: string, cb: (payload: T) => void): Promise<() => void> {
  if (!hasNativeEngine()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  return listen<T>(event, (e) => cb(e.payload));
}

export const api = {
  snapshot: () => call<Snapshot>("get_snapshot"),
  updateSettings: (patch: Record<string, unknown>) => call<Snapshot>("update_settings", { patch }),
  resetSettings: () => call<Snapshot>("reset_settings"),
  exportSettings: () => call<string>("export_settings"),
  inspectImport: (json: string) => call<ImportPreview>("inspect_import", { json }),
  importSettings: (json: string) => call<Snapshot>("import_settings", { json }),
  dismissNotice: () => call<void>("dismiss_notice"),
  devices: () => call<DeviceReport>("get_devices"),
  capabilities: () => call<Capability[]>("get_capabilities"),
  presets: () => call<PresetInfo[]>("list_presets"),
  applyPreset: (id: string) => call<Snapshot>("apply_preset", { id }),
  plugins: () => call<PluginInfo[]>("list_plugins"),
  endTool: () => call<void>("end_tool"),
  recordGesture: (on: boolean) => call<void>("record_gesture", { on }),
  runAction: (action: Action) => call<void>("run_action", { action }),
  toggleRuntime: (what: ToggleKind) => call<void>("toggle_runtime", { what }),
  stopMacros: () => call<void>("stop_macros"),
  runningApps: () => call<string[]>("running_apps"),
  openConfigFolder: () => call<void>("open_config_folder"),
  onState: (cb: (s: Snapshot) => void) => listen<Snapshot>("state-changed", cb),
  onActivity: (cb: (a: Activity) => void) => listen<Activity>("mouse-activity", cb),
  onActionError: (cb: (m: string) => void) => listen<string>("action-error", cb),
  onGestureRecorded: (cb: (p: { pattern: string }) => void) => listen<{ pattern: string }>("gesture-recorded", cb),
};

export const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : typeof e === "string" ? e : "Unknown error";
