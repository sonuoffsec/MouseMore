import { useEffect, useRef } from "react";
import { FxRenderer } from "../lib/fx/renderer";
import type { Accessibility, Effects, Presentation } from "../lib/types";

/**
 * Live preview using the very same renderer as the real overlay. When the
 * pointer is away it plays a gentle demo so every change is visible at once.
 */
export function FxPreview({
  effects, accessibility, presentation, reduceMotion, height = 200,
}: {
  effects: Effects; accessibility: Accessibility; presentation: Presentation; reduceMotion: boolean; height?: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const fx = useRef<FxRenderer | null>(null);
  const hovering = useRef(false);
  const cfg = { effects, accessibility, presentation, reduceMotion };
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  useEffect(() => {
    const c = canvas.current;
    const b = box.current;
    if (!c || !b) return;
    const r = new FxRenderer(c, cfgRef.current);
    fx.current = r;
    const size = () => r.resize(b.clientWidth, b.clientHeight, window.devicePixelRatio || 1);
    size();
    const ro = new ResizeObserver(size);
    ro.observe(b);

    let t = 0;
    const timer = window.setInterval(() => {
      if (hovering.current || reduceMotionNow()) return;
      t += 0.045;
      const w = b.clientWidth, h = b.clientHeight;
      r.pointer(w / 2 + Math.cos(t) * w * 0.32, h / 2 + Math.sin(t * 1.7) * h * 0.28);
      if (Math.floor(t * 10) % 36 === 0 && Math.abs(Math.sin(t * 10)) < 0.2) {
        r.click(w / 2 + Math.cos(t) * w * 0.32, h / 2 + Math.sin(t * 1.7) * h * 0.28);
      }
    }, 33);
    return () => {
      window.clearInterval(timer);
      ro.disconnect();
      r.dispose();
      fx.current = null;
    };
  }, []);

  useEffect(() => {
    fx.current?.setConfig(cfg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effects, accessibility, presentation, reduceMotion]);

  const pos = (e: React.PointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top] as const;
  };

  return (
    <div
      ref={box}
      style={{ height }}
      className="relative cursor-none select-none overflow-hidden rounded-2xl border border-line bg-[radial-gradient(circle_at_30%_20%,var(--color-raised),var(--color-bg))]"
      onPointerEnter={() => { hovering.current = true; }}
      onPointerLeave={() => { hovering.current = false; }}
      onPointerMove={(e) => fx.current?.pointer(...pos(e))}
      onPointerDown={(e) => fx.current?.click(...pos(e))}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <canvas ref={canvas} className="absolute inset-0 h-full w-full" />
      <span className="pointer-events-none absolute bottom-2.5 left-3.5 text-xs text-mute">
        Live preview · move or click here
      </span>
    </div>
  );
}

const reduceMotionNow = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
