import { Eye, Gauge, MousePointerClick, Radar, Volume2 } from "lucide-react";
import { Page } from "../components/Page";
import { Button, Card, ColorField, FeatureCard, Row, SectionTitle, Slider, Switch } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../state";

export function AccessibilityPage() {
  const { snapshot } = useApp();
  return (
    <Page id="accessibility">
      {(b, edit) => (
        <>
          <SectionTitle>See the pointer</SectionTitle>
          <div className="grid gap-3">
            <FeatureCard icon={Eye} title="Large high-contrast pointer"
              description="A big ring with a dark outline around the pointer, in any color, visible on any background."
              enabled={b.accessibility.large_pointer} onToggle={(v) => edit((x) => { x.accessibility.large_pointer = v; })}
              note="Drawn on an overlay; the arrow itself keeps its size. Use the button below to enlarge the arrow in Windows.">
              <Slider label="Ring size" value={b.accessibility.large_pointer_size} min={40} max={240} unit=" px"
                onChange={(v) => edit((x) => { x.accessibility.large_pointer_size = v; })} />
              <ColorField label="Ring color" value={b.accessibility.pointer_color}
                onChange={(v) => edit((x) => { x.accessibility.pointer_color = v; })} />
              <Button size="sm" onClick={() => void api.runAction({ type: "system", op: "pointer_settings" })}>
                Open Windows pointer settings
              </Button>
            </FeatureCard>
            <FeatureCard icon={Radar} title="Pointer locator" description="Shake the mouse to flash a big highlight where the pointer is."
              enabled={b.gestures.shake_locate} onToggle={(v) => edit((x) => { x.gestures.shake_locate = v; })}>
              <Slider label="Sensitivity" value={b.gestures.shake_sensitivity} min={1} max={10}
                onChange={(v) => edit((x) => { x.gestures.shake_sensitivity = v; })} />
              <ColorField label="Highlight color" value={b.accessibility.pointer_color}
                onChange={(v) => edit((x) => { x.accessibility.pointer_color = v; })} />
              <Button size="sm" onClick={() => void api.runAction({ type: "tool", tool: "locate_pointer" })}>Preview</Button>
            </FeatureCard>
          </div>

          <SectionTitle>Feel every click</SectionTitle>
          <div className="grid gap-3">
            <FeatureCard icon={MousePointerClick} title="Click visualization" description="A clear flash at the pointer on every click."
              enabled={b.accessibility.click_visual} onToggle={(v) => edit((x) => { x.accessibility.click_visual = v; })}>
              <ColorField label="Click color" value={b.accessibility.click_color}
                onChange={(v) => edit((x) => { x.accessibility.click_color = v; })} />
            </FeatureCard>
            <FeatureCard icon={Volume2} title="Click sound" description="A soft tick on every click. Off by default."
              enabled={b.accessibility.click_sound} onToggle={(v) => edit((x) => { x.accessibility.click_sound = v; })}
              note="Plays through the overlay, which needs click visualization or another overlay feature to be shown." />
          </div>

          <SectionTitle>Steady the pointer</SectionTitle>
          <FeatureCard icon={Gauge} title="Slow pointer" description="Lower the Windows pointer speed for steadier control."
            enabled={b.pointer.speed !== null} onToggle={(v) => edit((x) => { x.pointer.speed = v ? 6 : null; })}
            note="Your own Windows setting is restored when you turn this off or quit.">
            <Slider label="Pointer speed" value={b.pointer.speed ?? 6} min={1} max={20}
              format={(v) => `${v}${v === 10 ? " (Windows default)" : ""}`}
              onChange={(v) => edit((x) => { x.pointer.speed = v; })} />
          </FeatureCard>
          <div className="mt-3" />
          <Card>
            <Row label="Precision assistance" description="Temporarily slow the pointer to the precision speed. Bind it to a button for one-press use.">
              <Switch label="Precision mode" checked={snapshot?.runtime.flags.precision ?? false}
                onChange={() => void api.toggleRuntime("precision")} />
            </Row>
            <Slider label="Precision-mode speed" value={b.pointer.precision_speed} min={1} max={20}
              onChange={(v) => edit((x) => { x.pointer.precision_speed = v; })} />
          </Card>
        </>
      )}
    </Page>
  );
}
