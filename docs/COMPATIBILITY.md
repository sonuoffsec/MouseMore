# Feature Compatibility Matrix

Yes: implemented. Partial: implemented with a stated limit. Planned: not built yet. No: not possible, or not claimed.

"Implemented" means the code exists, compiles and its logic is unit-tested. Interactive behaviour is being verified on real hardware; see [TESTING.md](TESTING.md).

| Capability | Windows 10/11 | Linux | macOS | Notes |
|---|---|---|---|---|
| Global enable/disable, emergency hotkey, tray | Yes | Planned | Planned | |
| Live input monitor (global mouse hook) | Yes | Planned | Planned | Cannot see elevated windows unless run as admin (UIPI). macOS will need Accessibility permission. |
| Pointing-device detection (names, buttons, bus) | Yes | Planned | Planned | Names come from the device's HID descriptor when it reports one. |
| Settings, profiles, presets, import/export | Yes | Yes* | Yes* | *Core is portable; no native backend yet. |
| Per-app profiles | Yes | Planned | Planned | Matched by executable name. |
| Cursor effects (overlay) | Yes | Planned | Planned | Drawn on an overlay; the system cursor image is unchanged. Wayland restricts global overlays. Exclusive full-screen games may cover the overlay; it hides itself in full-screen apps. |
| Cursor themes / morph / physics | Planned | Planned | Planned | |
| Draw gestures, radial menu, edge triggers | Yes | Planned | Planned | The trigger button is held back and replayed as a click when unused; dragging with that button held is unavailable. |
| Button remap, multi-click | Yes | Planned | Planned | Middle and side buttons only; left/right are never remapped. Extra buttons need vendor drivers. |
| Scroll speed / reverse / horizontal | Yes | Planned | Planned | Wheel events are rewritten and re-injected. |
| Pointer speed, double-click time | Yes | Planned | Planned | Restored on disable/quit. |
| Window actions, snapping, app switch | Yes | Planned | Planned | Via Windows shortcuts and window APIs. |
| Screenshot / screen recording / clipboard history | Partial | Planned | Planned | Triggers Snipping Tool, Game Bar and Windows clipboard history; no MouseMore equivalents. |
| Search selected text | Yes | Planned | Planned | Uses Ctrl+C; leaves the clipboard untouched if nothing was selected. |
| Magnifier | Partial | Planned | Planned | Opens Windows Magnifier. |
| Annotate, ruler, laser pointer | Yes | Planned | Planned | |
| Accessibility ring, click visual/sound | Yes | Planned | Planned | Large pointer is an overlay ring; the arrow itself keeps its size. |
| Macros, plugins | Yes | Planned | Planned | Cancellable by the emergency stop. |
| Report-rate readout | Partial | No | No | Peak estimate of delivered events; not a hardware reading. |
| Hardware DPI switching | No | No | No | Needs each vendor's proprietary protocol. |
| Hardware polling-rate change | No | No | No | Not exposed by the OS. |
| Battery level (generic mice) | No | No | No | No standard interface. |
| Per-physical-device profiles | No | No | No | The low-level hook can't attribute events to a device. |
