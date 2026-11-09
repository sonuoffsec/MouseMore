//! Platform-independent building blocks for MouseMore.
//!
//! Nothing in this crate touches the OS, so it can be unit tested anywhere
//! and reused by future Linux/macOS backends.

pub mod action;
pub mod capability;
pub mod gesture;
pub mod presets;
pub mod settings;
pub mod store;

pub use action::{Action, Button};
pub use capability::{Capability, Status};
pub use settings::{Behavior, Profile, Settings, SettingsError, Theme, SETTINGS_VERSION};
pub use store::{LoadOutcome, Store};
