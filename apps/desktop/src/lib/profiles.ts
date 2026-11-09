import type { Behavior, Profile } from "./types";

/** A copy of `base` with every feature that draws, hooks or rewrites input switched off. */
export function quietBehavior(base: Behavior): Behavior {
  const b = structuredClone(base);
  const e = b.effects;
  e.trail = e.click_ripple = e.click_burst = e.glow = e.spotlight = false;
  b.gestures.enabled = false;
  b.gestures.shake_locate = false;
  b.radial.enabled = false;
  b.edges.enabled = false;
  b.remaps = [];
  b.scroll = { speed_percent: 100, reverse: false, horizontal_modifier: "none" };
  b.pointer.speed = null;
  b.pointer.double_click_ms = null;
  b.accessibility.large_pointer = false;
  b.accessibility.click_visual = false;
  b.accessibility.click_sound = false;
  b.presentation.laser = false;
  return b;
}

/** `Valorant-Win64-Shipping.exe` -> `valorant-win64-shipping` (profile ids are a-z, 0-9, -). */
export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/\.exe$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 28);
  return s || "profile";
}

export function uniqueId(base: string, taken: string[]): string {
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base.slice(0, 28)}-${n}`;
  return id;
}

/** Which profile, if any, claims this executable. */
export function profileForApp(profiles: Profile[], exe: string): Profile | undefined {
  const e = exe.toLowerCase();
  return profiles.find((p) => p.id !== "default" && p.apps.includes(e));
}
