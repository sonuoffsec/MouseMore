import { useState } from "react";
import {
  AppWindow, Clipboard, Columns2, Film, LayoutGrid, Layers, MonitorUp, Monitor, Play, Scissors, Search,
  type LucideIcon,
} from "lucide-react";
import { Page } from "../components/Page";
import { Banner, Button, Card, SectionTitle, StatusBadge } from "../components/ui";
import { api, errorMessage } from "../lib/api";
import type { FeatureStatus } from "../lib/catalog";
import type { Action } from "../lib/types";
import { useNav } from "../nav";
import { useApp } from "../state";

interface Tile {
  icon: LucideIcon; title: string; description: string; action: Action; status: FeatureStatus; note?: string;
}

const TILES: Tile[] = [
  { icon: Scissors, title: "Screenshot", description: "Starts the Snipping Tool region capture.", action: { type: "system", op: "screenshot" }, status: "working" },
  { icon: Columns2, title: "Snap window left", description: "Snap the active window to the left half.", action: { type: "window", op: "snap_left" }, status: "working" },
  { icon: Columns2, title: "Snap window right", description: "Snap the active window to the right half.", action: { type: "window", op: "snap_right" }, status: "working" },
  { icon: AppWindow, title: "Maximize / restore", description: "Toggle the active window's size.", action: { type: "window", op: "maximize_toggle" }, status: "working" },
  { icon: Layers, title: "Task view", description: "See all windows and virtual desktops.", action: { type: "system", op: "task_view" }, status: "working" },
  { icon: LayoutGrid, title: "Switch app", description: "Alt+Tab to the previous window.", action: { type: "system", op: "switch_app" }, status: "working" },
  { icon: Monitor, title: "Show desktop", description: "Minimize everything, or bring it back.", action: { type: "system", op: "show_desktop" }, status: "working" },
  { icon: MonitorUp, title: "Pointer to next monitor", description: "Jump the pointer to the centre of another display.", action: { type: "pointer_to_monitor", which: "next" }, status: "working" },
  { icon: Search, title: "Search selected text", description: "Copies your selection and searches the web for it.", action: { type: "search_selected", url: "https://www.google.com/search?q={q}" }, status: "working" },
  { icon: Clipboard, title: "Clipboard history", description: "Windows' own clipboard history panel.", action: { type: "system", op: "clipboard_history" }, status: "partial",
    note: "MouseMore keeps no clipboard history of its own, on purpose." },
  { icon: Film, title: "Screen recording", description: "Starts the Windows Game Bar recorder.", action: { type: "system", op: "screen_record" }, status: "partial",
    note: "Needs Game Bar enabled in Windows settings." },
];

export function Productivity() {
  const { toast } = useApp();
  const { go } = useNav();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (t: Tile) => {
    setBusy(t.title);
    try {
      // Search needs the user to have text selected in another window; give them time to switch back.
      if (t.action.type === "search_selected") {
        toast("Select some text in another window. Searching in 4 seconds…", "info");
        await new Promise((r) => setTimeout(r, 4000));
      }
      await api.runAction(t.action);
    } catch (e) {
      toast(errorMessage(e), "bad");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page id="productivity">
      {() => (
        <>
          <Banner tone="info">
            These are the productivity actions MouseMore can perform. <b>Run now</b> tries one. To use them day to day, assign
            them to a <button type="button" className="text-accent underline" onClick={() => go("gestures")}>gesture, radial menu or corner</button>{" "}
            or a <button type="button" className="text-accent underline" onClick={() => go("customization")}>mouse button</button>.
            The application launcher is the radial menu with "Open app, file or link" items.
          </Banner>
          <SectionTitle>Action library</SectionTitle>
          <div className="grid gap-3 md:grid-cols-2">
            {TILES.map((t) => (
              <Card key={t.title} className="!p-4">
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-raised text-accent">
                    <t.icon size={17} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{t.title}</h3>
                      {t.status !== "working" && <StatusBadge status={t.status} />}
                    </div>
                    <p className="mt-0.5 text-[13px] text-mute">{t.description}</p>
                    {t.note && <p className="mt-1 text-xs text-mute">{t.note}</p>}
                  </div>
                  <Button size="sm" icon={Play} disabled={busy !== null} onClick={() => void run(t)}>Run now</Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
