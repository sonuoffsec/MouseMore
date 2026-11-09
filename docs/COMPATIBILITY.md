# Feature Compatibility Matrix

✅ implemented · ◐ implemented with a stated limit · 🕒 planned · ❌ not possible / not claimed

"Implemented" means the code exists, compiles and its logic is unit-tested. Interactive behaviour is being verified on real hardware; see [TESTING.md](TESTING.md).

| Capability | Windows 10/11 | Linux | macOS | Notes |
|---|---|---|---|---|
| Global enable/disable, emergency hotkey, tray | ✅ | 🕒 | 🕒 | |
| Live input monitor (global mouse hook) | ✅ | 🕒 | 🕒 | Cannot see elevated windows unless run as admin (UIPI). macOS will need Accessibility permission. |
| Pointing-device detection (names, buttons, bus) | ✅ | 🕒 | 🕒 | Names come from the device's HID descriptor when it reports one. |
| Settings, profiles, presets, import/export | ✅ | ✅* | ✅* | *Core is portable; no native backend yet. |
| Per-app profiles | ✅ | 🕒 | 🕒 | Matched by executable name. |
| Cursor effects (overlay) | ✅ | 🕒 | 🕒 | Drawn on an overlay; the system cursor image is unchanged. Wayland restricts global overlays. Exclusive full-screen games may cover the overlay; it hides itself in full-screen apps. |
| Cursor themes / morph / physics | 🕒 | 🕒 | 🕒 | |
| Draw gestures, radial menu, edge triggers | ✅ | 🕒 | 🕒 | The trigger button is held back and replayed as a click when unused; dragging with that button held is unavailable. |
| Button remap, multi-click | ✅ | 🕒 | 🕒 | Middle and side buttons only; left/right are never remapped. Extra buttons need vendor drivers. |
| Scroll speed / reverse / horizontal | ✅ | 🕒 | 🕒 | Wheel events are rewritten and re-injected. |
| Pointer speed, double-click time | ✅ | 🕒 | 🕒 | Restored on disable/quit. |
| Window actions, snapping, app switch | ✅ | 🕒 | 🕒 | Via Windows shortcuts and window APIs. |
| Screenshot / screen recording / clipboard history | ◐ | 🕒 | 🕒 | Triggers Snipping Tool, Game Bar and Windows clipboard history; no MouseMore equivalents. |
| Search selected text | ✅ | 🕒 | 🕒 | Uses Ctrl+C; leaves the clipboard untouched if nothing was selected. |
| Magnifier | ◐ | 🕒 | 🕒 | Opens Windows Magnifier. |
| Annotate, ruler, laser pointer | ✅ | 🕒 | 🕒 | |
| Accessibility ring, click visual/sound | ✅ | 🕒 | 🕒 | Large pointer is an overlay ring; the arrow itself keeps its size. |
| Macros, plugins | ✅ | 🕒 | 🕒 | Cancellable by the emergency stop. |
| Report-rate readout | ◐ | ❌ | ❌ | Peak estimate of delivered events; not a hardware reading. |
| Hardware DPI switching | ❌ | ❌ | ❌ | Needs each vendor's proprietary protocol. |
| Hardware polling-rate change | ❌ | ❌ | ❌ | Not exposed by the OS. |
| Battery level (generic mice) | ❌ | ❌ | ❌ | No standard interface. |
| Per-physical-device profiles | ❌ | ❌ | ❌ | The low-level hook can't attribute events to a device. |
