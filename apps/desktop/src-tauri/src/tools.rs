//! On-demand overlay tools: annotate, ruler, locate pointer.

use mousemore_core::action::ToolKind;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};

use crate::{platform, AppState};

fn name(k: Option<ToolKind>) -> serde_json::Value {
    match k {
        Some(ToolKind::Annotate) => json!("annotate"),
        Some(ToolKind::Ruler) => json!("ruler"),
        _ => serde_json::Value::Null,
    }
}

pub fn run(app: &AppHandle, kind: ToolKind) {
    match kind {
        ToolKind::Annotate | ToolKind::Ruler => {
            let current = *app.state::<AppState>().tool.lock().unwrap();
            set(app, if current == Some(kind) { None } else { Some(kind) });
        }
        ToolKind::ClearAnnotations => {
            let _ = app.emit_to("overlay", "fx", json!({"k": "clear"}));
        }
        ToolKind::LocatePointer => {
            if let Some((x, y)) = platform::cursor_pos() {
                let _ = app.emit_to("overlay", "fx", json!({"k": "locate", "x": x, "y": y}));
            }
        }
    }
}

/// Activate (`Some`) or leave (`None`) an interactive overlay tool.
pub fn set(app: &AppHandle, next: Option<ToolKind>) {
    let state = app.state::<AppState>();
    {
        let mut t = state.tool.lock().unwrap();
        if *t == next {
            return;
        }
        *t = next;
    }
    crate::apply_runtime(app);
    let _ = app.emit_to("overlay", "fx", json!({"k": "tool", "tool": name(next)}));
}
