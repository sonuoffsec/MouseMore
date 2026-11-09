# Roadmap and Status Checklist

Legend: `[x]` implemented **and verified** · `[~]` implemented, compiles and is unit-tested, **needs manual verification** (see [TESTING.md](TESTING.md)) · `[ ]` not started · `[!]` not possible

## Verified so far
- `cargo test --workspace`: 52 tests pass (41 core, 11 desktop). `cargo clippy` clean. `npm test`: 19 pass. Typecheck and production build clean.
- The app launches as a native process; idle CPU ≈ 0%; settings persist; the emergency hotkey toggles the master switch and saves (checked in Phase 1).
- A person has used the running app's pages, toggled features and saw "Hook active" after enabling edge triggers.

## Phase 1: Foundation: done
- [x] Cargo + npm workspaces, Tauri 2 / React / TypeScript / Tailwind shell
- [x] Atomic settings with corruption recovery, import/export/reset, portable mode
- [x] Device detection (Raw Input + HID names), runtime capability checker, global enable/disable

## Phase 2: Visual experience
- [x] Overlay window, shared renderer with live in-app preview
- [~] Trail, ripple, burst, glow, spotlight, color/rainbow, intensity, speed on the real overlay
- [~] System tray; full-screen pause
- [ ] Animated cursor *themes*, morphing and physics (the real system cursor image is not replaced)
- [ ] MouseMore's own magnifier lens (Windows Magnifier is available as an action)

## Phase 3: Gestures
- [x] Shake, stroke, radial-sector and edge-zone algorithms (unit-tested)
- [~] Draw gestures with held-back-button replay, custom recording, radial menu, edge/corner triggers, multi-click bindings

## Phase 4: Productivity
- [~] Window control, app switching, screenshot, search selected text, multi-monitor, launcher (via radial)
- [!] Own clipboard history / screen recorder (by design: Windows' tools are triggered instead)

## Phase 5: Advanced
- [~] Macros + emergency stop, per-app profiles, presets, remaps, scroll rewrite, pointer speed, double-click time
- [~] Annotate, ruler, laser pointer, accessibility features, click sounds, gaming profiles, report-rate estimate
- [~] Plugins (folder manifests)
- [!] Hardware DPI / polling-rate changes, battery for generic mice, per-device profiles

## Phase 6: Release
- [x] CI workflow, portable ZIP script, NSIS installer config
- [x] Installer and portable ZIP build (rebuilt after the UI-test fixes; smoke-tested)
- [x] Driven UI test against the real window with real input (see docs/TESTING.md)
- [x] README screenshots
- [ ] Code signing, GIFs, GitHub release
- [ ] Linux and macOS backends (core crate is already OS-independent)
- [ ] Wider hardware testing (wireless, Bluetooth, multi-monitor mixed DPI)
