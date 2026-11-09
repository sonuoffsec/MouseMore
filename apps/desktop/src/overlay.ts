// Entry point of the transparent overlay window (see src-tauri/src/overlay.rs).
// Plain TypeScript, no React: this page must stay as light as possible.
import { api, listen } from "./lib/api";
import { FxRenderer, type FxConfig } from "./lib/fx/renderer";
import { Tools, type ToolName } from "./lib/fx/tools";
import type { Snapshot } from "./lib/types";

type Fx =
  | { k: "move"; x: number; y: number }
  | { k: "click"; x: number; y: number; b: string }
  | { k: "locate"; x: number; y: number }
  | { k: "clear" }
  | { k: "tool"; tool: ToolName | null }
  | { k: "gesture"; s: "start"; x: number; y: number }
  | { k: "gesture"; s: "cancel" }
  | { k: "gesture"; s: "end"; pattern: string; matched: boolean; label: string }
  | { k: "radial"; s: "open"; x: number; y: number; items: string[] }
  | { k: "radial"; s: "hover"; i: number }
  | { k: "radial"; s: "close" };

const fxCanvas = document.getElementById("fx") as HTMLCanvasElement;
const toolCanvas = document.getElementById("tools") as HTMLCanvasElement;

let origin = { x: 0, y: 0 };
const dpr = () => window.devicePixelRatio || 1;
// Events arrive in physical screen pixels; the canvas works in CSS pixels.
const toCss = (x: number, y: number): [number, number] => [(x - origin.x) / dpr(), (y - origin.y) / dpr()];

const emptyCfg = (): FxConfig => ({
  effects: {
    trail: false, trail_length: 24, click_ripple: false, click_burst: false, glow: false, glow_size: 60,
    spotlight: false, spotlight_radius: 220, spotlight_dim: 60, color: "#8b9bff", color_mode: "solid",
    intensity: 70, speed: 100, disable_in_fullscreen: true,
  },
  accessibility: {
    large_pointer: false, large_pointer_size: 90, pointer_color: "#ffd60a", click_visual: false,
    click_color: "#3ecf8e", click_sound: false,
  },
  presentation: { laser: false, color: "#ff3b30", size: 22 },
  reduceMotion: false,
});

const fx = new FxRenderer(fxCanvas, emptyCfg());
const tools = new Tools(toolCanvas, dpr, () => void api.endTool());

function layout() {
  fx.resize(window.innerWidth, window.innerHeight, dpr());
  tools.resize(window.innerWidth, window.innerHeight);
}
window.addEventListener("resize", layout);
layout();

function applySnapshot(s: Snapshot) {
  origin = { x: s.platform.virtual_screen.x, y: s.platform.virtual_screen.y };
  const b = s.runtime.behavior;
  fx.setConfig({
    effects: b.effects,
    accessibility: b.accessibility,
    presentation: b.presentation,
    reduceMotion: s.settings.reduce_motion,
  });
  if (s.runtime.tool === null) tools.set(null);
}

void api.snapshot().then(applySnapshot).catch(() => {});
void api.onState(applySnapshot);

void listen<Fx>("fx", (e) => {
  switch (e.k) {
    case "move": fx.pointer(...toCss(e.x, e.y)); break;
    case "click": fx.click(...toCss(e.x, e.y)); break;
    case "locate": fx.locate(...toCss(e.x, e.y)); break;
    case "clear": tools.clear(); break;
    case "tool": tools.set(e.tool); break;
    case "gesture":
      if (e.s === "start") fx.gestureStart(...toCss(e.x, e.y));
      else if (e.s === "end") fx.gestureEnd(e.pattern, e.matched, e.label);
      else fx.gestureCancel();
      break;
    case "radial":
      if (e.s === "open") fx.radialOpen(...toCss(e.x, e.y), e.items);
      else if (e.s === "hover") fx.radialHover(e.i);
      else fx.radialClose();
      break;
  }
});

// The gesture path is drawn from the same "move" stream the pointer uses.
void listen<Fx>("fx", (e) => {
  if (e.k === "move") fx.gestureMove(...toCss(e.x, e.y));
});
