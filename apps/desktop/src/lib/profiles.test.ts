import { describe, expect, it } from "vitest";
import { profileForApp, quietBehavior, slugify, uniqueId } from "./profiles";
import type { Behavior, Profile } from "./types";

const loud = (): Behavior => ({
  effects: { trail: true, trail_length: 24, click_ripple: true, click_burst: true, glow: true, glow_size: 60,
    spotlight: true, spotlight_radius: 220, spotlight_dim: 60, color: "#8b9bff", color_mode: "solid",
    intensity: 70, speed: 100, disable_in_fullscreen: true },
  gestures: { enabled: true, button: "right", min_distance: 60, shake_locate: true, shake_sensitivity: 5, bindings: [] },
  radial: { enabled: true, button: "middle", items: [] },
  edges: { enabled: true, dwell_ms: 450, top_left: { type: "none" }, top_right: { type: "none" }, bottom_left: { type: "none" },
    bottom_right: { type: "none" }, top: { type: "none" }, bottom: { type: "none" }, left: { type: "none" }, right: { type: "none" } },
  remaps: [{ button: "x1", clicks: 1, action: { type: "none" } }],
  scroll: { speed_percent: 200, reverse: true, horizontal_modifier: "shift" },
  pointer: { speed: 15, precision_speed: 3, double_click_ms: 300 },
  accessibility: { large_pointer: true, large_pointer_size: 90, pointer_color: "#ffd60a", click_visual: true, click_color: "#3ecf8e", click_sound: true },
  presentation: { laser: true, color: "#ff3b30", size: 22 },
});

describe("quietBehavior", () => {
  it("switches every hooking or drawing feature off", () => {
    const q = quietBehavior(loud());
    expect(q.effects.trail || q.effects.click_ripple || q.effects.click_burst || q.effects.glow || q.effects.spotlight).toBe(false);
    expect(q.gestures.enabled || q.gestures.shake_locate || q.radial.enabled || q.edges.enabled).toBe(false);
    expect(q.remaps).toEqual([]);
    expect(q.scroll).toEqual({ speed_percent: 100, reverse: false, horizontal_modifier: "none" });
    expect(q.pointer.speed).toBeNull();
    expect(q.accessibility.large_pointer || q.accessibility.click_visual || q.accessibility.click_sound).toBe(false);
    expect(q.presentation.laser).toBe(false);
  });

  it("does not mutate its input", () => {
    const b = loud();
    quietBehavior(b);
    expect(b.effects.trail).toBe(true);
  });
});

describe("ids", () => {
  it("slugifies executable names", () => {
    expect(slugify("Valorant-Win64-Shipping.exe")).toBe("valorant-win64-shipping");
    expect(slugify("  Cool Game!! ")).toBe("cool-game");
    expect(slugify("???")).toBe("profile");
  });

  it("makes ids unique", () => {
    expect(uniqueId("game", [])).toBe("game");
    expect(uniqueId("game", ["game"])).toBe("game-2");
    expect(uniqueId("game", ["game", "game-2"])).toBe("game-3");
  });

  it("finds the profile for an app, ignoring the default profile", () => {
    const p = (id: string, apps: string[]): Profile => ({ id, name: id, apps, behavior: loud() });
    const list = [p("default", ["a.exe"]), p("game", ["game.exe"])];
    expect(profileForApp(list, "GAME.exe")?.id).toBe("game");
    expect(profileForApp(list, "a.exe")).toBeUndefined();
  });
});
