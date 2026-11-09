import { useEffect, useState } from "react";
import { CircleDot, Crosshair, Disc3, MousePointerSquareDashed, PenLine, Plus, Radar, Trash2 } from "lucide-react";
import { ActionPicker } from "../components/ActionPicker";
import { Page } from "../components/Page";
import { Banner, Button, Card, Empty, FeatureCard, Row, SectionTitle, Select, Slider, TextInput } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { BUTTONS, arrows, buttonLabel, validPattern } from "../lib/actions";
import type { Action, Behavior } from "../lib/types";
import { useApp } from "../state";

const EDGE_ROWS: { key: keyof Behavior["edges"] & ("top_left" | "top_right" | "bottom_left" | "bottom_right" | "top" | "bottom" | "left" | "right"); label: string }[] = [
  { key: "top_left", label: "Top-left corner" },
  { key: "top_right", label: "Top-right corner" },
  { key: "bottom_left", label: "Bottom-left corner" },
  { key: "bottom_right", label: "Bottom-right corner" },
  { key: "top", label: "Top edge" },
  { key: "bottom", label: "Bottom edge" },
  { key: "left", label: "Left edge" },
  { key: "right", label: "Right edge" },
];

function RadialDiagram({ labels }: { labels: string[] }) {
  const n = labels.length;
  return (
    <svg viewBox="-110 -110 220 220" className="h-44 w-44 shrink-0" role="img" aria-label="Radial menu layout">
      {labels.map((l, i) => {
        const mid = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const a0 = mid - Math.PI / n + 0.04, a1 = mid + Math.PI / n - 0.04;
        const p = (r: number, a: number) => `${(Math.cos(a) * r).toFixed(1)} ${(Math.sin(a) * r).toFixed(1)}`;
        return (
          <g key={i}>
            <path d={`M ${p(30, a0)} L ${p(78, a0)} A 78 78 0 0 1 ${p(78, a1)} L ${p(30, a1)} A 30 30 0 0 0 ${p(30, a0)} Z`}
              fill="var(--color-raised)" stroke="var(--color-line)" />
            <text x={Math.cos(mid) * 98} y={Math.sin(mid) * 98 + 3} textAnchor="middle" fontSize="9" fill="var(--color-mute)">
              {l.length > 11 ? l.slice(0, 10) + "…" : l}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Gestures() {
  const { toast, snapshot } = useApp();
  const [pattern, setPattern] = useState("");
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    void api.onGestureRecorded((p) => {
      setPattern(p.pattern);
      setRecording(false);
      toast(`Recorded ${arrows(p.pattern)}`, "ok");
    }).then((u) => (dead ? u() : (off = u)));
    return () => {
      dead = true;
      off?.();
      void api.recordGesture(false).catch(() => {});
    };
  }, [toast]);

  const record = async (on: boolean) => {
    try {
      await api.recordGesture(on);
      setRecording(on);
    } catch (e) {
      toast(errorMessage(e), "bad");
    }
  };

  return (
    <Page id="gestures">
      {(b, edit) => {
        const g = b.gestures;
        const dupe = g.bindings.some((x) => x.pattern === pattern);
        const canAdd = validPattern(pattern) && !dupe && g.bindings.length < 48;
        return (
          <>
            {snapshot?.runtime.flags.gestures_off && (
              <Banner>Gestures and triggers are paused for this session. Resume them from the Overview.</Banner>
            )}
            <FeatureCard icon={Radar} title="Shake to locate" description="Shake the mouse left and right quickly to highlight where the pointer is."
              enabled={g.shake_locate} onToggle={(v) => edit((x) => { x.gestures.shake_locate = v; })}>
              <Slider label="Sensitivity" value={g.shake_sensitivity} min={1} max={10}
                format={(v) => (v <= 3 ? `${v} · firm shake` : v >= 8 ? `${v} · light shake` : `${v}`)}
                onChange={(v) => edit((x) => { x.gestures.shake_sensitivity = v; })} />
              <Button size="sm" onClick={() => void api.runAction({ type: "tool", tool: "locate_pointer" })}>Preview highlight</Button>
            </FeatureCard>

            <SectionTitle>Draw gestures</SectionTitle>
            <FeatureCard icon={PenLine} title="Draw to act"
              description={<>Hold <b>{buttonLabel(g.button).toLowerCase()}</b>, draw a shape, release. A short press still clicks normally.</>}
              enabled={g.enabled} onToggle={(v) => edit((x) => { x.gestures.enabled = v; })}>
              <Row label="Trigger button" description="Held back and replayed as a normal click when you don't draw.">
                <Select label="Trigger button" value={g.button} options={BUTTONS}
                  onChange={(v) => edit((x) => { x.gestures.button = v; })} />
              </Row>
              <Slider label="Minimum stroke length" value={g.min_distance} min={20} max={400} unit=" px"
                onChange={(v) => edit((x) => { x.gestures.min_distance = v; })} />
              {g.button === "right" && (
                <p className="mb-3 text-xs text-warn">
                  Dragging with the right button held (for example drag-select in some apps) won't work while gestures use it. Pick the middle or a side button if that matters to you.
                </p>
              )}

              <div className="mt-2 divide-y divide-line rounded-xl border border-line">
                {g.bindings.length === 0 && <Empty>No gestures yet. Add one below.</Empty>}
                {g.bindings.map((bd, i) => (
                  <div key={bd.pattern} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <span className="w-24 shrink-0 rounded-lg bg-raised px-2 py-1 text-center font-mono text-sm" title={bd.pattern}>
                      {arrows(bd.pattern)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <ActionPicker value={bd.action} compact label={`Gesture ${bd.pattern}`}
                        onChange={(a: Action) => edit((x) => { const t = x.gestures.bindings[i]; if (t) t.action = a; })} />
                    </div>
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Delete gesture ${bd.pattern}`}
                      onClick={() => edit((x) => { x.gestures.bindings.splice(i, 1); })} />
                  </div>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <TextInput aria-label="New gesture" value={pattern} placeholder="e.g. DR"
                  onChange={(e) => setPattern(e.target.value.toUpperCase().replace(/[^UDLR]/g, "").slice(0, 6))}
                  className="w-28 text-center font-mono" />
                <span className="w-24 text-center text-sm text-mute">{pattern ? arrows(pattern) : "U D L R"}</span>
                <Button size="sm" icon={CircleDot} variant={recording ? "primary" : "secondary"} onClick={() => void record(!recording)}>
                  {recording ? "Draw it now… (cancel)" : "Record by drawing"}
                </Button>
                <Button size="sm" variant="primary" icon={Plus} disabled={!canAdd}
                  onClick={() => { edit((x) => { x.gestures.bindings.push({ pattern, action: { type: "keys", combo: "ctrl+c" } }); }); setPattern(""); }}>
                  Add gesture
                </Button>
                {dupe && <span className="text-xs text-bad">Already bound.</span>}
              </div>
              <p className="mt-2 text-xs text-mute">
                Letters are directions: U up, D down, L left, R right. "DR" means draw down, then right.
              </p>
            </FeatureCard>

            <SectionTitle>Radial menu</SectionTitle>
            <FeatureCard icon={Disc3} title="Radial action menu" description="Hold a button, move toward an item, release to run it. A short press still clicks."
              enabled={b.radial.enabled} onToggle={(v) => edit((x) => { x.radial.enabled = v; })}>
              <Row label="Trigger button">
                <Select label="Radial trigger button" value={b.radial.button} options={BUTTONS}
                  onChange={(v) => edit((x) => { x.radial.button = v; })} />
              </Row>
              <div className="flex flex-wrap items-start gap-5">
                <RadialDiagram labels={b.radial.items.map((i) => i.label)} />
                <div className="min-w-[300px] flex-1 space-y-1">
                  {b.radial.items.map((it, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2">
                      <TextInput aria-label={`Item ${i + 1} label`} value={it.label} maxLength={24} className="w-32"
                        onChange={(e) => edit((x) => { const t = x.radial.items[i]; if (t) t.label = e.target.value; })} />
                      <div className="min-w-0 flex-1">
                        <ActionPicker value={it.action} compact label={`Radial item ${i + 1}`}
                          onChange={(a) => edit((x) => { const t = x.radial.items[i]; if (t) t.action = a; })} />
                      </div>
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove item ${i + 1}`}
                        disabled={b.radial.items.length <= 2}
                        onClick={() => edit((x) => { x.radial.items.splice(i, 1); })} />
                    </div>
                  ))}
                  <Button size="sm" icon={Plus} disabled={b.radial.items.length >= 8}
                    onClick={() => edit((x) => { x.radial.items.push({ label: "New item", action: { type: "none" } }); })}>
                    Add item
                  </Button>
                  <p className="pt-1 text-xs text-mute">Item 1 is at the top; the rest follow clockwise. Use "Open app, file or link" items to make it an app launcher.</p>
                </div>
              </div>
            </FeatureCard>

            <SectionTitle>Edges and corners</SectionTitle>
            <FeatureCard icon={MousePointerSquareDashed} title="Edge and corner triggers"
              description="Push the pointer against a screen edge or corner and rest there to run an action."
              enabled={b.edges.enabled} onToggle={(v) => edit((x) => { x.edges.enabled = v; })}>
              <Slider label="Rest time before it fires" value={b.edges.dwell_ms} min={150} max={2000} step={50} unit=" ms"
                onChange={(v) => edit((x) => { x.edges.dwell_ms = v; })} />
              <Card className="!border-0 !bg-transparent !p-0">
                {EDGE_ROWS.map((r) => (
                  <div key={r.key} className="flex flex-wrap items-center gap-3 border-t border-line py-2 first:border-0">
                    <span className="w-44 shrink-0 text-sm font-medium">{r.label}</span>
                    <ActionPicker value={b.edges[r.key]} compact label={r.label}
                      onChange={(a) => edit((x) => { x.edges[r.key] = a; })} />
                  </div>
                ))}
              </Card>
              <p className="mt-2 flex items-center gap-2 text-xs text-mute">
                <Crosshair size={13} aria-hidden /> With several monitors, the edges are those of the whole desktop.
              </p>
            </FeatureCard>
          </>
        );
      }}
    </Page>
  );
}
