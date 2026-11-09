import { Circle, MousePointerClick, PartyPopper, Sparkle, SunMedium, Waves } from "lucide-react";
import { FxPreview } from "../components/FxPreview";
import { Page } from "../components/Page";
import { Banner, Card, ColorField, FeatureCard, Row, SectionTitle, Segmented, Slider, Switch } from "../components/ui";
import { useApp } from "../state";

export function CursorEffects() {
  const { snapshot } = useApp();
  const reduce = snapshot?.settings.reduce_motion ?? false;
  return (
    <Page id="cursor-effects">
      {(b, edit) => {
        const e = b.effects;
        return (
          <>
            {!snapshot?.runtime.overlay_visible && !e.trail && !e.click_ripple && !e.click_burst && !e.glow && !e.spotlight && (
              <Banner tone="info">
                Turn an effect on below. MouseMore only shows its transparent overlay while something needs it, so an idle MouseMore draws nothing on screen.
              </Banner>
            )}
            {snapshot?.runtime.flags.effects_off && (
              <Banner>Effects are paused for this session (from a trigger or the Overview). Resume them from the Overview.</Banner>
            )}
            <FxPreview effects={e} accessibility={b.accessibility} presentation={b.presentation} reduceMotion={reduce} />

            <SectionTitle>Effects</SectionTitle>
            <div className="grid gap-3">
              <FeatureCard icon={Waves} title="Mouse trail" description="A fading trail that follows the pointer."
                enabled={e.trail} onToggle={(v) => edit((x) => { x.effects.trail = v; })}>
                <Slider label="Trail length" value={e.trail_length} min={5} max={60} unit=" points"
                  onChange={(v) => edit((x) => { x.effects.trail_length = v; })} />
              </FeatureCard>
              <FeatureCard icon={Circle} title="Click ripple" description="A ring expands from every click."
                enabled={e.click_ripple} onToggle={(v) => edit((x) => { x.effects.click_ripple = v; })} />
              <FeatureCard icon={PartyPopper} title="Click burst" description="Particles fly out from every click."
                enabled={e.click_burst} onToggle={(v) => edit((x) => { x.effects.click_burst = v; })}
                note={reduce ? "Particles are off while “Reduce motion” is on." : undefined} />
              <FeatureCard icon={Sparkle} title="Cursor glow" description="A soft halo around the pointer."
                enabled={e.glow} onToggle={(v) => edit((x) => { x.effects.glow = v; })}>
                <Slider label="Glow size" value={e.glow_size} min={20} max={200} unit=" px"
                  onChange={(v) => edit((x) => { x.effects.glow_size = v; })} />
              </FeatureCard>
              <FeatureCard icon={SunMedium} title="Spotlight" description="Dim the screen except around the pointer. Great for demos."
                enabled={e.spotlight} onToggle={(v) => edit((x) => { x.effects.spotlight = v; })}>
                <Slider label="Spotlight radius" value={e.spotlight_radius} min={80} max={600} unit=" px"
                  onChange={(v) => edit((x) => { x.effects.spotlight_radius = v; })} />
                <Slider label="Dimming" value={e.spotlight_dim} min={0} max={90} unit="%"
                  onChange={(v) => edit((x) => { x.effects.spotlight_dim = v; })} />
              </FeatureCard>
            </div>

            <SectionTitle>Style</SectionTitle>
            <Card>
              <ColorField label="Effect color" value={e.color} onChange={(v) => edit((x) => { x.effects.color = v; })} />
              <Row label="Color mode" description="Rainbow cycles through hues over time.">
                <Segmented label="Color mode" value={e.color_mode}
                  onChange={(v) => edit((x) => { x.effects.color_mode = v; })}
                  options={[{ id: "solid", label: "Solid" }, { id: "rainbow", label: "Rainbow" }]} />
              </Row>
              <Slider label="Intensity" value={e.intensity} min={10} max={100} unit="%"
                onChange={(v) => edit((x) => { x.effects.intensity = v; })} />
              <Slider label="Animation speed" value={e.speed} min={25} max={200} unit="%"
                onChange={(v) => edit((x) => { x.effects.speed = v; })} />
              <Row label="Pause in full-screen apps" description="Hide the overlay while a game or video is full screen, so it never gets in the way.">
                <Switch label="Pause in full-screen apps" checked={e.disable_in_fullscreen}
                  onChange={(v) => edit((x) => { x.effects.disable_in_fullscreen = v; })} />
              </Row>
            </Card>

            <p className="mt-4 flex items-center gap-2 text-xs text-mute">
              <MousePointerClick size={13} aria-hidden /> Effects are drawn on an overlay. They do not change the real system cursor image.
            </p>
          </>
        );
      }}
    </Page>
  );
}
