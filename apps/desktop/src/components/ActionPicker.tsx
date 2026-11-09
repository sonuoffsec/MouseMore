import { useState } from "react";
import { Play } from "lucide-react";
import { api, errorMessage } from "../lib/api";
import {
  ACTION_KINDS, SEARCH_ENGINES, SYSTEM_OPS, TOGGLES, TOOLS, WINDOW_OPS, comboProblem, defaultAction,
  type ActionKind,
} from "../lib/actions";
import type { Action, Button as Btn } from "../lib/types";
import { useApp } from "../state";
import { Button, Select, TextInput } from "./ui";

const KEY_IDEAS = [
  "ctrl+c", "ctrl+v", "ctrl+z", "ctrl+w", "ctrl+t", "ctrl+shift+t", "alt+left", "alt+right", "ctrl+tab",
  "ctrl+alt+tab", "win+d", "win+shift+s", "f5", "esc", "ctrl+plus", "ctrl+minus",
];

const CLICK_BUTTONS: { id: Btn; label: string }[] = [
  { id: "left", label: "Left" }, { id: "right", label: "Right" }, { id: "middle", label: "Middle" },
];

/** Edit any action: pick the kind, then its parameters. */
export function ActionPicker({
  value, onChange, allowDelay, compact, label = "Action",
}: {
  value: Action; onChange: (a: Action) => void; allowDelay?: boolean; compact?: boolean; label?: string;
}) {
  const { snapshot, plugins, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const macros = snapshot?.settings.macros ?? [];
  const enabledPlugins = plugins.filter((p) => !p.error && snapshot?.settings.plugins_enabled.includes(p.id));

  const kinds = ACTION_KINDS.filter((k) => (k.id === "macro" ? macros.length > 0 : k.id === "plugin" ? enabledPlugins.length > 0 : true));
  const kindOptions: { id: ActionKind; label: string }[] = allowDelay
    ? [...kinds, { id: "delay", label: "Wait…", group: "Automation" }]
    : kinds;

  const set = (kind: ActionKind) =>
    onChange(defaultAction(kind, { macroId: macros[0]?.id, plugin: enabledPlugins[0] }));

  const test = async () => {
    setBusy(true);
    try {
      await api.runAction(value);
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(false);
    }
  };

  const problem = value.type === "keys" ? comboProblem(value.combo) : null;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "py-1"}`}>
      <Select
        label={`${label} type`}
        value={value.type}
        onChange={(k) => set(k)}
        options={kindOptions}
        className="w-[230px]"
      />
      {value.type === "keys" && (
        <div className="flex flex-col">
          <TextInput
            aria-label="Key combination"
            list="mm-key-ideas"
            value={value.combo}
            onChange={(e) => onChange({ type: "keys", combo: e.target.value })}
            className={`w-[190px] font-mono ${problem ? "!border-bad" : ""}`}
            placeholder="ctrl+shift+t"
          />
          <datalist id="mm-key-ideas">{KEY_IDEAS.map((k) => <option key={k} value={k} />)}</datalist>
          {problem && <span className="mt-1 text-xs text-bad">{problem}</span>}
        </div>
      )}
      {value.type === "launch" && (
        <>
          <TextInput aria-label="Program, file or link" value={value.target}
            onChange={(e) => onChange({ ...value, target: e.target.value })} className="w-[220px]" placeholder="notepad.exe or https://…" />
          <TextInput aria-label="Arguments" value={value.args}
            onChange={(e) => onChange({ ...value, args: e.target.value })} className="w-[150px]" placeholder="arguments (optional)" />
        </>
      )}
      {value.type === "window" && (
        <Select label="Window action" value={value.op} onChange={(op) => onChange({ type: "window", op })} options={WINDOW_OPS} />
      )}
      {value.type === "system" && (
        <Select label="System shortcut" value={value.op} onChange={(op) => onChange({ type: "system", op })} options={SYSTEM_OPS} />
      )}
      {value.type === "search_selected" && (
        <Select label="Search engine" value={value.url} onChange={(url) => onChange({ type: "search_selected", url })}
          options={SEARCH_ENGINES.map((e) => ({ id: e.url, label: e.label }))} />
      )}
      {value.type === "pointer_to_monitor" && (
        <Select label="Direction" value={value.which} onChange={(which) => onChange({ type: "pointer_to_monitor", which })}
          options={[{ id: "next", label: "Next monitor" }, { id: "prev", label: "Previous monitor" }]} />
      )}
      {value.type === "mouse_click" && (
        <>
          <Select label="Mouse button" value={value.button} onChange={(button) => onChange({ ...value, button })} options={CLICK_BUTTONS} />
          <label className="flex items-center gap-2 text-sm text-mute">
            <input type="checkbox" checked={value.double} onChange={(e) => onChange({ ...value, double: e.target.checked })}
              className="h-4 w-4 accent-[var(--color-accent)]" />
            Double
          </label>
        </>
      )}
      {value.type === "tool" && (
        <Select label="Tool" value={value.tool} onChange={(tool) => onChange({ type: "tool", tool })} options={TOOLS} />
      )}
      {value.type === "toggle" && (
        <Select label="Switch" value={value.what} onChange={(what) => onChange({ type: "toggle", what })} options={TOGGLES} />
      )}
      {value.type === "macro" && (
        <Select label="Macro" value={value.id} onChange={(id) => onChange({ type: "macro", id })}
          options={macros.map((m) => ({ id: m.id, label: m.name || m.id }))} />
      )}
      {value.type === "plugin" && (
        <Select label="Plugin action" value={`${value.plugin}/${value.action}`}
          onChange={(v) => { const [plugin = "", action = ""] = v.split("/"); onChange({ type: "plugin", plugin, action }); }}
          options={enabledPlugins.flatMap((p) => p.actions.map((a) => ({ id: `${p.id}/${a.id}`, label: `${p.name}: ${a.label}` })))} />
      )}
      {value.type === "delay" && (
        <div className="flex items-center gap-2">
          <TextInput aria-label="Milliseconds" type="number" min={0} max={10000} step={50} value={value.ms}
            onChange={(e) => onChange({ type: "delay", ms: Math.max(0, Math.min(10000, Number(e.target.value) || 0)) })} className="w-[100px]" />
          <span className="text-sm text-mute">ms</span>
        </div>
      )}
      {value.type !== "none" && value.type !== "delay" && (
        <Button size="sm" variant="ghost" icon={Play} onClick={() => void test()} disabled={busy || !!problem} title="Run this action now">
          Test
        </Button>
      )}
    </div>
  );
}
