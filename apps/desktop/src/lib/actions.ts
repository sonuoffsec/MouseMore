import type {
  Action, Button, Modifier, PluginInfo, SystemOp, ToggleKind, ToolKind, WindowOp,
} from "./types";

export const BUTTONS: { id: Button; label: string }[] = [
  { id: "right", label: "Right button" },
  { id: "middle", label: "Middle (wheel) button" },
  { id: "x1", label: "Side button 1 (back)" },
  { id: "x2", label: "Side button 2 (forward)" },
];
export const REMAP_BUTTONS = BUTTONS.filter((b) => b.id !== "right");

export const buttonLabel = (b: Button): string =>
  b === "left" ? "Left button" : (BUTTONS.find((x) => x.id === b)?.label ?? b);

export const MODIFIERS: { id: Modifier; label: string }[] = [
  { id: "none", label: "Off" },
  { id: "shift", label: "Hold Shift" },
  { id: "ctrl", label: "Hold Ctrl" },
  { id: "alt", label: "Hold Alt" },
];

export const WINDOW_OPS: { id: WindowOp; label: string }[] = [
  { id: "minimize", label: "Minimize window" },
  { id: "maximize_toggle", label: "Maximize / restore window" },
  { id: "restore", label: "Restore window" },
  { id: "close", label: "Close window" },
  { id: "snap_left", label: "Snap window left" },
  { id: "snap_right", label: "Snap window right" },
  { id: "move_to_next_monitor", label: "Move window to next monitor" },
  { id: "move_to_prev_monitor", label: "Move window to previous monitor" },
];

export const SYSTEM_OPS: { id: SystemOp; label: string }[] = [
  { id: "screenshot", label: "Screenshot (Snipping Tool)" },
  { id: "screen_record", label: "Screen recording (Game Bar)" },
  { id: "clipboard_history", label: "Clipboard history (Windows)" },
  { id: "task_view", label: "Task view" },
  { id: "show_desktop", label: "Show desktop" },
  { id: "switch_app", label: "Switch app (Alt+Tab)" },
  { id: "volume_up", label: "Volume up" },
  { id: "volume_down", label: "Volume down" },
  { id: "volume_mute", label: "Mute" },
  { id: "media_play_pause", label: "Play / pause" },
  { id: "media_next", label: "Next track" },
  { id: "media_prev", label: "Previous track" },
  { id: "magnifier", label: "Windows Magnifier" },
  { id: "pointer_settings", label: "Windows pointer settings" },
];

export const TOOLS: { id: ToolKind; label: string }[] = [
  { id: "annotate", label: "Draw on screen" },
  { id: "ruler", label: "Screen ruler" },
  { id: "clear_annotations", label: "Clear drawings" },
  { id: "locate_pointer", label: "Highlight the pointer" },
];

export const TOGGLES: { id: ToggleKind; label: string }[] = [
  { id: "global", label: "MouseMore on / off" },
  { id: "effects", label: "Pause / resume cursor effects" },
  { id: "gestures", label: "Pause / resume gestures and triggers" },
  { id: "precision", label: "Precision (slow pointer) mode" },
];

export const SEARCH_URL = "https://www.google.com/search?q={q}";
export const SEARCH_ENGINES = [
  { url: SEARCH_URL, label: "Google" },
  { url: "https://duckduckgo.com/?q={q}", label: "DuckDuckGo" },
  { url: "https://www.bing.com/search?q={q}", label: "Bing" },
  { url: "https://en.wikipedia.org/w/index.php?search={q}", label: "Wikipedia" },
];

export type ActionKind = Action["type"];

export const ACTION_KINDS: { id: ActionKind; label: string; group: string }[] = [
  { id: "none", label: "Do nothing", group: "General" },
  { id: "keys", label: "Press keys…", group: "Keyboard" },
  { id: "window", label: "Window action…", group: "Windows" },
  { id: "system", label: "System shortcut…", group: "Windows" },
  { id: "search_selected", label: "Search selected text", group: "Windows" },
  { id: "pointer_to_monitor", label: "Move pointer to another monitor", group: "Windows" },
  { id: "launch", label: "Open app, file or link…", group: "Launch" },
  { id: "mouse_click", label: "Mouse click…", group: "Mouse" },
  { id: "tool", label: "Screen tool…", group: "MouseMore" },
  { id: "toggle", label: "MouseMore switch…", group: "MouseMore" },
  { id: "macro", label: "Run macro…", group: "Automation" },
  { id: "plugin", label: "Plugin action…", group: "Automation" },
];

export function defaultAction(kind: ActionKind, hint?: { macroId?: string; plugin?: PluginInfo }): Action {
  switch (kind) {
    case "none": return { type: "none" };
    case "keys": return { type: "keys", combo: "ctrl+c" };
    case "launch": return { type: "launch", target: "notepad.exe", args: "" };
    case "window": return { type: "window", op: "minimize" };
    case "system": return { type: "system", op: "screenshot" };
    case "search_selected": return { type: "search_selected", url: SEARCH_URL };
    case "pointer_to_monitor": return { type: "pointer_to_monitor", which: "next" };
    case "mouse_click": return { type: "mouse_click", button: "left", double: true };
    case "tool": return { type: "tool", tool: "annotate" };
    case "toggle": return { type: "toggle", what: "effects" };
    case "macro": return { type: "macro", id: hint?.macroId ?? "" };
    case "plugin": return { type: "plugin", plugin: hint?.plugin?.id ?? "", action: hint?.plugin?.actions[0]?.id ?? "" };
    case "delay": return { type: "delay", ms: 500 };
  }
}

const label = <T extends string>(list: { id: T; label: string }[], id: T) =>
  list.find((x) => x.id === id)?.label ?? id;

/** One-line description for lists. */
export function describeAction(a: Action): string {
  switch (a.type) {
    case "none": return "Do nothing";
    case "keys": return `Press ${a.combo}`;
    case "launch": return `Open ${a.target}${a.args ? " " + a.args : ""}`;
    case "window": return label(WINDOW_OPS, a.op);
    case "system": return label(SYSTEM_OPS, a.op);
    case "search_selected": return "Search selected text";
    case "pointer_to_monitor": return `Pointer to ${a.which} monitor`;
    case "mouse_click": return `${a.double ? "Double-click" : "Click"} ${a.button}`;
    case "tool": return label(TOOLS, a.tool);
    case "toggle": return label(TOGGLES, a.what);
    case "macro": return `Run macro ${a.id || "(none)"}`;
    case "plugin": return `Plugin ${a.plugin}/${a.action}`;
    case "delay": return `Wait ${a.ms} ms`;
  }
}

/** Client-side sanity check so obvious typos are caught before the engine is asked. */
const NAMED = new Set([
  "enter", "return", "esc", "escape", "tab", "space", "backspace", "delete", "del", "insert", "ins", "home", "end",
  "pageup", "pgup", "pagedown", "pgdn", "left", "up", "right", "down", "printscreen", "prtsc", "volumeup",
  "volumedown", "volumemute", "playpause", "nexttrack", "prevtrack", "plus", "minus",
]);
const MODS = new Set(["ctrl", "control", "alt", "shift", "win", "super", "meta"]);

export function comboProblem(combo: string): string | null {
  const parts = combo.split("+").map((p) => p.trim().toLowerCase());
  if (parts.some((p) => !p)) return "Use keys joined by +, for example ctrl+shift+t";
  let keys = 0;
  for (const p of parts) {
    if (MODS.has(p)) continue;
    const isFn = /^f([1-9]|1\d|2[0-4])$/.test(p);
    if (NAMED.has(p) || /^[a-z0-9]$/.test(p) || isFn) keys++;
    else return `Unknown key "${p}"`;
  }
  if (keys === 0) return "Add a key after the modifier, for example ctrl+c";
  if (keys > 2) return "At most two non-modifier keys";
  return null;
}

export const ARROW: Record<string, string> = { U: "↑", D: "↓", L: "←", R: "→" };
export const arrows = (pattern: string): string => [...pattern].map((c) => ARROW[c] ?? c).join(" ");
export const validPattern = (p: string): boolean => /^[UDLR]{1,6}$/.test(p);
