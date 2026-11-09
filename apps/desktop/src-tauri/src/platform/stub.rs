//! Non-Windows placeholder: every action reports that it is unsupported.

use mousemore_core::action::{Button, Cycle, SystemOp, WindowOp};
use mousemore_core::settings::Modifier;
use mousemore_core::gesture::Rect;

use super::Foreground;

const NO: &str = "This action is not implemented on this operating system yet.";

pub fn send_combo(_vks: &[u16]) -> Result<(), String> { Err(NO.into()) }
pub fn launch(_target: &str, _args: &str) -> Result<(), String> { Err(NO.into()) }
pub fn window_op(_op: WindowOp) -> Result<(), String> { Err(NO.into()) }
pub fn system_op(_op: SystemOp) -> Result<(), String> { Err(NO.into()) }
pub fn pointer_to_monitor(_c: Cycle) -> Result<(), String> { Err(NO.into()) }
pub fn click(_b: Button, _double: bool) -> Result<(), String> { Err(NO.into()) }
pub fn inject_button(_b: Button, _down: bool) -> Result<(), String> { Err(NO.into()) }
pub fn inject_wheel(_delta: i32, _horizontal: bool) -> Result<(), String> { Err(NO.into()) }
pub fn search_selected(_url: &str) -> Result<(), String> { Err(NO.into()) }
pub fn modifier_down(_m: Modifier) -> bool { false }
pub fn cursor_pos() -> Option<(i32, i32)> { None }
pub fn virtual_screen() -> Rect { Rect::default() }
pub fn foreground() -> Foreground { Foreground::default() }
pub fn single_instance() -> bool { true }
pub fn running_apps() -> Vec<String> { Vec::new() }

/// Remembers the user's OS values so they can always be put back.
#[derive(Default)]
pub struct SystemParams;
impl SystemParams {
    pub fn apply(&mut self, _speed: Option<u8>, _double_click_ms: Option<u16>) {}
    pub fn restore(&mut self) {}
}
