import { Gauge, MousePointer, Move, Plus, Timer, Trash2 } from "lucide-react";
import { ActionPicker } from "../components/ActionPicker";
import { Page } from "../components/Page";
import { Banner, Button, Card, Empty, FeatureCard, Row, SectionTitle, Select, Slider, Switch } from "../components/ui";
import { api } from "../lib/api";
import { MODIFIERS, REMAP_BUTTONS } from "../lib/actions";
import type { Button as Btn } from "../lib/types";
import { useApp } from "../state";

export function Customization() {
  const { snapshot, toast } = useApp();
  return (
    <Page id="customization">
      {(b, edit) => {
        const usedByGestures = (btn: Btn) =>
          (b.gestures.enabled && b.gestures.button === btn) || (b.radial.enabled && b.radial.button === btn);
        const precision = snapshot?.runtime.flags.precision ?? false;
        return (
          <>
            <SectionTitle hint="middle and side buttons">Button remapping</SectionTitle>
            <Card>
              <p className="mb-3 text-[13px] text-mute">
                Give a button any action. Set the <b>presses</b> column to 2 or 3 to run a different action on a double or triple click
                of the same button. The left and right buttons are never remapped, so you can't lock yourself out.
              </p>
              <div className="divide-y divide-line rounded-xl border border-line">
                {b.remaps.length === 0 && <Empty>No remapped buttons.</Empty>}
                {b.remaps.map((r, i) => (
                  <div key={`${r.button}-${r.clicks}-${i}`} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <Select label="Button" value={r.button} options={REMAP_BUTTONS}
                      onChange={(v) => edit((x) => { const t = x.remaps[i]; if (t) t.button = v; })} />
                    <Select label="Presses" value={String(r.clicks)}
                      options={[{ id: "1", label: "1 press" }, { id: "2", label: "2 presses" }, { id: "3", label: "3 presses" }]}
                      onChange={(v) => edit((x) => { const t = x.remaps[i]; if (t) t.clicks = Number(v); })} />
                    <div className="min-w-0 flex-1">
                      <ActionPicker value={r.action} compact label={`Remap ${i + 1}`}
                        onChange={(a) => edit((x) => { const t = x.remaps[i]; if (t) t.action = a; })} />
                    </div>
                    <Button size="sm" variant="ghost" icon={Trash2} aria-label={`Remove remap ${i + 1}`}
                      onClick={() => edit((x) => { x.remaps.splice(i, 1); })} />
                    {usedByGestures(r.button) && (
                      <p className="w-full text-xs text-bad">This button is also used by gestures or the radial menu; pick another.</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <Button size="sm" icon={Plus} disabled={b.remaps.length >= 12}
                  onClick={() => {
                    const free = REMAP_BUTTONS.find((rb) => !usedByGestures(rb.id) && !b.remaps.some((r) => r.button === rb.id && r.clicks === 1));
                    if (!free) return toast("Every available button already has a mapping or is used by gestures.", "info");
                    edit((x) => { x.remaps.push({ button: free.id, clicks: 1, action: { type: "keys", combo: "ctrl+c" } }); });
                  }}>
                  Add remap
                </Button>
              </div>
              <p className="mt-3 text-xs text-mute">
                Windows reports five buttons to apps. Extra buttons on gaming mice only work if the vendor's driver maps them to these.
              </p>
            </Card>

            <SectionTitle>Scrolling</SectionTitle>
            <FeatureCard icon={Gauge} title="Rewrite the mouse wheel"
              description="Change scroll speed, reverse the direction, or scroll sideways while holding a key."
              enabled={b.scroll.speed_percent !== 100 || b.scroll.reverse || b.scroll.horizontal_modifier !== "none"}
              onToggle={(v) => edit((x) => { if (!v) { x.scroll.speed_percent = 100; x.scroll.reverse = false; x.scroll.horizontal_modifier = "none"; } else { x.scroll.speed_percent = 150; } })}>
              <Slider label="Scroll speed" value={b.scroll.speed_percent} min={25} max={400} step={5} unit="%"
                onChange={(v) => edit((x) => { x.scroll.speed_percent = v; })} />
              <Row label="Reverse scrolling" description="Wheel up scrolls down, like a touchpad with natural scrolling.">
                <Switch label="Reverse scrolling" checked={b.scroll.reverse} onChange={(v) => edit((x) => { x.scroll.reverse = v; })} />
              </Row>
              <Row label="Horizontal scrolling" description="While this key is held, the wheel scrolls left and right.">
                <Select label="Horizontal scroll key" value={b.scroll.horizontal_modifier} options={MODIFIERS}
                  onChange={(v) => edit((x) => { x.scroll.horizontal_modifier = v; })} />
              </Row>
            </FeatureCard>

            <SectionTitle>Pointer</SectionTitle>
            <FeatureCard icon={Move} title="Pointer speed" description="Override the Windows pointer speed while MouseMore is on."
              enabled={b.pointer.speed !== null} onToggle={(v) => edit((x) => { x.pointer.speed = v ? 10 : null; })}
              note="Your own Windows setting is saved and restored when you turn this off, disable MouseMore or quit.">
              <Slider label="Pointer speed" value={b.pointer.speed ?? 10} min={1} max={20}
                format={(v) => `${v}${v === 10 ? " (Windows default)" : ""}`}
                onChange={(v) => edit((x) => { x.pointer.speed = v; })} />
            </FeatureCard>
            <div className="mt-3" />
            <Card>
              <Row label="Precision mode" description="Slows the pointer for fine work. Toggle it here or bind it to a button with the action “MouseMore switch → Precision”.">
                <Switch label="Precision mode" checked={precision} onChange={() => void api.toggleRuntime("precision")} />
              </Row>
              <Slider label="Precision-mode speed" value={b.pointer.precision_speed} min={1} max={20}
                onChange={(v) => edit((x) => { x.pointer.precision_speed = v; })} />
            </Card>
            <div className="mt-3" />
            <FeatureCard icon={Timer} title="Double-click speed" description="Set how quickly two clicks count as a double-click."
              enabled={b.pointer.double_click_ms !== null} onToggle={(v) => edit((x) => { x.pointer.double_click_ms = v ? 500 : null; })}>
              <Slider label="Double-click interval" value={b.pointer.double_click_ms ?? 500} min={200} max={900} step={10} unit=" ms"
                onChange={(v) => edit((x) => { x.pointer.double_click_ms = v; })} />
            </FeatureCard>
            <p className="mt-4 flex items-center gap-2 text-xs text-mute">
              <MousePointer size={13} aria-hidden /> These are software settings applied through Windows. They cannot change your mouse's hardware DPI.
            </p>
            {!snapshot?.engine.hook_installed && (b.remaps.length > 0 || b.scroll.speed_percent !== 100 || b.scroll.reverse) && (
              <div className="mt-4"><Banner>MouseMore is globally disabled or the mouse hook is unavailable, so remaps and scroll changes are not active right now.</Banner></div>
            )}
          </>
        );
      }}
    </Page>
  );
}
