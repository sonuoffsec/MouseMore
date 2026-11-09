// Mirrors the serde types in apps/desktop/src-tauri and core/mousemore-core.

export type Theme = "dark" | "light" | "system";
export type Button = "left" | "right" | "middle" | "x1" | "x2";
export type ColorMode = "solid" | "rainbow";
export type Modifier = "none" | "ctrl" | "alt" | "shift";

export type WindowOp =
  | "minimize" | "maximize_toggle" | "restore" | "close"
  | "snap_left" | "snap_right" | "move_to_next_monitor" | "move_to_prev_monitor";
export type SystemOp =
  | "screenshot" | "screen_record" | "clipboard_history" | "task_view" | "show_desktop" | "switch_app"
  | "volume_up" | "volume_down" | "volume_mute" | "media_play_pause" | "media_next" | "media_prev"
  | "magnifier" | "pointer_settings";
export type ToolKind = "annotate" | "ruler" | "clear_annotations" | "locate_pointer";
export type ToggleKind = "global" | "effects" | "gestures" | "precision";

export type Action =
  | { type: "none" }
  | { type: "keys"; combo: string }
  | { type: "launch"; target: string; args: string }
  | { type: "window"; op: WindowOp }
  | { type: "system"; op: SystemOp }
  | { type: "search_selected"; url: string }
  | { type: "pointer_to_monitor"; which: "next" | "prev" }
  | { type: "mouse_click"; button: Button; double: boolean }
  | { type: "tool"; tool: ToolKind }
  | { type: "toggle"; what: ToggleKind }
  | { type: "macro"; id: string }
  | { type: "plugin"; plugin: string; action: string }
  | { type: "delay"; ms: number };

export interface Effects {
  trail: boolean;
  trail_length: number;
  click_ripple: boolean;
  click_burst: boolean;
  glow: boolean;
  glow_size: number;
  spotlight: boolean;
  spotlight_radius: number;
  spotlight_dim: number;
  color: string;
  color_mode: ColorMode;
  intensity: number;
  speed: number;
  disable_in_fullscreen: boolean;
}
export interface GestureBinding { pattern: string; action: Action }
export interface Gestures {
  enabled: boolean;
  button: Button;
  min_distance: number;
  shake_locate: boolean;
  shake_sensitivity: number;
  bindings: GestureBinding[];
}
export interface RadialItem { label: string; action: Action }
export interface Radial { enabled: boolean; button: Button; items: RadialItem[] }
export interface Edges {
  enabled: boolean;
  dwell_ms: number;
  top_left: Action; top_right: Action; bottom_left: Action; bottom_right: Action;
  top: Action; bottom: Action; left: Action; right: Action;
}
export interface Remap { button: Button; clicks: number; action: Action }
export interface Scroll { speed_percent: number; reverse: boolean; horizontal_modifier: Modifier }
export interface Pointer { speed: number | null; precision_speed: number; double_click_ms: number | null }
export interface Accessibility {
  large_pointer: boolean;
  large_pointer_size: number;
  pointer_color: string;
  click_visual: boolean;
  click_color: string;
  click_sound: boolean;
}
export interface Presentation { laser: boolean; color: string; size: number }

export interface Behavior {
  effects: Effects;
  gestures: Gestures;
  radial: Radial;
  edges: Edges;
  remaps: Remap[];
  scroll: Scroll;
  pointer: Pointer;
  accessibility: Accessibility;
  presentation: Presentation;
}

export interface Profile { id: string; name: string; apps: string[]; behavior: Behavior }
export interface Macro { id: string; name: string; steps: Action[] }
export interface General { close_to_tray: boolean; start_with_windows: boolean; start_hidden: boolean }

export interface Settings {
  version: number;
  global_enabled: boolean;
  live_monitor: boolean;
  theme: Theme;
  reduce_motion: boolean;
  active_profile: string;
  auto_switch_profiles: boolean;
  recent_features: string[];
  general: General;
  profiles: Profile[];
  macros: Macro[];
  plugins_enabled: string[];
}

export interface EngineStatus {
  engine_running: boolean;
  hook_installed: boolean;
  hook_error: string | null;
  hotkey_registered: boolean;
  hotkey_label: string;
  tool_hotkeys_registered: boolean;
  annotate_hotkey_label: string;
  ruler_hotkey_label: string;
}

export interface Rect { x: number; y: number; w: number; h: number }

export interface PlatformInfo {
  os: string;
  portable: boolean;
  config_path: string;
  plugin_dir: string;
  app_version: string;
  virtual_screen: Rect;
}

export interface Foreground { exe: string | null; fullscreen: boolean }
export interface RuntimeFlags { effects_off: boolean; gestures_off: boolean; precision: boolean }

export interface RuntimeInfo {
  effective_profile: string;
  foreground: Foreground;
  flags: RuntimeFlags;
  tool: ToolKind | null;
  overlay_visible: boolean;
  hook_wanted: boolean;
  /** Behaviour actually in force: active/auto-selected profile plus session switches. */
  behavior: Behavior;
}

export interface Snapshot {
  settings: Settings;
  engine: EngineStatus;
  platform: PlatformInfo;
  runtime: RuntimeInfo;
  notice: string | null;
}

export type CapabilityStatus = "supported" | "partial" | "unsupported" | "planned";

export interface Capability { id: string; name: string; status: CapabilityStatus; detail: string }

export interface MouseDevice {
  path: string;
  name: string | null;
  manufacturer: string | null;
  vendor_id: string | null;
  product_id: string | null;
  connection: string | null;
  buttons: number;
  reported_sample_rate_hz: number | null;
  has_horizontal_wheel: boolean;
}
export interface SystemMouse {
  present: boolean;
  buttons: number;
  wheel: boolean;
  horizontal_wheel: boolean;
  buttons_swapped: boolean;
}
export interface DeviceReport { devices: MouseDevice[]; system: SystemMouse; note: string | null }

export interface Activity {
  x: number;
  y: number;
  kind: string;
  moves: number;
  clicks: number;
  wheel: number;
  rate_hz: number | null;
  uptime_s: number;
}

export interface PresetInfo { id: string; name: string; description: string }
export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  actions: { id: string; label: string }[];
  folder: string;
  error: string | null;
}
export interface ImportPreview { profiles: number; macros: number; launch_targets: string[] }
