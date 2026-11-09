import { Eraser, Pencil, Presentation as PresentationIcon, Ruler, SunMedium } from "lucide-react";
import { Page } from "../components/Page";
import { Button, Card, ColorField, FeatureCard, Kbd, SectionTitle, Slider } from "../components/ui";
import { api } from "../lib/api";
import { useApp } from "../state";

export function Creative() {
  const { snapshot } = useApp();
  const eng = snapshot?.engine;
  const tool = snapshot?.runtime.tool;
  return (
    <Page id="creative">
      {(b, edit) => (
        <>
          <SectionTitle hint="work on top of any app">Screen tools</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-accent"><Pencil size={17} aria-hidden /></span>
                <div className="flex-1">
                  <h3 className="font-semibold">Draw on screen</h3>
                  <p className="mt-0.5 text-[13px] text-mute">Annotate anything you're showing. Right-click undoes, <Kbd>1</Kbd>–<Kbd>6</Kbd> change color, <Kbd>C</Kbd> clears, <Kbd>Esc</Kbd> finishes.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button variant="primary" icon={Pencil} onClick={() => void api.runAction({ type: "tool", tool: "annotate" })}>
                      {tool === "annotate" ? "Stop drawing" : "Start drawing"}
                    </Button>
                    <Button icon={Eraser} onClick={() => void api.runAction({ type: "tool", tool: "clear_annotations" })}>Clear</Button>
                  </div>
                  <p className="mt-2 text-xs text-mute">
                    Shortcut: {eng?.tool_hotkeys_registered ? <Kbd>{eng.annotate_hotkey_label}</Kbd> : "unavailable (taken by another app)"}
                  </p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-accent"><Ruler size={17} aria-hidden /></span>
                <div className="flex-1">
                  <h3 className="font-semibold">Screen ruler</h3>
                  <p className="mt-0.5 text-[13px] text-mute">Drag a box over anything to read its size and diagonal in real screen pixels.</p>
                  <div className="mt-3">
                    <Button variant="primary" icon={Ruler} onClick={() => void api.runAction({ type: "tool", tool: "ruler" })}>
                      {tool === "ruler" ? "Stop measuring" : "Start measuring"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-mute">
                    Shortcut: {eng?.tool_hotkeys_registered ? <Kbd>{eng.ruler_hotkey_label}</Kbd> : "unavailable (taken by another app)"}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <SectionTitle>Presenting</SectionTitle>
          <div className="grid gap-3">
            <FeatureCard icon={PresentationIcon} title="Laser pointer" description="A bright dot that follows the mouse so everyone can see where you are."
              enabled={b.presentation.laser} onToggle={(v) => edit((x) => { x.presentation.laser = v; })}>
              <ColorField label="Laser color" value={b.presentation.color} onChange={(v) => edit((x) => { x.presentation.color = v; })} />
              <Slider label="Size" value={b.presentation.size} min={8} max={60} unit=" px" onChange={(v) => edit((x) => { x.presentation.size = v; })} />
            </FeatureCard>
            <FeatureCard icon={SunMedium} title="Screen highlighting" description="Dim everything except the area around the pointer. Also on the Cursor Effects page."
              enabled={b.effects.spotlight} onToggle={(v) => edit((x) => { x.effects.spotlight = v; })}>
              <Slider label="Spotlight radius" value={b.effects.spotlight_radius} min={80} max={600} unit=" px"
                onChange={(v) => edit((x) => { x.effects.spotlight_radius = v; })} />
              <Slider label="Dimming" value={b.effects.spotlight_dim} min={0} max={90} unit="%"
                onChange={(v) => edit((x) => { x.effects.spotlight_dim = v; })} />
            </FeatureCard>
            <FeatureCard icon={SunMedium} title="Click highlights" description="Show a ring on every click so viewers can follow along."
              enabled={b.effects.click_ripple} onToggle={(v) => edit((x) => { x.effects.click_ripple = v; })} />
          </div>
        </>
      )}
    </Page>
  );
}
