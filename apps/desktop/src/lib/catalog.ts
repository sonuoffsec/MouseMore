import {
  Accessibility, Cpu, Gamepad2, Gauge, LayoutDashboard, MousePointer2, Palette, Settings2, Sparkles,
  UserCircle2, Wand2, Workflow, type LucideIcon,
} from "lucide-react";

/**
 * The single source of truth for what MouseMore claims to do.
 *
 *  - "working":     implemented end to end.
 *  - "partial":     works, with a stated limit (see `note`).
 *  - "planned":     on the roadmap, not implemented. The UI shows no controls for it.
 *  - "unsupported": cannot be done on ordinary hardware / this OS; reason given.
 */
export type FeatureStatus = "working" | "partial" | "planned" | "unsupported";

export interface Feature {
  id: string;
  name: string;
  description: string;
  status: FeatureStatus;
  /** Roadmap phase for planned features. */
  phase?: number;
  /** Required for partial/unsupported: the limit or the reason. */
  note?: string;
}

export type SectionId =
  | "overview" | "cursor-effects" | "gestures" | "productivity" | "customization"
  | "creative" | "accessibility" | "gaming" | "automation" | "devices" | "profiles" | "settings";

export interface Section {
  id: SectionId;
  name: string;
  tagline: string;
  icon: LucideIcon;
  group: "Home" | "Customize" | "Tools" | "System";
  features: Feature[];
}

const w = (id: string, name: string, description: string): Feature => ({ id, name, description, status: "working" });
const part = (id: string, name: string, description: string, note: string): Feature =>
  ({ id, name, description, status: "partial", note });
const plan = (id: string, name: string, description: string, phase: number, note?: string): Feature =>
  ({ id, name, description, status: "planned", phase, note });
const no = (id: string, name: string, description: string, note: string): Feature =>
  ({ id, name, description, status: "unsupported", note });

export const SECTIONS: Section[] = [
  {
    id: "overview", name: "Overview", tagline: "Everything at a glance", icon: LayoutDashboard, group: "Home",
    features: [
      w("global-switch", "Global enable / disable", "Master switch plus an emergency hotkey that works from any app."),
      w("live-monitor", "Live input monitor", "Opt-in live view of pointer position, clicks and an estimated report rate."),
    ],
  },
  {
    id: "cursor-effects", name: "Cursor Effects", tagline: "Make the pointer yours", icon: Sparkles, group: "Customize",
    features: [
      w("trail", "Animated mouse trail", "A fading trail that follows the pointer."),
      w("click-ripple", "Click ripple", "A ring that expands from every click."),
      w("click-burst", "Click particle burst", "Particles fly out from every click."),
      w("glow", "Cursor glow and halo", "A soft glow around the pointer."),
      w("spotlight", "Spotlight", "Dim the screen except around the pointer."),
      w("fx-style", "Colors, rainbow mode, intensity, speed", "Tune every effect; changes preview live."),
      part("magnifier", "Cursor magnifier", "Zoom the area under the pointer.",
        "Opens the built-in Windows Magnifier (an action you can bind). MouseMore's own lens is not built."),
      plan("cursor-themes", "Animated cursor themes, morphing and physics", "Replace the pointer image itself.", 6,
        "Today's effects are drawn on an overlay; the real system cursor image is not replaced."),
    ],
  },
  {
    id: "gestures", name: "Gestures", tagline: "Move to command", icon: MousePointer2, group: "Customize",
    features: [
      w("shake-locate", "Shake to locate", "Shake the mouse to find a lost pointer."),
      w("draw-gestures", "Draw gestures", "Hold a button and draw to trigger an action."),
      w("custom-gestures", "Custom gesture creation", "Record your own stroke and bind it to any action."),
      w("radial-menu", "Radial action menu", "Hold a button, move toward an item, release."),
      w("edge-triggers", "Edge and corner triggers", "Rest the pointer at an edge or corner to run an action."),
      w("multi-click", "Double and triple click actions", "Different actions for 1, 2 and 3 clicks of a button."),
    ],
  },
  {
    id: "productivity", name: "Productivity", tagline: "Get more done", icon: Workflow, group: "Customize",
    features: [
      w("window-control", "Window snapping, minimize, maximize, close", "Control the active window from any trigger."),
      w("app-switching", "App switching and desktop navigation", "Alt+Tab, Task view, Show desktop."),
      w("screenshot", "Quick screenshot", "Starts the Windows Snipping Tool region capture."),
      w("search-selected", "Search selected text", "Copies your selection and searches the web for it."),
      w("multi-monitor", "Multi-monitor navigation", "Move the pointer or a window to the next monitor."),
      w("launcher", "Application launcher", "Open apps, files and links from the radial menu or any trigger."),
      part("clipboard", "Clipboard history", "Re-paste recent clips.",
        "Opens Windows' own clipboard history. MouseMore deliberately keeps no clipboard history of its own."),
      part("screen-recording", "Screen recording", "Start recording with a trigger.",
        "Starts the Windows Game Bar recorder (Win+Alt+R); MouseMore has no encoder."),
    ],
  },
  {
    id: "customization", name: "Customization", tagline: "Tune how it feels", icon: Gauge, group: "Customize",
    features: [
      w("remap", "Button remapping", "Give the middle and side buttons any action."),
      w("scroll", "Scroll speed, reverse and horizontal scrolling", "Rewrite the wheel; hold a key to scroll sideways."),
      w("double-click-speed", "Double-click speed", "Set the Windows double-click interval."),
      w("pointer-speed", "Pointer speed and precision mode", "Software speed presets, restored on exit."),
      part("extra-buttons", "Gaming-mouse buttons", "Buttons beyond left, right, middle and two side buttons.",
        "Windows only reports five buttons to apps. Extra buttons work only if the vendor driver maps them to those."),
    ],
  },
  {
    id: "creative", name: "Creative Tools", tagline: "Show, draw, measure", icon: Palette, group: "Tools",
    features: [
      w("annotate", "Screen drawing and annotation", "Draw on top of everything; Ctrl+Alt+Shift+D."),
      w("ruler", "Screen ruler and pixel measurement", "Measure anything in physical pixels; Ctrl+Alt+Shift+R."),
      w("presentation", "Presentation pointer", "A laser dot that follows the mouse."),
      w("highlight", "Screen highlighting", "Spotlight and click highlights for demos."),
    ],
  },
  {
    id: "accessibility", name: "Accessibility", tagline: "Comfortable for everyone", icon: Accessibility, group: "Tools",
    features: [
      part("large-pointer", "Large pointer", "A big ring around the pointer.",
        "Drawn on an overlay; the system cursor keeps its size. Use Windows pointer settings to enlarge the arrow itself."),
      w("high-contrast", "High-contrast pointer and custom colors", "Bright ring with a dark outline in any color."),
      w("click-visual", "Click visualization", "A clear flash on every click."),
      w("click-sound", "Optional click sounds", "A soft tick on every click."),
      w("locator", "Pointer locator", "Shake or press a shortcut to highlight the pointer."),
      w("slow-pointer", "Slow pointer and precision assistance", "Lower pointer speed, or toggle precision mode."),
    ],
  },
  {
    id: "gaming", name: "Gaming", tagline: "Quiet when it counts", icon: Gamepad2, group: "Tools",
    features: [
      w("game-profiles", "Per-game profiles", "A profile that switches on automatically for a game's executable."),
      w("fullscreen-quiet", "Disable effects in full-screen apps", "The overlay hides while a full-screen game is in front."),
      w("game-shortcuts", "Gaming shortcuts", "Side buttons can run any action."),
      part("polling-rate", "Polling-rate information", "How fast reports arrive.",
        "A peak estimate from events Windows delivers while you move; not a hardware reading and not changeable."),
      no("hw-dpi", "Hardware DPI switching", "Change the mouse's physical DPI.",
        "No standard OS mechanism exists; it requires each vendor's proprietary protocol. MouseMore will not pretend to do this."),
    ],
  },
  {
    id: "automation", name: "Automation", tagline: "Transparent and under your control", icon: Wand2, group: "Tools",
    features: [
      w("macros", "Macros and reusable action sequences", "Multi-step actions with delays."),
      w("app-automation", "Per-application automation", "Bindings that apply only in chosen apps."),
      w("emergency-stop", "Emergency stop", "Ctrl+Alt+Shift+M disables everything and halts running macros."),
      w("plugins", "Community plugins", "Optional actions from plugin folders you add yourself."),
    ],
  },
  {
    id: "devices", name: "Devices", tagline: "What the OS can tell us", icon: Cpu, group: "System",
    features: [
      w("device-detect", "Pointing device detection", "Name, buttons, wheel, bus type and IDs as reported by Windows."),
      w("compat-check", "Compatibility checker", "Which MouseMore capabilities work on this machine, and why."),
      no("battery", "Battery status", "Mouse battery level.", "Windows has no standard battery interface for generic mice."),
      no("device-profiles", "Per-device profiles", "Different settings per physical mouse.",
        "The low-level mouse hook cannot tell which mouse produced an event. Per-application profiles are provided instead."),
    ],
  },
  {
    id: "profiles", name: "Profiles", tagline: "Settings that follow context", icon: UserCircle2, group: "System",
    features: [
      w("profiles", "Multiple profiles", "Keep separate setups and switch between them."),
      w("app-profiles", "Per-application profiles", "Switch automatically when an app has focus."),
      w("presets", "Ready-made presets", "One-click starting points."),
    ],
  },
  {
    id: "settings", name: "Settings", tagline: "Preferences and privacy", icon: Settings2, group: "System",
    features: [
      w("theme", "Themes", "Dark, light, or follow the system."),
      w("backup", "Import, export and reset", "Back up or restore all settings as JSON."),
      w("autostart", "Start with Windows and tray", "Optional, off by default; closing can keep it in the tray."),
    ],
  },
];

export const GROUPS = ["Home", "Customize", "Tools", "System"] as const;

export const sectionById = (id: string): Section | undefined => SECTIONS.find((s) => s.id === id);

export const allFeatures = (): Feature[] => SECTIONS.flatMap((s) => s.features);

export const countByStatus = (): Record<FeatureStatus, number> => {
  const c: Record<FeatureStatus, number> = { working: 0, partial: 0, planned: 0, unsupported: 0 };
  for (const f of allFeatures()) c[f.status]++;
  return c;
};
