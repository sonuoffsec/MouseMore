# Testing

## Automated

```powershell
cargo test --workspace      # core logic + desktop-crate parsing/validation
npm test                    # frontend logic (catalog honesty, actions, profiles)
npm run typecheck
cargo clippy --workspace --all-targets
```

What the automated tests cover: settings validation and migration rules, key-combo parsing, shake/stroke/radial/edge-zone/report-rate algorithms, presets, plugin path safety, capability honesty (hardware features can never read "supported"), device-path parsing, and that the feature catalog never over-claims.

What they **cannot** cover: anything that needs a real mouse, the Windows hook, or pixels on screen. Those need the manual plan below.

## Manual plan (Windows 10/11, ~10 minutes)

Run `npm run dev` (or the portable exe) and tick each line. Start with the emergency hotkey so you know you can always get out.

**Safety**
- [ ] `Ctrl+Alt+Shift+M` toggles MouseMore from another app; the tray check mark follows.
- [ ] Settings are all off on a fresh profile (delete `settings.json` to test); idle CPU ≈ 0%.
- [ ] Turning the master switch off restores your pointer speed and double-click time.

**Effects** (Cursor Effects page)
- [ ] The preview animates and responds to your mouse.
- [ ] Enabling Trail shows it over other apps; disabling hides the overlay entirely.
- [ ] A full-screen video/game hides the overlay (with "Pause in full-screen" on).

**Gestures**
- [ ] With gestures on (right button), a normal right-click still opens the context menu.
- [ ] Drawing "L" runs Alt+Left; the stroke and label appear on screen.
- [ ] "Record by drawing" captures a new pattern.
- [ ] Switching the trigger to the middle button works the same.
- [ ] Shake left-right: the highlight appears.
- [ ] Radial menu: hold the button, move toward an item, release; a short press still clicks.
- [ ] Corner trigger fires after the rest time, once, and not while you just pass through.

**Customization**
- [ ] A side-button remap fires its action (and double-press maps differently).
- [ ] Scroll speed, reverse and hold-Shift horizontal scrolling behave.
- [ ] Pointer speed changes and is restored.

**Tools**
- [ ] `Ctrl+Alt+Shift+D` draws; right-click undoes; `Esc` exits and clicks work again.
- [ ] `Ctrl+Alt+Shift+R` measures in pixels.

**Profiles**
- [ ] With auto-switch on, a profile bound to `notepad.exe` takes over when Notepad has focus.

**Lifecycle**
- [ ] Closing the window keeps it in the tray; Quit from the tray exits and removes the overlay.
- [ ] Start with Windows adds and removes the Run entry.
- [ ] A second launch does nothing (single instance).
- [ ] Portable: with `portable.flag`, settings land in `data/` and nowhere else.

## Driven UI test (real window, real input)

A debug build can be driven end to end: Chrome DevTools Protocol for the webview, and Win32 `mouse_event`/`keybd_event` for real pointer input.

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222"   # exposes the webview to a test driver
$env:MOUSEMORE_TEST_INPUT = "1"                                              # debug builds only: let the hook see injected input
npm run dev
```

Both variables are inert in release builds (`MOUSEMORE_TEST_INPUT` is compiled out). MouseMore's own synthetic input is tagged and always ignored by its hook.

What the driven run checks (0.1.0): all pages reachable; no horizontal overflow at the 880 px minimum width; idle UI has no DOM churn and the engine emits no events; overlay show/hide happens exactly once per change; right-button gestures (click passes through, tiny wiggle is a click, strokes run their action, unbound strokes do nothing); side-button remaps incl. single vs double press; scroll speed/reverse; fast typing loses no characters; validation errors roll back; profiles, themes, import review; emergency hotkey.

Notes for anyone repeating it: start from a profile with no effects on (an enabled Spotlight keeps the overlay legitimately visible); do not touch the mouse during the scroll checks; a native context menu will block the DevTools connection, which is why the app suppresses it.

### Bugs this found
- **Overlay flicker (~8x/s):** the overlay was counted as a full-screen foreground app, which hid it, which changed the foreground, which showed it again. The foreground watcher now ignores MouseMore's own windows.
- **Title bar re-themed on every state change:** now applied only when the theme changes.
- Switched-off state was silent: pages now show a banner with a one-click "Turn MouseMore on".
- Native browser context menu (Back/Refresh/Inspect) appeared on right-click: suppressed except in text fields.
- Favicon 404 in the console: fixed.

In `npm run dev`, editing Rust files rebuilds and relaunches the app, so the window disappears and reappears. That is expected in dev only.
