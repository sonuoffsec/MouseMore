import { useState } from "react";
import { FolderOpen, Puzzle, RefreshCw, Settings2, ShieldCheck } from "lucide-react";
import { Banner, Button, Card, Empty, Kbd, PageHeader, Row, SectionTitle, Segmented, Switch } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { looksLikeSettingsJson } from "../lib/format";
import type { ImportPreview, Theme } from "../lib/types";
import { useApp } from "../state";

const THEMES: { id: Theme; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "system", label: "System" },
];

export function Settings() {
  const { snapshot, plugins, patch, reset, importJson, refreshPlugins, toast } = useApp();
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  if (!snapshot) return <PageHeader title="Settings" subtitle="Preferences and privacy" icon={Settings2} />;
  const { settings, platform, engine } = snapshot;

  const doExport = async () => {
    try {
      setText(await api.exportSettings());
      setPreview(null);
      toast("Exported below. Copy it somewhere safe.", "ok");
    } catch (e) {
      toast(errorMessage(e), "bad");
    }
  };

  // Importing never applies silently: the user first sees every program or link the file could open.
  const inspect = async () => {
    const problem = looksLikeSettingsJson(text);
    if (problem) return toast(problem, "bad");
    try {
      setPreview(await api.inspectImport(text));
    } catch (e) {
      toast(errorMessage(e), "bad");
    }
  };
  const apply = async () => {
    if (await importJson(text)) {
      toast("Settings imported.", "ok");
      setPreview(null);
    }
  };

  const toggleGeneral = (k: "close_to_tray" | "start_with_windows" | "start_hidden", v: boolean) =>
    void patch({ general: { ...settings.general, [k]: v } });

  const togglePlugin = (id: string, on: boolean) =>
    void patch({ plugins_enabled: on ? [...settings.plugins_enabled, id] : settings.plugins_enabled.filter((x) => x !== id) });

  return (
    <>
      <PageHeader title="Settings" subtitle="Preferences and privacy" icon={Settings2} />

      <SectionTitle>Appearance</SectionTitle>
      <Card>
        <Row label="Theme">
          <Segmented label="Theme" value={settings.theme} options={THEMES} onChange={(v) => void patch({ theme: v })} />
        </Row>
        <Row label="Reduce motion" description="Fewer animations in the app and on the overlay (no particle bursts).">
          <Switch label="Reduce motion" checked={settings.reduce_motion} onChange={(v) => void patch({ reduce_motion: v })} />
        </Row>
      </Card>

      <SectionTitle>Startup and window</SectionTitle>
      <Card>
        <Row label="Keep running in the tray when the window is closed" description="Closing the window hides it; use the tray icon to reopen or quit. If off, closing quits MouseMore.">
          <Switch label="Close to tray" checked={settings.general.close_to_tray} onChange={(v) => toggleGeneral("close_to_tray", v)} />
        </Row>
        <Row label="Start with Windows" description="Adds a per-user startup entry (no administrator rights). Off by default; turning it off removes the entry.">
          <Switch label="Start with Windows" checked={settings.general.start_with_windows} onChange={(v) => toggleGeneral("start_with_windows", v)} />
        </Row>
        <Row label="Start hidden in the tray" description="Don't open the window at launch.">
          <Switch label="Start hidden" checked={settings.general.start_hidden} onChange={(v) => toggleGeneral("start_hidden", v)} />
        </Row>
      </Card>

      <SectionTitle hint="shortcuts work from any app">Shortcuts</SectionTitle>
      <Card>
        <ul className="divide-y divide-line">
          <li className="flex items-center justify-between py-2.5"><span>Emergency stop: switch MouseMore off, halt macros</span><Kbd>{engine.hotkey_label}</Kbd></li>
          <li className="flex items-center justify-between py-2.5"><span>Draw on screen</span><Kbd>{engine.annotate_hotkey_label}</Kbd></li>
          <li className="flex items-center justify-between py-2.5"><span>Screen ruler</span><Kbd>{engine.ruler_hotkey_label}</Kbd></li>
        </ul>
        {(!engine.hotkey_registered || !engine.tool_hotkeys_registered) && (
          <p className="mt-2 text-xs text-warn">One or more shortcuts are in use by another app and could not be registered. The tray menu and in-app switches still work.</p>
        )}
      </Card>

      <SectionTitle hint="optional">Plugins</SectionTitle>
      <Card>
        <p className="mb-3 text-[13px] text-mute">
          A plugin adds extra actions you can bind to a gesture or button. It never runs by itself, and it can only open files inside its own folder or an https link.
          Only enable plugins you trust.
        </p>
        {plugins.length === 0 ? (
          <Empty>No plugins installed. Put a folder with a <span className="font-mono">plugin.json</span> into the plugins folder, then rescan.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {plugins.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium"><Puzzle size={14} aria-hidden /> {p.name} <span className="font-mono text-xs text-mute">{p.version}</span></p>
                  {p.description && <p className="text-[13px] text-mute">{p.description}</p>}
                  {p.error ? <p className="mt-1 text-xs text-bad">{p.error}</p>
                    : <p className="mt-1 text-xs text-mute">Actions: {p.actions.map((a) => a.label).join(", ") || "none"}</p>}
                </div>
                <Switch label={`Enable ${p.name}`} checked={settings.plugins_enabled.includes(p.id)} disabled={!!p.error}
                  onChange={(v) => togglePlugin(p.id, v)} />
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex gap-2">
          <Button size="sm" icon={RefreshCw} onClick={() => void refreshPlugins()}>Rescan</Button>
          <Button size="sm" icon={FolderOpen} onClick={() => void api.openConfigFolder().catch((e) => toast(errorMessage(e), "bad"))}>Open settings folder</Button>
        </div>
        <p className="mt-2 break-all font-mono text-[11px] text-mute">{platform.plugin_dir}</p>
      </Card>

      <SectionTitle>Backup and restore</SectionTitle>
      <Card>
        <p className="mb-3 text-[13px] text-mute">Export all settings as JSON, or paste a previous export and import it.</p>
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setPreview(null); }}
          spellCheck={false}
          aria-label="Settings JSON"
          rows={7}
          className="mm-input w-full rounded-xl border border-line bg-bg p-3 font-mono text-xs"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={() => void doExport()}>Export</Button>
          <Button variant="primary" onClick={() => void inspect()}>Review import…</Button>
          {!confirmReset ? (
            <Button variant="danger" onClick={() => setConfirmReset(true)}>Reset to defaults…</Button>
          ) : (
            <>
              <Button variant="danger" onClick={() => { void reset().then((ok) => ok && toast("Settings reset.", "ok")); setConfirmReset(false); }}>Confirm reset</Button>
              <Button onClick={() => setConfirmReset(false)}>Cancel</Button>
            </>
          )}
        </div>
        {preview && (
          <div className="mt-4">
            <Banner tone={preview.launch_targets.length ? "warn" : "info"}>
              <p className="font-medium">This file contains {preview.profiles} profile(s) and {preview.macros} macro(s).</p>
              {preview.launch_targets.length > 0 ? (
                <>
                  <p className="mt-1">It can open these programs or links when you trigger it. Only import files you trust:</p>
                  <ul className="mt-1 list-disc pl-5 font-mono text-xs">
                    {preview.launch_targets.map((t) => <li key={t} className="break-all">{t}</li>)}
                  </ul>
                </>
              ) : <p className="mt-1">It does not launch any programs.</p>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" variant="primary" onClick={() => void apply()}>Import and replace my settings</Button>
                <Button size="sm" onClick={() => setPreview(null)}>Cancel</Button>
              </div>
            </Banner>
          </div>
        )}
      </Card>

      <SectionTitle>Privacy and storage</SectionTitle>
      <Card>
        <p className="flex items-center gap-2 font-medium"><ShieldCheck size={16} className="text-ok" aria-hidden /> Local only</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-mute">
          <li>No telemetry, no account, no network access. Settings never leave this computer.</li>
          <li>The mouse hook is only installed while a feature that needs it is on; the overlay window only exists on screen while something is drawn.</li>
          <li>Your Windows pointer speed and double-click time are restored when you disable MouseMore or quit.</li>
        </ul>
        <dl className="mt-4 grid gap-1.5 text-sm">
          <div><dt className="inline text-mute">Edition: </dt><dd className="inline">{platform.portable ? "Portable" : "Installed"}</dd></div>
          <div><dt className="inline text-mute">Settings file: </dt><dd className="inline break-all font-mono text-xs">{platform.config_path}</dd></div>
          <div><dt className="inline text-mute">Version: </dt><dd className="inline">{platform.app_version}</dd></div>
        </dl>
      </Card>
    </>
  );
}
