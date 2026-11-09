import { useEffect, useState } from "react";
import { Check, Copy, Plus, Trash2, UserCircle2, X } from "lucide-react";
import { Page } from "../components/Page";
import { Banner, Button, Card, Row, SectionTitle, Select, Switch, TextInput } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { slugify, uniqueId } from "../lib/profiles";
import type { Profile } from "../lib/types";
import { useApp } from "../state";

function AppChips({ profile, onChange }: { profile: Profile; onChange: (apps: string[]) => void }) {
  const { toast } = useApp();
  const [text, setText] = useState("");
  const [running, setRunning] = useState<string[] | null>(null);

  const add = (raw: string) => {
    const exe = raw.trim().toLowerCase();
    if (!exe) return;
    if (!/^[a-z0-9._ -]+\.exe$/.test(exe)) return toast("Use an executable name such as game.exe", "bad");
    if (!profile.apps.includes(exe)) onChange([...profile.apps, exe]);
    setText("");
  };
  const scan = async () => {
    try {
      setRunning(await api.runningApps());
    } catch (e) {
      toast(errorMessage(e), "bad");
    }
  };

  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-mute">Applies to</p>
      <div className="flex flex-wrap items-center gap-1.5">
        {profile.apps.length === 0 && <span className="text-[13px] text-mute">No applications yet. This profile never switches on by itself.</span>}
        {profile.apps.map((a) => (
          <span key={a} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised py-0.5 pl-2.5 pr-1 font-mono text-xs">
            {a}
            <button type="button" aria-label={`Remove ${a}`} onClick={() => onChange(profile.apps.filter((x) => x !== a))}
              className="rounded-full p-0.5 text-mute hover:bg-line hover:text-fg"><X size={11} /></button>
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <TextInput aria-label="Executable name" value={text} placeholder="game.exe" className="w-44 font-mono"
          onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(text); }} />
        <Button size="sm" icon={Plus} onClick={() => add(text)} disabled={!text.trim()}>Add</Button>
        <Button size="sm" onClick={() => void scan()}>Pick from running apps</Button>
        {running && (
          <Select label="Running apps" value="" onChange={(v) => { if (v) add(v); }}
            options={[{ id: "", label: "Choose…" }, ...running.map((r) => ({ id: r, label: r }))]} className="min-w-[180px]" />
        )}
      </div>
    </div>
  );
}

export function Profiles() {
  const { snapshot, patch, patchSettings, applyPreset, toast } = useApp();
  const [presets, setPresets] = useState<{ id: string; name: string; description: string }[] | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [name, setName] = useState("");

  const ready = snapshot !== null;
  useEffect(() => {
    if (!ready) return;
    api.presets().then(setPresets).catch((e) => toast(errorMessage(e), "bad"));
  }, [ready, toast]);

  return (
    <Page id="profiles">
      {() => {
        const s = snapshot!.settings;
        const effective = snapshot!.runtime.effective_profile;
        const create = (clone: boolean) => {
          const base = s.profiles.find((p) => p.id === s.active_profile)!;
          const label = name.trim() || (clone ? `${base.name} copy` : "New profile");
          const id = uniqueId(slugify(label), s.profiles.map((p) => p.id));
          const next: Profile = { id, name: label, apps: [], behavior: structuredClone(base.behavior) };
          void patch({ profiles: [...s.profiles, next], active_profile: id }).then((ok) => ok && setName(""));
        };
        return (
          <>
            <Card>
              <Row label="Switch profiles automatically" description="When an application listed in a profile has focus, that profile takes over. When it loses focus, your selected profile returns.">
                <Switch label="Switch profiles automatically" checked={s.auto_switch_profiles}
                  onChange={(v) => void patch({ auto_switch_profiles: v })} />
              </Row>
              {s.auto_switch_profiles && snapshot!.runtime.foreground.exe && (
                <p className="border-t border-line pt-3 text-[13px] text-mute">
                  Focused app: <span className="font-mono text-fg">{snapshot!.runtime.foreground.exe}</span>
                </p>
              )}
            </Card>

            <SectionTitle hint="the selected profile is the one you edit on every page">Your profiles</SectionTitle>
            <div className="grid gap-3">
              {s.profiles.map((p) => {
                const selected = p.id === s.active_profile;
                return (
                  <Card key={p.id} className={selected ? "border-accent/50" : ""}>
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" role="radio" aria-checked={selected} aria-label={`Select ${p.name}`}
                        onClick={() => void patch({ active_profile: p.id })}
                        className={`grid h-6 w-6 place-items-center rounded-full border-2 transition-colors ${selected ? "border-accent bg-accent text-accent-fg" : "border-line hover:border-mute"}`}>
                        {selected && <Check size={13} strokeWidth={3} aria-hidden />}
                      </button>
                      <UserCircle2 size={17} className="text-mute" aria-hidden />
                      {p.id === "default" ? (
                        <span className="font-semibold">{p.name}</span>
                      ) : (
                        <TextInput aria-label="Profile name" value={p.name} maxLength={40} className="w-56 font-semibold"
                          onChange={(e) => patchSettings((x) => { const t = x.profiles.find((q) => q.id === p.id); if (t) t.name = e.target.value; })} />
                      )}
                      {selected && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Editing</span>}
                      {effective === p.id && !selected && (
                        <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs font-medium text-ok">In use now</span>
                      )}
                      {p.id !== "default" && (
                        <Button size="sm" variant="danger" icon={Trash2} className="ml-auto" aria-label={`Delete ${p.name}`}
                          onClick={() => void patch({ profiles: s.profiles.filter((q) => q.id !== p.id) })} />
                      )}
                    </div>
                    {p.id !== "default" ? (
                      <AppChips profile={p}
                        onChange={(apps) => void patch({ profiles: s.profiles.map((q) => (q.id === p.id ? { ...q, apps } : q)) })} />
                    ) : (
                      <p className="mt-2 text-[13px] text-mute">Used whenever no other profile applies.</p>
                    )}
                  </Card>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <TextInput aria-label="New profile name" value={name} placeholder="Profile name" className="w-56"
                onChange={(e) => setName(e.target.value)} />
              <Button variant="primary" icon={Plus} disabled={s.profiles.length >= 24} onClick={() => create(false)}>New profile</Button>
              <Button icon={Copy} disabled={s.profiles.length >= 24} onClick={() => create(true)}>Duplicate selected</Button>
            </div>

            <SectionTitle hint="applied to the selected profile">Ready-made presets</SectionTitle>
            {confirm && (
              <Banner onDismiss={() => setConfirm(null)}>
                This replaces everything in the selected profile with the “{presets?.find((p) => p.id === confirm)?.name}” preset.{" "}
                <Button size="sm" variant="primary" className="ml-2"
                  onClick={() => { void applyPreset(confirm).then((ok) => ok && toast("Preset applied.", "ok")); setConfirm(null); }}>
                  Apply preset
                </Button>
              </Banner>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              {presets?.map((p) => (
                <Card key={p.id} className="!p-4">
                  <h3 className="font-semibold">{p.name}</h3>
                  <p className="mt-1 text-[13px] text-mute">{p.description}</p>
                  <div className="mt-3"><Button size="sm" onClick={() => setConfirm(p.id)}>Use this preset</Button></div>
                </Card>
              ))}
            </div>
          </>
        );
      }}
    </Page>
  );
}
