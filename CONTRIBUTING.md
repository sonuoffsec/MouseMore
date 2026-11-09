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
