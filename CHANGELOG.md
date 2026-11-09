# Changelog

Format: [Keep a Changelog](https://keepachangelog.com/). Versioning: [SemVer](https://semver.org/).

## [Unreleased] - 0.1.0

### Added
- **Foundation:** Tauri 2 + React + TypeScript + Tailwind app; event-driven native engine; atomic local settings with corruption recovery, import/export/reset; portable mode; runtime capability checker; device detection with names.
- **Cursor effects** on a transparent click-through overlay: trail, click ripple/burst, glow, spotlight, rainbow, intensity, speed; live preview; paused in full-screen apps.
- **Gestures:** draw-to-act with custom recording, shake to locate, radial menu, edge/corner triggers, multi-click bindings.
- **Productivity:** window control, app switching, screenshot, search selected text, multi-monitor jumps, launcher, Windows clipboard-history/recording shortcuts.
- **Customization:** button remapping, scroll speed/reverse/horizontal scroll, pointer speed, precision mode, double-click time (all restored on exit).
- **Tools:** draw on screen, pixel ruler, laser pointer, spotlight.
- **Accessibility:** large high-contrast pointer ring, click visualization and sound, pointer locator, slow pointer.
- **Gaming and profiles:** multiple profiles, per-app auto-switching, quiet per-game profiles, presets, report-rate estimate.
- **Automation:** macros with delays, emergency stop (`Ctrl+Alt+Shift+M`), plugins from folders.
- **Shell:** system tray, close-to-tray, start with Windows (opt-in), single instance, dark/light title bar.
- 71 automated tests; CI workflow; portable ZIP and NSIS installer builds.

### Fixed
- Overlay flickering caused by the foreground watcher treating MouseMore's own overlay as a full-screen app.
- Title bar theme was re-applied on every settings change.
- Native context menu shown on right-click inside the app; favicon 404.
- A clear "MouseMore is switched off" banner with a one-click turn-on.

### Not possible / not claimed
- Hardware DPI or polling-rate changes, generic-mouse battery, per-physical-mouse profiles.
