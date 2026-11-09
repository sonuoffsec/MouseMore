import { ArrowDown, ArrowUp, OctagonX, Play, Plus, Trash2, Workflow } from "lucide-react";
import { ActionPicker } from "../components/ActionPicker";
import { Page } from "../components/Page";
import { Banner, Button, Card, Empty, Kbd, SectionTitle, TextInput } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import { slugify, uniqueId } from "../lib/profiles";
import type { Action, Macro } from "../lib/types";
import { useApp } from "../state";

export function Automation() {
  const { snapshot, patchSettings, patch, toast } = useApp();
  const macros = snapshot?.settings.macros ?? [];

  const save = (next: Macro[]) => void patch({ macros: next });
  const update = (i: number, fn: (m: Macro) => void) =>
    patchSettings((s) => {
      const m = s.macros[i];
      if (m) fn(m);
    });

  const add = () => {
    const name = `Macro ${macros.length + 1}`;
    save([...macros, { id: uniqueId(slugify(name), macros.map((m) => m.id)), name, steps: [{ type: "keys", combo: "ctrl+c" }] }]);
  };

  const run = async (m: Macro) => {
    try {
      await api.runAction({ type: "macro", id: m.id });
    } catch (e) {
      toast(errorMessage(e), "bad");
    }
  };

  return (
    <Page id="automation">
      {() => (
        <>
          <Card className="border-bad/30">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-bad/10 text-bad"><OctagonX size={18} aria-hidden /></span>
                <div>
                  <h3 className="font-semibold">Emergency stop</h3>
                  <p className="text-[13px] text-mute">
                    Press <Kbd>{snapshot?.engine.hotkey_label ?? "Ctrl+Alt+Shift+M"}</Kbd> anywhere to switch MouseMore off and halt every running macro.
                    {snapshot?.engine.hotkey_registered === false && <span className="text-bad"> (unavailable: another app holds this shortcut)</span>}
                  </p>
                </div>
              </div>
              <Button variant="danger" onClick={() => void api.stopMacros()}>Stop all macros now</Button>
            </div>
          </Card>

          <SectionTitle hint="every step is visible; nothing runs unless you bind or run it">Macros</SectionTitle>
          <Banner tone="info">
            A macro is a reusable list of actions. Bind it to a gesture, button or corner with the action <b>Run macro</b>. Macros nest up to three levels deep and
            only ever do what is listed here.
          </Banner>
          <div className="grid gap-3">
            {macros.length === 0 && <Empty>No macros yet.</Empty>}
            {macros.map((m, i) => (
              <Card key={m.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Workflow size={16} className="text-accent" aria-hidden />
                  <TextInput aria-label="Macro name" value={m.name} maxLength={40} className="w-56 font-medium"
                    onChange={(e) => update(i, (x) => { x.name = e.target.value; })} />
                  <span className="font-mono text-xs text-mute">{m.id}</span>
                  <div className="ml-auto flex gap-2">
                    <Button size="sm" icon={Play} onClick={() => void run(m)}>Run</Button>
                    <Button size="sm" variant="danger" icon={Trash2} aria-label={`Delete ${m.name}`}
                      onClick={() => save(macros.filter((_, k) => k !== i))} />
                  </div>
                </div>
                <ol className="mt-3 space-y-1">
                  {m.steps.map((s, k) => (
                    <li key={k} className="flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-1.5">
                      <span className="w-5 text-center font-mono text-xs text-mute">{k + 1}</span>
                      <div className="min-w-0 flex-1">
                        <ActionPicker value={s} allowDelay compact label={`Step ${k + 1}`}
                          onChange={(a: Action) => update(i, (x) => { x.steps[k] = a; })} />
                      </div>
                      <Button size="sm" variant="ghost" icon={ArrowUp} aria-label="Move up" disabled={k === 0}
                        onClick={() => update(i, (x) => { const [t] = x.steps.splice(k, 1); if (t) x.steps.splice(k - 1, 0, t); })} />
                      <Button size="sm" variant="ghost" icon={ArrowDown} aria-label="Move down" disabled={k === m.steps.length - 1}
                        onClick={() => update(i, (x) => { const [t] = x.steps.splice(k, 1); if (t) x.steps.splice(k + 1, 0, t); })} />
                      <Button size="sm" variant="ghost" icon={Trash2} aria-label="Remove step"
                        onClick={() => update(i, (x) => { x.steps.splice(k, 1); })} />
                    </li>
                  ))}
                </ol>
                <div className="mt-3">
                  <Button size="sm" icon={Plus} disabled={m.steps.length >= 50}
                    onClick={() => update(i, (x) => { x.steps.push({ type: "delay", ms: 300 }); })}>
                    Add step
                  </Button>
                </div>
              </Card>
            ))}
          </div>
          <div className="mt-3">
            <Button variant="primary" icon={Plus} disabled={macros.length >= 32} onClick={add}>New macro</Button>
          </div>

          <SectionTitle>Per-application automation</SectionTitle>
          <Card>
            <p className="text-[13px] text-mute">
              Gestures, buttons, corners and macros all live inside a profile, and a profile can apply only to chosen applications.
              Create one on the Profiles page, switch to it, and its bindings will fire only while those apps have focus.
            </p>
          </Card>
        </>
      )}
    </Page>
  );
}
