# Contributing to MouseMore

Thanks for helping. A few rules keep the project trustworthy.

## Product rules (non-negotiable)

1. **No fake controls.** A feature either works end to end or is labelled *Planned*/*Unsupported* in `apps/desktop/src/lib/catalog.ts` with no toggle.
2. **No hardware claims** (DPI, polling rate, battery) unless the device exposes a supported mechanism.
3. **No telemetry, accounts or network calls.** New Tauri permissions need justification in the PR.
4. **Hooks are opt-in and visible.** Install a global hook only when the user enabled the feature that needs it; remove it when they disable it. No polling; be event driven.
5. **No elevation** unless unavoidable and explained.

## Setup

See the README prerequisites, then:

```powershell
npm install
npm test                  # frontend tests (catalog honesty, actions, profiles)
npm run typecheck
cargo test --workspace    # Rust tests (needs the MSVC toolchain)
npm run dev
```

## Workflow

- Open an issue first for anything larger than a small fix.
- Keep PRs focused. Add tests: pure logic belongs in `core/mousemore-core` (testable anywhere); parsing logic in the desktop crate should be separated from OS calls.
- Update `docs/ROADMAP.md`, `docs/COMPATIBILITY.md` and `CHANGELOG.md` when status changes.
- `unsafe` Rust must be minimal and commented with the invariant it relies on.
- Pin or justify new dependencies; the `windows` crate is pinned because its API shifts between versions.

## Where things live

| I want to change... | Look here |
|---|---|
| What a setting is, its limits, how it is validated | `core/mousemore-core/src/settings.rs` (add a test next to it) |
| What an action can do (keys, launch, window ops, macros) | `core/mousemore-core/src/action.rs`, then `apps/desktop/src-tauri/src/actions.rs` |
| Gesture maths (shake, strokes, radial sectors, edge zones) | `core/mousemore-core/src/gesture.rs`, pure functions with tests |
| When the hook, overlay or foreground watcher turn on | `apply_runtime()` in `apps/desktop/src-tauri/src/lib.rs` |
| How mouse events are interpreted | `apps/desktop/src-tauri/src/dispatch.rs` |
| Windows-specific calls (SendInput, windows, monitors) | `apps/desktop/src-tauri/src/platform/win.rs` |
| The cursor effect drawing | `apps/desktop/src/lib/fx/renderer.ts` |
| A page in the UI | `apps/desktop/src/pages/`, built from `components/ui.tsx` |
| A feature's status (working, partial, planned, unsupported) | `apps/desktop/src/lib/catalog.ts` |

Rust code that does not touch the OS belongs in `mousemore-core`, which builds and tests on any platform.

## Adding a feature, step by step

1. Add the setting to `settings.rs` with a default, a clamp or validation rule, and a unit test.
2. If it needs a new action, add the variant to `action.rs` (and its `validate` and `describe`), then handle it in `actions.rs`.
3. Implement the behavior in `dispatch.rs` or `platform/win.rs`. If it needs the hook or the overlay, extend `Behavior::needs_hook` / `needs_overlay` so `apply_runtime()` turns them on only while the feature is enabled.
4. Add the UI on the matching page. Use `patchBehavior` for edits and show validation errors from the engine.
5. Add the feature to `catalog.ts` as `planned` first. Switch it to `working` only once it works end to end on a real machine.
6. Update `docs/COMPATIBILITY.md` and `CHANGELOG.md`.

## Checks before you open a PR

```powershell
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
npm run typecheck
npm test
```

CI runs the same checks on Windows, plus compile checks on Linux and macOS.

## Testing the real app

`docs/TESTING.md` explains how to drive a debug build with real mouse input. Two environment variables help in development: `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` (opens a debugging port) and `MOUSEMORE_TEST_INPUT` (debug builds only; lets the hook see injected input).

## Commit and PR style

Short imperative subject ("Fix overlay flicker on foreground change"), a body that says why. One logical change per PR. Describe how you tested it. Screenshots help for UI changes.
