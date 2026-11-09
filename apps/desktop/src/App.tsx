/** App shell: grouped sidebar, top bar (profile switcher, master switch) and the page map. */

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { GROUPS, SECTIONS, type SectionId } from "./lib/catalog";
import { NavCtx } from "./nav";
import { AppProvider, useApp } from "./state";
import { Banner, Select, Switch, Toasts } from "./components/ui";
import { Overview } from "./pages/Overview";
import { CursorEffects } from "./pages/CursorEffects";
import { Gestures } from "./pages/Gestures";
import { Productivity } from "./pages/Productivity";
import { Customization } from "./pages/Customization";
import { Creative } from "./pages/Creative";
import { AccessibilityPage } from "./pages/Accessibility";
import { Gaming } from "./pages/Gaming";
import { Automation } from "./pages/Automation";
import { Devices } from "./pages/Devices";
import { Profiles } from "./pages/Profiles";
import { Settings } from "./pages/Settings";

const PAGES: Record<SectionId, () => ReactNode> = {
  overview: () => <Overview />,
  "cursor-effects": () => <CursorEffects />,
  gestures: () => <Gestures />,
  productivity: () => <Productivity />,
  customization: () => <Customization />,
  creative: () => <Creative />,
  accessibility: () => <AccessibilityPage />,
  gaming: () => <Gaming />,
  automation: () => <Automation />,
  devices: () => <Devices />,
  profiles: () => <Profiles />,
  settings: () => <Settings />,
};

function TopBar() {
  const { snapshot, patch } = useApp();
  if (!snapshot) return <div className="h-14 border-b border-line" />;
  const { settings, runtime, engine } = snapshot;
  const auto = runtime.effective_profile !== settings.active_profile;
  const autoName = settings.profiles.find((p) => p.id === runtime.effective_profile)?.name;
  return (
    <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-line bg-bg/80 px-8 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-xs font-medium uppercase tracking-wide text-mute">Profile</span>
        <Select label="Active profile" value={settings.active_profile}
          options={settings.profiles.map((p) => ({ id: p.id, label: p.name }))}
          onChange={(v) => void patch({ active_profile: v })} className="!py-1.5" />
        {auto && (
          <span className="truncate rounded-full bg-ok/15 px-2.5 py-1 text-xs font-medium text-ok" title={runtime.foreground.exe ?? ""}>
            Using “{autoName}” for {runtime.foreground.exe}
          </span>
        )}
        {runtime.tool && <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">Tool active: {runtime.tool}</span>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="hidden text-xs text-mute md:inline">
          {settings.global_enabled ? (engine.hook_installed ? "Hook active" : "On") : "Off"}
        </span>
        <Switch label="MouseMore enabled" checked={settings.global_enabled} onChange={(v) => void patch({ global_enabled: v })} />
      </div>
    </div>
  );
}

function Shell() {
  const { snapshot, patch, error, clearError, dismissNotice } = useApp();
  const [current, setCurrent] = useState<SectionId>("overview");

  const go = useCallback(
    (id: SectionId) => {
      setCurrent(id);
      if (snapshot && id !== "overview") {
        const recent = [id, ...snapshot.settings.recent_features.filter((x) => x !== id)];
        void patch({ recent_features: recent });
      }
    },
    [snapshot, patch],
  );
  const nav = useMemo(() => ({ current, go }), [current, go]);
  const enabled = snapshot?.settings.global_enabled ?? false;

  return (
    <NavCtx.Provider value={nav}>
      <MotionConfig reducedMotion={snapshot?.settings.reduce_motion ? "always" : "user"}>
        <div className="flex h-full">
          <nav aria-label="Main" className="flex w-60 shrink-0 flex-col border-r border-line bg-sidebar px-3 pb-3 pt-4">
            <div className="mb-5 flex items-center gap-2.5 px-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-[#5d6bff] text-accent-fg shadow">
                <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                  <rect x="7" y="3" width="10" height="18" rx="5" /><path d="M12 7v4" />
                </svg>
              </span>
              <div>
                <p className="text-[15px] font-semibold leading-none tracking-tight">MouseMore</p>
                <p className="mt-1 text-[11px] leading-none text-mute">Your mouse can do more</p>
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto pr-0.5">
              {GROUPS.map((g) => (
                <div key={g}>
                  {g !== "Home" && <p className="mb-1 px-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mute/80">{g}</p>}
                  <ul className="space-y-0.5">
                    {SECTIONS.filter((s) => s.group === g).map((s) => {
                      const active = s.id === current;
                      return (
                        <li key={s.id} className="relative">
                          {active && (
                            <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-lg bg-raised" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                          )}
                          <button
                            type="button"
                            onClick={() => go(s.id)}
                            aria-current={active ? "page" : undefined}
                            className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                              active ? "text-fg" : "text-mute hover:text-fg"
                            }`}
                          >
                            <s.icon size={16} aria-hidden className={active ? "text-accent" : ""} />
                            {s.name}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-mute">
              <span className={`h-2 w-2 rounded-full ${snapshot ? (enabled ? "bg-ok" : "bg-warn") : "bg-bad"}`} aria-hidden />
              {snapshot ? (enabled ? "Enabled" : "Globally disabled") : "Engine offline"}
              {snapshot && <span className="ml-auto font-mono">v{snapshot.platform.app_version}</span>}
            </div>
          </nav>

          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <main className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto max-w-4xl px-8 py-8">
                {snapshot?.notice && <Banner onDismiss={dismissNotice}>{snapshot.notice}</Banner>}
                {error && snapshot && <Banner tone="bad" onDismiss={clearError}>{error}</Banner>}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={current}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    {PAGES[current]()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>
          </div>
        </div>
        <Toasts />
      </MotionConfig>
    </NavCtx.Provider>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
