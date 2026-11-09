//! Executes user-configured actions. Macros are cancellable as a group: the
//! emergency hotkey (and the global switch) bump `MACRO_GENERATION`, which
//! makes every running macro stop before its next step.

use std::sync::atomic::{AtomicU64, Ordering};
use std::thread::sleep;
use std::time::Duration;

use mousemore_core::action::{parse_combo, Action};
use tauri::{AppHandle, Emitter};

use crate::dispatch::RuntimeConfig;
use crate::platform;

static MACRO_GENERATION: AtomicU64 = AtomicU64::new(0);
const MAX_MACRO_DEPTH: u8 = 3;
const STEP_GAP: Duration = Duration::from_millis(15);

/// Stop every running macro (emergency stop / global disable).
pub fn stop_all_macros() {
    MACRO_GENERATION.fetch_add(1, Ordering::SeqCst);
}

/// Run an action and surface any failure to the UI instead of swallowing it.
pub fn run_top(app: &AppHandle, cfg: &RuntimeConfig, action: &Action) {
    if let Err(e) = run(app, cfg, action, 0) {
        eprintln!("MouseMore action failed: {e}");
        let _ = app.emit_to(
            "main",
            "action-error",
            format!("{}: {e}", action.describe()),
        );
    }
}

pub fn run(app: &AppHandle, cfg: &RuntimeConfig, action: &Action, depth: u8) -> Result<(), String> {
    match action {
        Action::None => Ok(()),
        Action::Keys { combo } => platform::send_combo(&parse_combo(combo)?),
        Action::Launch { target, args } => platform::launch(target, args),
        Action::Window { op } => platform::window_op(*op),
        Action::System { op } => platform::system_op(*op),
        Action::SearchSelected { url } => platform::search_selected(url),
        Action::PointerToMonitor { which } => platform::pointer_to_monitor(*which),
        Action::MouseClick { button, double } => platform::click(*button, *double),
        Action::Tool { tool } => {
            crate::tools::run(app, *tool);
            Ok(())
        }
        Action::Toggle { what } => {
            crate::toggle(app, *what);
            Ok(())
        }
        Action::Delay { ms } => {
            let generation = MACRO_GENERATION.load(Ordering::SeqCst);
            wait(*ms, generation);
            Ok(())
        }
        Action::Plugin { plugin, action } => {
            let p = cfg
                .plugins
                .iter()
                .find(|p| &p.plugin == plugin && &p.action == action)
                .ok_or_else(|| {
                    format!("plugin action {plugin}/{action} is not installed or not enabled")
                })?;
            platform::launch(&p.target, &p.args)
        }
        Action::Macro { id } => {
            if depth >= MAX_MACRO_DEPTH {
                return Err("macros are nested too deeply".into());
            }
            let m = cfg
                .macros
                .iter()
                .find(|m| &m.id == id)
                .ok_or_else(|| format!("macro \"{id}\" does not exist"))?;
            let generation = MACRO_GENERATION.load(Ordering::SeqCst);
            for step in &m.steps {
                if MACRO_GENERATION.load(Ordering::SeqCst) != generation {
                    return Ok(()); // stopped by the user
                }
                match step {
                    Action::Delay { ms } => wait(*ms, generation),
                    other => run(app, cfg, other, depth + 1)?,
                }
                sleep(STEP_GAP);
            }
            Ok(())
        }
    }
}

/// Sleep in short slices so a stop request takes effect quickly.
fn wait(ms: u32, generation: u64) {
    let mut left = ms as u64;
    while left > 0 && MACRO_GENERATION.load(Ordering::SeqCst) == generation {
        let slice = left.min(40);
        sleep(Duration::from_millis(slice));
        left -= slice;
    }
}
