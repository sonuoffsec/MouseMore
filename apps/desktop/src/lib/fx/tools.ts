/**
 * Interactive overlay tools. While one is active the overlay window captures
 * the mouse and keyboard; Esc always leaves.
 */

const COLORS = ["#ff3b30", "#ffd60a", "#3ecf8e", "#0a84ff", "#ffffff", "#bf5af2"];

interface Stroke { color: string; width: number; pts: { x: number; y: number }[] }

export type ToolName = "annotate" | "ruler";

export class Tools {
  private ctx: CanvasRenderingContext2D;
  private active: ToolName | null = null;
  private strokes: Stroke[] = [];
  private cur: Stroke | null = null;
  private color = COLORS[0]!;
  private rulerStart: { x: number; y: number } | null = null;
  private pointer = { x: 0, y: 0 };
  private rulerDone = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private dpr: () => number,
    private onExit: () => void,
  ) {
    this.ctx = canvas.getContext("2d")!;
    canvas.addEventListener("pointerdown", (e) => this.down(e));
    canvas.addEventListener("pointermove", (e) => this.move(e));
    canvas.addEventListener("pointerup", (e) => this.up(e));
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    window.addEventListener("keydown", (e) => this.key(e));
  }

  resize(w: number, h: number) {
    const d = this.dpr();
    this.canvas.width = Math.round(w * d);
    this.canvas.height = Math.round(h * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    this.redraw();
  }

  /** Strokes persist across tool sessions until cleared. */
  clear() {
    this.strokes = [];
    this.cur = null;
    this.redraw();
  }

  set(tool: ToolName | null) {
    this.active = tool;
    this.rulerStart = null;
    this.rulerDone = false;
    this.canvas.style.pointerEvents = tool ? "auto" : "none";
    this.canvas.style.cursor = tool === "annotate" ? "crosshair" : tool === "ruler" ? "crosshair" : "default";
    this.redraw();
  }

  private pos(e: PointerEvent) {
    return { x: e.clientX, y: e.clientY };
  }

  private down(e: PointerEvent) {
    if (!this.active) return;
    const p = this.pos(e);
    if (this.active === "annotate") {
      if (e.button === 2) {
        this.strokes.pop();
      } else {
        this.canvas.setPointerCapture(e.pointerId);
        this.cur = { color: this.color, width: 4, pts: [p] };
        this.strokes.push(this.cur);
      }
    } else if (this.rulerDone || !this.rulerStart) {
      this.rulerStart = p;
      this.rulerDone = false;
    }
    this.redraw();
  }

  private move(e: PointerEvent) {
    if (!this.active) return;
    this.pointer = this.pos(e);
    if (this.cur) this.cur.pts.push(this.pointer);
    this.redraw();
  }

  private up(_e: PointerEvent) {
    if (this.active === "ruler" && this.rulerStart) this.rulerDone = true;
    this.cur = null;
    this.redraw();
  }

  private key(e: KeyboardEvent) {
    if (!this.active) return;
    if (e.key === "Escape") {
      this.onExit();
    } else if (this.active === "annotate") {
      if (e.key === "c" || e.key === "C") this.clear();
      else if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || !e.shiftKey)) this.strokes.pop();
      else if (/^[1-6]$/.test(e.key)) this.color = COLORS[Number(e.key) - 1]!;
      this.redraw();
    }
  }

  private redraw() {
    const ctx = this.ctx;
    const w = this.canvas.width / this.dpr();
    const h = this.canvas.height / this.dpr();
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const s of this.strokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.beginPath();
      s.pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      if (s.pts.length === 1) ctx.lineTo(s.pts[0]!.x + 0.1, s.pts[0]!.y);
      ctx.stroke();
    }
    if (this.active === "annotate") this.hud(ctx, w, h, "Draw with the mouse · right-click undo · 1–6 colors · C clear · Esc done");
    if (this.active === "ruler") this.drawRuler(ctx, w, h);
  }

  private hud(ctx: CanvasRenderingContext2D, w: number, _h: number, text: string) {
    ctx.font = "600 13px 'Segoe UI Variable Text','Segoe UI',sans-serif";
    const tw = ctx.measureText(text).width + 28;
    const x = (w - tw) / 2;
    ctx.fillStyle = "rgba(14,15,19,0.92)";
    ctx.beginPath();
    ctx.roundRect(x, 18, tw, 34, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.stroke();
    ctx.fillStyle = "#e9eaee";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + 14, 35.5);
    if (this.active === "annotate") {
      COLORS.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + tw + 20 + i * 22, 35, c === this.color ? 9 : 6, 0, Math.PI * 2);
        ctx.fill();
      });
    }
  }

  private drawRuler(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const d = this.dpr();
    const p = this.pointer;
    ctx.strokeStyle = "rgba(139,155,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x + 0.5, 0);
    ctx.lineTo(p.x + 0.5, h);
    ctx.moveTo(0, p.y + 0.5);
    ctx.lineTo(w, p.y + 0.5);
    ctx.stroke();
    const s = this.rulerStart;
    let label = `${Math.round(p.x * d)}, ${Math.round(p.y * d)} px`;
    if (s) {
      const x = Math.min(s.x, p.x), y = Math.min(s.y, p.y);
      const bw = Math.abs(p.x - s.x), bh = Math.abs(p.y - s.y);
      ctx.fillStyle = "rgba(139,155,255,0.16)";
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeStyle = "#8b9bff";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, bw, bh);
      const pw = Math.round(bw * d), ph = Math.round(bh * d);
      label = `${pw} × ${ph} px   ·   diagonal ${Math.round(Math.hypot(pw, ph))} px`;
    }
    ctx.font = "600 13px 'Segoe UI Variable Text','Segoe UI',sans-serif";
    const tw = ctx.measureText(label).width + 20;
    const lx = Math.min(p.x + 16, w - tw - 8);
    const ly = Math.min(p.y + 18, h - 34);
    ctx.fillStyle = "rgba(14,15,19,0.94)";
    ctx.beginPath();
    ctx.roundRect(lx, ly, tw, 26, 8);
    ctx.fill();
    ctx.fillStyle = "#e9eaee";
    ctx.textBaseline = "middle";
    ctx.fillText(label, lx + 10, ly + 13.5);
    this.hud(ctx, w, h, "Click and drag to measure · click again to restart · Esc done");
  }
}
