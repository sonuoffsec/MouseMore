# Architecture

## Overview

```
 Main window (React)                 Overlay window (plain TS, transparent, click-through)
   state.tsx ── invoke ──▶ ┌────────────────────────────────────────────────────────────┐ ◀── events
   lib/api.ts ◀─ events ── │ Rust shell (apps/desktop/src-tauri)                        │   fx (physical px)
                           │  lib.rs        AppState, commands, apply_runtime()        │
                           │  engine/       message-loop thread: hook, hotkeys, fg watch│
                           │  dispatch.rs   brain thread: gestures, radial, remap,      │
                           │                scroll, corners, rate estimate, overlay feed│
                           │  actions.rs    runs actions + cancellable macros          │
                           │  platform/     SendInput, windows, monitors, clipboard,    │
                           │                pointer settings (win.rs | stub.rs)         │
                           │  overlay.rs / tray.rs / autostart.rs / plugins.rs          │
                           └──────────────────────────┬─────────────────────────────────┘
                                                      │ uses
              core/mousemore-core: settings (+validation), actions, gesture algorithms,
                                   presets, atomic store, capability types — no OS code
```

## The three threads that matter

1. **Engine thread** (`engine/windows_impl.rs`): blocks in `GetMessageW`; owns the low-level mouse hook, the global hotkeys and the foreground-window watcher. The hook callback only classifies an event, reads a tiny static `Policy` and forwards to a channel.
2. **Dispatcher thread** (`dispatch.rs`): blocks on a channel (a timeout is armed only while a multi-click or corner-dwell timer is pending). All behaviour lives here, driven by an `Arc<RuntimeConfig>` swapped atomically.
3. **Main/UI thread**: Tauri commands and the webviews.

No polling anywhere.

## Key decisions

| Decision | Rationale |
|---|---|
| **One function decides everything: `apply_runtime()`** | Hook on/off, which buttons are trapped, overlay visible/interactive, pointer-speed overrides and foreground watching are all derived from *settings + focused app + session switches* in one place, so no code path can leave a hook running while disabled. |
| **Trapped buttons are replayed, never lost** | Gesture/radial/remap buttons are swallowed by the hook and replayed as a click if unclaimed. The hook tells the dispatcher whether it swallowed an event, so a stale policy during a settings change replays instead of dropping the click. The left button can never be trapped. |
| **Injected input is ignored by the hook** | Our own `SendInput` events carry the injected flag, so replays and rewritten scrolls never loop. |
| **Overlay is one transparent window over the virtual screen** | Effects, gestures, radial menu and tools share one cheap surface; it is shown only when needed and hidden in full-screen apps. Events are physical pixels; the overlay converts using its DPI. |
| **Renderer shared with the in-app preview** | What you tune is exactly what draws on the overlay. It requests animation frames only while something is moving. |
| **Actions are data (`Action` enum in core)** | Every gesture, button, corner, radial item and macro step is the same validated, visible, testable type. Launch targets in imported settings are listed for review before import. |
| **Strict validation in core** | `deny_unknown_fields`, clamped ranges, unique ids, no left/right remap, no button-role collisions, key combos parsed at save time. The UI cannot save a state the engine can't run. |
| **Session-only switches (`RuntimeFlags`)** | "Pause effects/gestures", "precision" never touch saved settings. |
| **Pointer settings are saved and restored** | `SystemParams` remembers your Windows values and restores them on disable and quit. |
| **JSON settings, not SQLite (yet)** | Small, human-readable, trivially portable/backed up. The `Store` boundary isolates a later change. |
| **`windows` crate pinned `=0.58.0`** | Signatures change between minor versions; bump deliberately. |
| **Plugins are manifests, not code** | A plugin can only add actions that open files inside its folder or https links, and only runs when bound and enabled. No in-process code loading. |

## Settings flow

UI edit → (debounced, optimistic) `update_settings(patch)` → `Settings::apply_patch` (validate) → atomic save → `apply_runtime` → `state-changed` snapshot → both windows re-render. Failed validation rolls the UI back to what the engine holds.

## Extending

New OS: implement `engine::imp::Engine`, `platform::*` and `devices::detect`. New feature: add its settings + validation + tests to core, implement it in the dispatcher/platform, add UI, and only then flip its status in `catalog.ts` (tests enforce that planned/limited/unsupported items carry a phase or reason).

## Layout deviations

`core/*-engine` and `modules/*` from the original proposal are folded into `mousemore-core` (pure logic) and `src-tauri` (OS code): splitting them further would have created crates with a single caller each. `apps/web` and `apps/browser-extension` remain out of scope; browser APIs cannot see system-wide input.
