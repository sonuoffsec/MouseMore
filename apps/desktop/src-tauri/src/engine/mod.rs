//! Native input engine.
//!
//! One dedicated OS thread owns the message loop. It is fully event driven
//! (blocks in `GetMessageW`, no polling) and it:
//!   * registers the emergency-stop and tool hotkeys (always),
//!   * installs / removes the low-level mouse hook on request,
//!   * watches foreground-window changes on request.
//!
//! The hook callback only classifies an event, decides (from a tiny static
//! policy) whether to swallow it, and forwards it. All real work happens on the
//! dispatcher thread.

use std::sync::Arc;

use mousemore_core::Button;
use serde::Serialize;

use crate::platform::Foreground;

#[cfg(windows)]
mod windows_impl;
#[cfg(windows)]
use windows_impl as imp;

#[cfg(not(windows))]
mod stub_impl;
#[cfg(not(windows))]
use stub_impl as imp;

pub const HOTKEY_LABEL: &str = "Ctrl+Alt+Shift+M";
pub const ANNOTATE_HOTKEY_LABEL: &str = "Ctrl+Alt+Shift+D";
pub const RULER_HOTKEY_LABEL: &str = "Ctrl+Alt+Shift+R";

#[derive(Debug, Clone, Serialize)]
pub struct EngineStatus {
    pub engine_running: bool,
    pub hook_installed: bool,
    pub hook_error: Option<String>,
    pub hotkey_registered: bool,
    pub hotkey_label: &'static str,
    pub tool_hotkeys_registered: bool,
    pub annotate_hotkey_label: &'static str,
    pub ruler_hotkey_label: &'static str,
}

/// What the hook is told to do with events. Computed from the active profile.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct Policy {
    /// Buttons whose press/release is swallowed (the dispatcher replays a
    /// normal click when no gesture/action claims it).
    pub trap: [bool; Button::COUNT],
    /// Swallow the wheel; the dispatcher injects the rewritten scroll.
    pub wheel_rewrite: bool,
    /// Forward pointer movement (only when something consumes it).
    pub send_moves: bool,
}

#[derive(Debug, Clone)]
pub enum Input {
    Move { x: i32, y: i32, t_us: u64 },
    /// `swallowed`: the hook already withheld this event from the system, so
    /// the dispatcher must replay it if nothing claims it.
    Button { button: Button, down: bool, x: i32, y: i32, swallowed: bool },
    Wheel { delta: i32, horizontal: bool, x: i32, y: i32, swallowed: bool },
    Foreground(Foreground),
    Hotkey(Hotkey),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Hotkey {
    Annotate,
    Ruler,
}

pub type InputSink = Arc<dyn Fn(Input) + Send + Sync>;
pub type EmergencyCallback = Arc<dyn Fn() + Send + Sync>;

pub struct Engine(imp::Engine);

impl Engine {
    pub fn start(sink: InputSink, on_emergency: EmergencyCallback) -> Engine {
        Engine(imp::Engine::start(sink, on_emergency))
    }

    /// Install (`true`) or remove (`false`) the global mouse hook.
    /// Blocks until the engine thread has acted (bounded by a timeout).
    pub fn set_hook(&self, on: bool) {
        self.0.set_hook(on)
    }

    pub fn set_policy(&self, policy: Policy) {
        self.0.set_policy(policy)
    }

    /// Start/stop foreground-window notifications (for per-app profiles and
    /// full-screen detection). Sends the current window once when enabled.
    pub fn set_foreground_watch(&self, on: bool) {
        self.0.set_foreground_watch(on)
    }

    pub fn status(&self) -> EngineStatus {
        self.0.status()
    }

    pub fn shutdown(&self) {
        self.0.shutdown()
    }
}
