# Security Policy

## Reporting a vulnerability

Please **do not open a public issue**. Use GitHub's private vulnerability reporting ("Security" tab, "Report a vulnerability") on this repository. Include steps to reproduce, affected version and impact. We aim to acknowledge within 7 days.

## Security model

- MouseMore installs a low-level mouse hook only while the user has enabled it, and observes only coordinates and event kinds. Nothing is persisted or transmitted.
- The webview has `core:default` permissions only (no filesystem, shell, HTTP or dialog plugins) and a restrictive CSP.
- Settings import is validated by strict deserialization (`deny_unknown_fields`, type checks, version check).
- No administrator privileges are required.
- MouseMore injects input (key presses, clicks, scroll) only in response to actions the user configured. Injected events are tagged by Windows and ignored by MouseMore's own hook, so nothing loops.
- A global kill switch and the emergency hotkey (`Ctrl+Alt+Shift+M`) disable all features and halt running macros.
- The left mouse button is never trapped or remapped; trapped buttons are replayed as ordinary clicks if no gesture claims them.
- Imported settings are validated strictly, and every program or link they could launch is shown for review before the import is applied.
- Plugins are manifests only: an action may open a file inside its own folder (path traversal and absolute paths are rejected) or an https link. Plugins do nothing until enabled and bound by the user.
- The clipboard is read only by the "Search selected text" action, only after you trigger it, and is left untouched if nothing was selected. No clipboard history is kept.

## Known limits

Windows UIPI prevents a non-elevated process from observing elevated windows. This is an OS boundary and is not bypassed.
