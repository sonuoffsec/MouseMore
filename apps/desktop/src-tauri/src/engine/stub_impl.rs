//! Placeholder for operating systems without a native backend yet.
//! It reports that nothing is running.

use std::sync::Mutex;

use super::{
    EmergencyCallback, EngineStatus, InputSink, Policy, ANNOTATE_HOTKEY_LABEL, HOTKEY_LABEL,
    RULER_HOTKEY_LABEL,
};

pub struct Engine {
    error: Mutex<Option<String>>,
}

impl Engine {
    pub fn start(_s: InputSink, _e: EmergencyCallback) -> Engine {
        Engine { error: Mutex::new(None) }
    }

    pub fn set_hook(&self, on: bool) {
        *self.error.lock().unwrap() = on.then(|| {
            "The global mouse hook is not implemented on this operating system yet.".to_owned()
        });
    }

    pub fn set_policy(&self, _p: Policy) {}
    pub fn set_foreground_watch(&self, _on: bool) {}

    pub fn status(&self) -> EngineStatus {
        EngineStatus {
            engine_running: false,
            hook_installed: false,
            hook_error: self.error.lock().unwrap().clone(),
            hotkey_registered: false,
            hotkey_label: HOTKEY_LABEL,
            tool_hotkeys_registered: false,
            annotate_hotkey_label: ANNOTATE_HOTKEY_LABEL,
            ruler_hotkey_label: RULER_HOTKEY_LABEL,
        }
    }

    pub fn shutdown(&self) {}
}
