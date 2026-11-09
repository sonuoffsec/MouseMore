import { useState } from "react";
import { Activity as ActivityIcon, Gamepad2, Info, MonitorOff, Plus } from "lucide-react";
import { Page } from "../components/Page";
import { Banner, Button, Card, Row, SectionTitle, Select, Switch } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { quietBehavior, slugify, uniqueId } from "../lib/profiles";
import { useActivity } from "../lib/useActivity";
import { useApp } from "../state";
import { useNav } from "../nav";

export function Gaming() {
  const { snapshot, patch, toast, behavior } = useApp();
  const { go } = useNav();
  const activity = useActivity();
  const [apps, setApps] = useState<string[] | null>(null);
  const [pick, setPick] = useState("");

  const scan = async () => {
    try {
      const list = await api.runningApps();
      setApps(list);
      setPick(list[0] ?? "");
    } catch (e) {
      toast(errorMessage(e), "bad");
    }
  };

  const createProfile = async () => {
    if (!snapshot || !behavior || !pick) return;
    const profiles = structuredClone(snapshot.settings.profiles);
    const existing = profiles.find((p) => p.id !== "default" && p.apps.includes(pick));
    if (existing) return toast(`${pick} already belongs to the profile “${existing.name}”.`, "info");
    const id = uniqueId(slugify(pick), profiles.map((p) => p.id));
    profiles.push({ id, name: pick.replace(/\.exe$/i, ""), apps: [pick], behavior: quietBehavior(behavior) });
    if (await patch({ profiles, auto_switch_profiles: true })) {
      toast(`Created a quiet profile for ${pick}. It applies automatically while that app has focus.`, "ok");
    }
  };

  const live = snapshot?.settings.live_monitor ?? false;

  return (
    <Page id="gaming">
      {(b, edit) => (
        <>
          <Banner tone="info">
            Gaming mode here means <b>getting out of the way</b>: a per-game profile that turns effects, gestures and scroll changes off while the game has focus,
            and optionally gives your side buttons jobs. MouseMore does not change your mouse's hardware settings.
          </Banner>

          <SectionTitle>Per-game profiles</SectionTitle>
          <Card>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-accent"><Gamepad2 size={17} aria-hidden /></span>
              <div className="flex-1">
                <h3 className="font-semibold">Quiet profile for a game</h3>
                <p className="mt-0.5 text-[13px] text-mute">
                  Start the game, click Scan, pick it, and MouseMore creates a profile with everything switched off that applies whenever that game has focus.
                  Then fine-tune it on the <button type="button" className="text-accent underline" onClick={() => go("profiles")}>Profiles</button> page.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button onClick={() => void scan()}>Scan running apps</Button>
                  {apps && apps.length > 0 && (
                    <>
                      <Select label="Application" value={pick} onChange={setPick} options={apps.map((a) => ({ id: a, label: a }))} className="min-w-[220px]" />
                      <Button variant="primary" icon={Plus} onClick={() => void createProfile()}>Create profile</Button>
                    </>
                  )}
                  {apps && apps.length === 0 && <span className="text-sm text-mute">No windowed apps found.</span>}
                </div>
              </div>
            </div>
          </Card>

          <SectionTitle>Distractions</SectionTitle>
          <Card>
            <Row label={<span className="flex items-center gap-2"><MonitorOff size={15} aria-hidden /> Pause the overlay in full-screen apps</span>}
              description="Effects hide whenever a full-screen game or video is in front, in every profile that has this on.">
              <Switch label="Pause overlay in full-screen apps" checked={b.effects.disable_in_fullscreen}
                onChange={(v) => edit((x) => { x.effects.disable_in_fullscreen = v; })} />
            </Row>
            <Row label="Gaming shortcuts" description="Give the side buttons any action (push-to-talk key, quick-chat, volume…).">
              <Button onClick={() => go("customization")}>Open button remapping</Button>
            </Row>
          </Card>

          <SectionTitle>Mouse information</SectionTitle>
          <Card>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-raised text-accent"><ActivityIcon size={17} aria-hidden /></span>
              <div className="flex-1">
                <h3 className="font-semibold">Report-rate estimate</h3>
                <p className="mt-0.5 text-[13px] text-mute">
                  Turn on the live input monitor, then move the mouse quickly in circles for a couple of seconds. MouseMore shows the
                  highest rate of movement reports Windows delivered.
                </p>
                <div className="mt-3 flex items-center gap-4">
                  {live ? (
                    <p className="text-2xl font-semibold tabular-nums">
                      {activity?.rate_hz ? `≈ ${activity.rate_hz} Hz` : "Move the mouse…"}
                    </p>
                  ) : (
                    <Button variant="primary" onClick={() => void patch({ live_monitor: true })}>Start measuring</Button>
                  )}
                  {live && <Button onClick={() => void patch({ live_monitor: false })}>Stop</Button>}
                </div>
                <p className="mt-3 flex items-start gap-2 text-xs text-mute">
                  <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
                  This is an estimate of what the operating system delivered, not a hardware reading, and software cannot change a mouse's polling rate.
                </p>
              </div>
            </div>
          </Card>

          <SectionTitle>Not possible from software</SectionTitle>
          <Card>
            <h3 className="font-semibold">Hardware DPI switching</h3>
            <p className="mt-1 text-[13px] text-mute">
              Changing a mouse's DPI needs that manufacturer's own protocol and software; Windows has no standard way to do it, so MouseMore does not offer it.
              The <b>pointer speed</b> setting (Customization) gives a software alternative.
            </p>
          </Card>
        </>
      )}
    </Page>
  );
}
