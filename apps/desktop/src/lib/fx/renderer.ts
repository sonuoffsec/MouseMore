/** Canvas renderer for cursor effects. Shared by the overlay window and the in-app preview,
 *  so what you tune is exactly what is drawn. Requests frames only while something moves. */

import type { Accessibility, Effects, Presentation } from "../types";

export interface FxConfig {
  effects: Effects;
  accessibility: Accessibility;
  presentation: Presentation;
  reduceMotion: boolean;
}

interface Pt { x: number; y: number; t: number }
interface Ring { x: number; y: number; t0: number; color: string; big: boolean }
interface Particle { x: number; y: number; vx: number; vy: number; t0: number; color: string }
interface Locate { x: number; y: number; t0: number }
interface Gesture {
  pts: { x: number; y: number }[];
  ended: boolean;
  t_end: number;
  pattern: string;
  matched: boolean;
  label: string;
}
interface Radial { cx: number; cy: number; items: string[]; hover: number; t0: number; closing: number }

const TAU = Math.PI * 2;

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a))})`;
};

/**
 * Draws every MouseMore visual effect on a canvas. It is used by the real
 * click-through overlay and by the live preview in the app, so what you tune
 * is exactly what you get. It only schedules frames while something is moving.
 */
export class FxRenderer {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private raf = 0;
  private cfg: FxConfig;
  private p: { x: number; y: number } | null = null;
  private trail: Pt[] = [];
  private rings: Ring[] = [];
  private particles: Particle[] = [];
  private locates: Locate[] = [];
  private gesture: Gesture | null = null;
  private radial: Radial | null = null;
  private audio: AudioContext | null = null;

  constructor(private canvas: HTMLCanvasElement, cfg: FxConfig) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas is not available");
    this.ctx = ctx;
    this.cfg = cfg;
  }

  setConfig(cfg: FxConfig) {
    this.cfg = cfg;
    if (!cfg.effects.trail) this.trail = [];
    this.request();
  }

  resize(w: number, h: number, dpr: number) {
    this.w = w;
    this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.request();
  }

  // ----------------------------------------------------------- inputs ----

  pointer(x: number, y: number) {
    this.p = { x, y };
    if (this.cfg.effects.trail) {
      this.trail.push({ x, y, t: performance.now() });
      if (this.trail.length > this.cfg.effects.trail_length) this.trail.shift();
    }
    this.request();
  }

  leave() {
    this.p = null;
    this.request();
  }

  click(x: number, y: number) {
    const { effects: e, accessibility: a } = this.cfg;
    const now = performance.now();
    if (e.click_ripple) this.rings.push({ x, y, t0: now, color: this.colorAt(now, e), big: false });
    if (a.click_visual) this.rings.push({ x, y, t0: now, color: a.click_color, big: true });
    if (e.click_burst && !this.cfg.reduceMotion) {
      for (let i = 0; i < 16; i++) {
        const ang = (i / 16) * TAU + Math.random() * 0.4;
        const v = (0.12 + Math.random() * 0.18) * (0.5 + e.intensity / 100);
        this.particles.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, t0: now, color: this.colorAt(now + i * 20, e) });
      }
    }
    if (a.click_sound) this.beep();
    this.request();
  }

  locate(x: number, y: number) {
    this.locates.push({ x, y, t0: performance.now() });
    this.request();
  }

  gestureStart(x: number, y: number) {
    this.gesture = { pts: [{ x, y }], ended: false, t_end: 0, pattern: "", matched: false, label: "" };
    this.request();
  }
  gestureMove(x: number, y: number) {
    this.gesture?.pts.push({ x, y });
    this.request();
  }
  gestureEnd(pattern: string, matched: boolean, label: string) {
    if (!this.gesture) return;
    Object.assign(this.gesture, { ended: true, t_end: performance.now(), pattern, matched, label });
    this.request();
  }
  gestureCancel() {
    this.gesture = null;
    this.request();
  }

  radialOpen(cx: number, cy: number, items: string[]) {
    this.radial = { cx, cy, items, hover: -1, t0: performance.now(), closing: 0 };
    this.request();
  }
  radialHover(i: number) {
    if (this.radial) this.radial.hover = i;
    this.request();
  }
  radialClose() {
    if (this.radial) this.radial.closing = performance.now();
    this.request();
  }

  clearAll() {
    this.trail = [];
    this.rings = [];
    this.particles = [];
    this.locates = [];
    this.gesture = null;
    this.radial = null;
    this.request();
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    void this.audio?.close();
  }

  // --------------------------------------------------------- internals ----

  private beep() {
    try {
      this.audio ??= new AudioContext();
      const o = this.audio.createOscillator();
      const g = this.audio.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.04;
      o.connect(g).connect(this.audio.destination);
      o.start();
      o.stop(this.audio.currentTime + 0.04);
    } catch {
      /* audio may be unavailable; the visual cue still works */
    }
  }

  private colorAt(t: number, e: Effects): string {
    return e.color_mode === "rainbow" ? `hsl(${(t / 6) % 360} 90% 62%)` : e.color;
  }

  private get speed(): number {
    return this.cfg.reduceMotion ? 1.5 : Math.max(0.25, this.cfg.effects.speed / 100);
  }

  private request() {
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  private frame(_t: number) {
    this.raf = 0;
    const now = performance.now();
    this.draw(now);
    if (this.animating(now)) this.request();
  }

  private animating(now: number): boolean {
    const life = 500 / this.speed;
    return (
      this.rings.length > 0 ||
      this.particles.length > 0 ||
      this.locates.length > 0 ||
      (this.trail.length > 0 && now - (this.trail[this.trail.length - 1]?.t ?? 0) < life * 1.2) ||
      (this.gesture?.ended ?? false) ||
      (this.radial !== null && (this.radial.closing > 0 || now - this.radial.t0 < 220))
    );
  }

  private draw(now: number) {
    const { ctx, w, h } = this;
    const { effects: e, accessibility: a, presentation: pr } = this.cfg;
    const i = e.intensity / 100;
    const sp = this.speed;
    ctx.clearRect(0, 0, w, h);
    const p = this.p;

    if (e.spotlight && p) {
      ctx.fillStyle = `rgba(0,0,0,${e.spotlight_dim / 100})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "destination-out";
      const r = e.spotlight_radius;
      const g = ctx.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
    }

    if (e.glow && p) {
      const c = this.colorAt(now, e);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, e.glow_size);
      g.addColorStop(0, c.startsWith("#") ? rgba(c, 0.55 * i) : c.replace(")", ` / ${0.55 * i})`));
      g.addColorStop(1, c.startsWith("#") ? rgba(c, 0) : c.replace(")", " / 0)"));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, e.glow_size, 0, TAU);
      ctx.fill();
    }

    if (e.trail) {
      const life = 500 / sp;
      this.trail = this.trail.filter((t) => now - t.t < life);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (let k = 1; k < this.trail.length; k++) {
        const a0 = this.trail[k - 1]!;
        const b = this.trail[k]!;
        const age = 1 - (now - b.t) / life;
        if (age <= 0) continue;
        ctx.strokeStyle = this.colorAt(b.t, e);
        ctx.globalAlpha = Math.max(0, age) * (0.35 + 0.65 * i);
        ctx.lineWidth = 2 + age * (3 + 9 * i);
        ctx.beginPath();
        ctx.moveTo(a0.x, a0.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    this.rings = this.rings.filter((r) => (now - r.t0) * sp < (r.big ? 650 : 520));
    for (const r of this.rings) {
      const dur = r.big ? 650 : 520;
      const t = ((now - r.t0) * sp) / dur;
      const ease = 1 - (1 - t) ** 3;
      const max = (r.big ? 70 : 36 + 44 * i);
      ctx.strokeStyle = r.color;
      ctx.globalAlpha = (1 - t) * (r.big ? 0.95 : 0.4 + 0.6 * i);
      ctx.lineWidth = r.big ? 6 : 3;
      ctx.beginPath();
      ctx.arc(r.x, r.y, 6 + ease * max, 0, TAU);
      ctx.stroke();
      if (r.big) {
        ctx.fillStyle = r.color;
        ctx.globalAlpha = (1 - t) * 0.25;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    this.particles = this.particles.filter((q) => (now - q.t0) * sp < 650);
    for (const q of this.particles) {
      const age = (now - q.t0) * sp;
      const t = age / 650;
      ctx.fillStyle = q.color;
      ctx.globalAlpha = (1 - t) * (0.5 + 0.5 * i);
      ctx.beginPath();
      ctx.arc(q.x + q.vx * age, q.y + q.vy * age + t * t * 24, 2.5 * (1 - t) + 1, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (a.large_pointer && p) this.largePointer(p.x, p.y, a);
    if (pr.laser && p) {
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = pr.size;
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr.size / 2, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    this.locates = this.locates.filter((l) => now - l.t0 < 1100);
    for (const l of this.locates) this.drawLocate(l, now, a.pointer_color);

    this.drawGesture(now);
    this.drawRadial(now);
  }

  private largePointer(x: number, y: number, a: Accessibility) {
    const ctx = this.ctx;
    const r = a.large_pointer_size / 2;
    // A dark outline under a bright ring stays visible on any background.
    ctx.lineWidth = 9;
    ctx.strokeStyle = "rgba(0,0,0,0.75)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = a.pointer_color;
    ctx.stroke();
  }

  private drawLocate(l: Locate, now: number, color: string) {
    const ctx = this.ctx;
    const t = (now - l.t0) / 1100;
    const ease = 1 - (1 - t) ** 3;
    for (let k = 0; k < 3; k++) {
      const tk = Math.min(1, Math.max(0, ease * 1.3 - k * 0.12));
      const r = 280 * (1 - tk) + 30;
      ctx.strokeStyle = color;
      ctx.globalAlpha = (1 - t) * 0.9;
      ctx.lineWidth = 6 - k * 1.5;
      ctx.beginPath();
      ctx.arc(l.x, l.y, r, 0, TAU);
      ctx.stroke();
    }
    ctx.globalAlpha = (1 - t) * 0.35;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(l.x, l.y, 46, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  private drawGesture(now: number) {
    const g = this.gesture;
    if (!g) return;
    const ctx = this.ctx;
    let fade = 1;
    if (g.ended) {
      fade = 1 - (now - g.t_end) / 900;
      if (fade <= 0) {
        this.gesture = null;
        return;
      }
    }
    ctx.globalAlpha = fade;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const color = g.ended && !g.matched ? "#9296a3" : this.cfg.effects.color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    g.pts.forEach((q, k) => (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
    ctx.stroke();
    ctx.shadowBlur = 0;
    if (g.ended) {
      const last = g.pts[g.pts.length - 1]!;
      const text = g.label;
      ctx.font = "600 14px 'Segoe UI Variable Text','Segoe UI',sans-serif";
      const tw = ctx.measureText(text).width + 24;
      const x = Math.min(Math.max(last.x - tw / 2, 8), this.w - tw - 8);
      const y = Math.min(last.y + 26, this.h - 40);
      ctx.fillStyle = "rgba(14,15,19,0.92)";
      ctx.beginPath();
      ctx.roundRect(x, y, tw, 30, 10);
      ctx.fill();
      ctx.strokeStyle = g.matched ? "#3ecf8e" : "#9296a3";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#e9eaee";
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + 12, y + 15.5);
    }
    ctx.globalAlpha = 1;
  }

  private drawRadial(now: number) {
    const r = this.radial;
    if (!r) return;
    const ctx = this.ctx;
    let k = Math.min(1, (now - r.t0) / 160);
    if (r.closing) {
      const c = (now - r.closing) / 140;
      if (c >= 1) {
        this.radial = null;
        return;
      }
      k = 1 - c;
    }
    const n = r.items.length;
    const inner = 34 * k;
    const outer = 118 * k;
    const step = TAU / n;
    ctx.globalAlpha = k;
    ctx.font = "600 13px 'Segoe UI Variable Text','Segoe UI',sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let s = 0; s < n; s++) {
      const mid = -Math.PI / 2 + s * step;
      const a0 = mid - step / 2 + 0.03;
      const a1 = mid + step / 2 - 0.03;
      ctx.beginPath();
      ctx.arc(r.cx, r.cy, outer, a0, a1);
      ctx.arc(r.cx, r.cy, inner, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = s === r.hover ? rgba(this.cfg.effects.color, 0.95) : "rgba(14,15,19,0.88)";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1;
      ctx.stroke();
      const lr = outer + 44;
      const lx = r.cx + Math.cos(mid) * lr;
      const ly = r.cy + Math.sin(mid) * lr;
      const label = r.items[s] ?? "";
      const tw = ctx.measureText(label).width + 20;
      ctx.fillStyle = s === r.hover ? "#0b0c0f" : "rgba(14,15,19,0.92)";
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2, ly - 13, tw, 26, 9);
      ctx.fill();
      ctx.fillStyle = s === r.hover ? this.cfg.effects.color : "#e9eaee";
      ctx.fillText(label, lx, ly + 0.5);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
  }
}
