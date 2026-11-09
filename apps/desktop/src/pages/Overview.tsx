import { useEffect, useState } from "react";
import { Activity as Pulse, Cpu, Layers3, Power, Rocket, ShieldCheck, UserCircle2 } from "lucide-react";
import { Banner, Button, Card, SectionTitle, StatusBadge, Switch } from "../components/ui";
import { SECTIONS, countByStatus, type SectionId } from "../lib/catalog";
import { api } from "../lib/api";
import { deviceTitle, pluralize } from "../lib/format";
import { useActivity } from "../lib/useActivity";
import type { PresetInfo } from "../lib/types";
import { useNav } from "../nav";
import { useApp } from "../state";

function resolveRecent(id: string): { label: string; section: SectionId } | null {
  const sec = SECTIONS.find((s) => s.id === id);
  if (sec) return { label: sec.name, section: sec.id };
  for (const s of SECTIONS) {
    const f = s.features.find((f) => f.id === id);
    if (f) return { label: f.name, section: s.id };
  }
  return null;
}

function Tile({ icon: Icon, label, value, sub }: { icon: typeof Cpu; label: string; value: string; sub?: string }) {
  return (
    <Card className="!p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-mute">
        <Icon size={13} aria-hidden /> {label}
      </div>
      <p className="mt-2 truncate text-base font-semibold" title={value}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-mute" title={sub}>{sub}</p>}
    </Card>
  );
}

function LiveMonitor() {
  const a = useActivity();
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Live input</h2>
        <span className="flex items-center gap-1.5 text-xs text-ok"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" /> hook active</span>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          ["Position", a ? `${a.x}, ${a.y}` : "move the mouse"],
          ["Moves", a?.moves ?? 0],
          ["Clicks", a?.clicks ?? 0],
          ["Wheel ticks", a?.wheel ?? 0],
          ["Report rate", a?.rate_hz ? `≈ ${a.rate_hz} Hz` : "—"],
        ].map(([k, v]) => (
          <div key={String(k)}>
            <dt className="text-xs text-mute">{k}</dt>
            <dd className="font-mono text-base tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-mute">
        Last event: <span className="font-mono text-fg">{a?.kind ?? "—"}</span>. Shown on screen only; nothing is stored or sent. The report rate is an estimate of what Windows delivered.
      </p>
    </Card>
  );
}

export function Overview() {
  const { snapshot, devices, capabilities, patch, error, native, applyPreset, toast } = useApp();
  const { go } = useNav();
  const [presets, setPresets] = useState<PresetInfo[]>([]);
  const ready = snapshot !== null;
  useEffect(() => {
    if (ready) api.presets().then(setPresets).catch(() => {});
  }, [ready]);

  if (!snapshot) {
    return (
      <>
        <h1 className="mb-6 text-[28px] font-semibold tracking-tight">MouseMore</h1>
        {!native ? (
          <Banner tone="bad">The native engine is not running. This is only the interface; open the MouseMore desktop app to use it.</Banner>
        ) : (
          <Banner tone="bad">{error ?? "Waiting for the native engine…"}</Banner>
        )}
      </>
    );
  }

  const { settings, engine, runtime } = snapshot;
  const primary = devices?.devices[0];
  const counts = countByStatus();
  const total = counts.working + counts.partial;
  const recents = settings.recent_features.map(resolveRecent).filter((r) => r !== null);
  const profileName = settings.profiles.find((p) => p.id === runtime.effective_profile)?.name ?? "Default";
  const nothingOn = !runtime.hook_wanted && !settings.live_monitor;

  const remember = (id: string) =>
    void patch({ recent_features: [id, ...settings.recent_features.filter((x) => x !== id)] });
  const flag = (name: "effects" | "gestures" | "precision") => void api.toggleRuntime(name);

  return (
    <>
      <Card className="relative overflow-hidden !p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Universal mouse toolkit</p>
            <h1 className="mt-1 text-[34px] font-semibold leading-tight tracking-tight">Your mouse can do more.</h1>
            <p className="mt-1 text-mute">One mouse. Endless possibilities.</p>
          </div>
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-bg/60 px-5 py-4 backdrop-blur">
            <div className="text-right">
              <p className="font-semibold">{settings.global_enabled ? "MouseMore is on" : "MouseMore is off"}</p>
              <p className="text-xs text-mute">
                Emergency stop <span className="font-mono">{engine.hotkey_label}</span>
              </p>
            </div>
            <Switch label="MouseMore enabled" checked={settings.global_enabled}
              onChange={(v) => { void patch({ global_enabled: v }); remember("global-switch"); }} />
          </div>
        </div>
      </Card>

      <div className="mt-4">
        {!settings.global_enabled && (
          <Banner>MouseMore is globally disabled: no hooks, no overlay, no automation. Your Windows pointer settings are back to normal.</Banner>
        )}
        {engine.hook_error && <Banner tone="bad">{engine.hook_error}</Banner>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile icon={Cpu} label="Mouse"
          value={primary ? deviceTitle(primary, 0) : devices ? "None found" : "Detecting…"}
          sub={primary ? `${primary.connection ?? "Unknown connection"} · ${pluralize(primary.buttons, "button")}` : undefined} />
        <Tile icon={UserCircle2} label="Profile" value={profileName}
          sub={runtime.effective_profile !== settings.active_profile ? `auto for ${runtime.foreground.exe ?? "app"}` : "selected"} />
        <Tile icon={Pulse} label="Input hook" value={engine.hook_installed ? "Active" : "Idle"}
          sub={engine.hook_installed ? "a feature is using it" : "nothing needs it"} />
        <Tile icon={Layers3} label="Features" value={`${total} available`} sub={`${counts.planned} planned · ${counts.unsupported} not possible`} />
      </div>

      {nothingOn && settings.global_enabled && presets.length > 0 && (
        <>
          <SectionTitle hint="applies to your current profile">Start here</SectionTitle>
          <Card>
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent"><Rocket size={17} aria-hidden /></span>
              <div className="flex-1">
                <p className="font-semibold">Nothing is switched on yet</p>
                <p className="mt-0.5 text-[13px] text-mute">Try a preset to see what MouseMore does, then tune it on any page. You can undo it by choosing Minimal.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.filter((p) => ["showcase", "productivity", "accessibility", "presenter"].includes(p.id)).map((p) => (
                    <Button key={p.id} title={p.description}
                      onClick={() => void applyPreset(p.id).then((ok) => ok && toast(`${p.name} preset applied.`, "ok"))}>
                      {p.name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      <SectionTitle>Quick controls</SectionTitle>
      <Card>
        <ul className="divide-y divide-line">
          <li className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="flex items-center gap-2 font-medium"><Power size={14} aria-hidden /> Live input monitor</p>
              <p className="text-[13px] text-mute">Show pointer position, clicks and an estimated report rate here. Installs a mouse hook while on.</p>
            </div>
            <Switch label="Live input monitor" checked={settings.live_monitor} disabled={!settings.global_enabled}
              onChange={(v) => { void patch({ live_monitor: v }); remember("live-monitor"); }} />
          </li>
          <li className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-medium">Pause cursor effects</p>
              <p className="text-[13px] text-mute">Until you turn it off or restart; doesn't change your saved settings.</p>
            </div>
            <Switch label="Pause cursor effects" checked={runtime.flags.effects_off} onChange={() => flag("effects")} />
          </li>
          <li className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-medium">Pause gestures and triggers</p>
              <p className="text-[13px] text-mute">Gestures, radial menu and corners stop; held buttons act normally again.</p>
            </div>
            <Switch label="Pause gestures and triggers" checked={runtime.flags.gestures_off} onChange={() => flag("gestures")} />
          </li>
          <li className="flex items-center justify-between gap-4 py-3">
            <div>
              <p className="font-medium">Precision mode</p>
              <p className="text-[13px] text-mute">Slow the pointer for fine work.</p>
            </div>
            <Switch label="Precision mode" checked={runtime.flags.precision} onChange={() => flag("precision")} />
          </li>
        </ul>
      </Card>

      {settings.live_monitor && engine.hook_installed && <div className="mt-4"><LiveMonitor /></div>}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Recently used</h2>
          {recents.length === 0 ? (
            <p className="text-[13px] text-mute">Nothing yet. Pages you open will show up here.</p>
          ) : (
            <ul className="space-y-1.5">
              {recents.map((r) => (
                <li key={r.label}>
                  <button type="button" onClick={() => go(r.section)} className="text-accent hover:underline">{r.label}</button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 flex items-center gap-2 font-semibold"><ShieldCheck size={15} aria-hidden /> System capabilities</h2>
          {!capabilities ? (
            <p className="text-[13px] text-mute">Probing…</p>
          ) : (
            <ul className="space-y-2">
              {capabilities.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 text-[13px]">
                  <span>{c.name}</span>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => go("devices")} className="mt-3 text-[13px] text-accent hover:underline">
            All details on the Devices page
          </button>
        </Card>
      </div>
    </>
  );
}
