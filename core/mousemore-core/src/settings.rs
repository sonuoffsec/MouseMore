//! The settings model: profiles, per-profile behavior, macros and general options.
//! Everything the UI can save is validated here (`deny_unknown_fields`, clamped ranges,
//! unique ids, key-combo parsing), so the engine never receives a state it cannot run.

use std::collections::HashSet;
use std::fmt;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::action::{Action, Button, SystemOp, WindowOp};
use crate::gesture::valid_pattern;

/// Bump when the on-disk format changes incompatibly.
pub const SETTINGS_VERSION: u32 = 1;

const MAX_RECENT: usize = 6;
const MAX_PROFILES: usize = 24;
const MAX_MACROS: usize = 32;
const MAX_STEPS: usize = 50;
const MAX_BINDINGS: usize = 48;
const MAX_REMAPS: usize = 12;
pub const DEFAULT_PROFILE: &str = "default";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
    System,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ColorMode {
    Solid,
    Rainbow,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Modifier {
    None,
    Ctrl,
    Alt,
    Shift,
}

// -------------------------------------------------------------- behavior ---

/// Visual cursor effects, drawn on a click-through overlay.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Effects {
    pub trail: bool,
    pub trail_length: u8,
    pub click_ripple: bool,
    pub click_burst: bool,
    pub glow: bool,
    pub glow_size: u16,
    pub spotlight: bool,
    pub spotlight_radius: u16,
    pub spotlight_dim: u8,
    pub color: String,
    pub color_mode: ColorMode,
    /// 10..=100
    pub intensity: u8,
    /// Animation speed in percent, 25..=200
    pub speed: u8,
    /// Hide the overlay while a full-screen app (game, video) is in front.
    pub disable_in_fullscreen: bool,
}

impl Default for Effects {
    fn default() -> Self {
        Self {
            trail: false,
            trail_length: 24,
            click_ripple: false,
            click_burst: false,
            glow: false,
            glow_size: 60,
            spotlight: false,
            spotlight_radius: 220,
            spotlight_dim: 60,
            color: "#8b9bff".into(),
            color_mode: ColorMode::Solid,
            intensity: 70,
            speed: 100,
            disable_in_fullscreen: true,
        }
    }
}

impl Effects {
    pub fn any(&self) -> bool {
        self.trail || self.click_ripple || self.click_burst || self.glow || self.spotlight
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GestureBinding {
    pub pattern: String,
    pub action: Action,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Gestures {
    /// Draw-to-act. While `button` is held the pointer path is recognised.
    pub enabled: bool,
    pub button: Button,
    /// Strokes shorter than this (px) are treated as an ordinary click.
    pub min_distance: u16,
    /// Shake the mouse left-right to highlight the pointer.
    pub shake_locate: bool,
    pub shake_sensitivity: u8,
    pub bindings: Vec<GestureBinding>,
}

impl Default for Gestures {
    fn default() -> Self {
        let b = |p: &str, a: Action| GestureBinding {
            pattern: p.into(),
            action: a,
        };
        Self {
            enabled: false,
            button: Button::Right,
            min_distance: 60,
            shake_locate: false,
            shake_sensitivity: 5,
            bindings: vec![
                b("L", Action::keys("alt+left")),
                b("R", Action::keys("alt+right")),
                b(
                    "U",
                    Action::Window {
                        op: WindowOp::MaximizeToggle,
                    },
                ),
                b(
                    "D",
                    Action::Window {
                        op: WindowOp::Minimize,
                    },
                ),
                b("DR", Action::keys("ctrl+w")),
                b("UR", Action::keys("ctrl+t")),
                b(
                    "UL",
                    Action::System {
                        op: SystemOp::TaskView,
                    },
                ),
                b(
                    "DL",
                    Action::System {
                        op: SystemOp::ShowDesktop,
                    },
                ),
            ],
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct RadialItem {
    pub label: String,
    pub action: Action,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Radial {
    pub enabled: bool,
    /// Hold this button, move toward an item, release to run it.
    pub button: Button,
    pub items: Vec<RadialItem>,
}

impl Default for Radial {
    fn default() -> Self {
        let i = |l: &str, a: Action| RadialItem {
            label: l.into(),
            action: a,
        };
        Self {
            enabled: false,
            button: Button::Middle,
            items: vec![
                i(
                    "Screenshot",
                    Action::System {
                        op: SystemOp::Screenshot,
                    },
                ),
                i(
                    "Snap right",
                    Action::Window {
                        op: WindowOp::SnapRight,
                    },
                ),
                i(
                    "Clipboard",
                    Action::System {
                        op: SystemOp::ClipboardHistory,
                    },
                ),
                i(
                    "Desktop",
                    Action::System {
                        op: SystemOp::ShowDesktop,
                    },
                ),
                i(
                    "Snap left",
                    Action::Window {
                        op: WindowOp::SnapLeft,
                    },
                ),
                i(
                    "Task view",
                    Action::System {
                        op: SystemOp::TaskView,
                    },
                ),
            ],
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Edges {
    pub enabled: bool,
    /// Dwell time at the edge before the action fires.
    pub dwell_ms: u16,
    pub top_left: Action,
    pub top_right: Action,
    pub bottom_left: Action,
    pub bottom_right: Action,
    pub top: Action,
    pub bottom: Action,
    pub left: Action,
    pub right: Action,
}

impl Default for Edges {
    fn default() -> Self {
        Self {
            enabled: false,
            dwell_ms: 450,
            top_left: Action::System {
                op: SystemOp::TaskView,
            },
            top_right: Action::None,
            bottom_left: Action::None,
            bottom_right: Action::System {
                op: SystemOp::ShowDesktop,
            },
            top: Action::None,
            bottom: Action::None,
            left: Action::None,
            right: Action::None,
        }
    }
}

/// Remap a side/middle button to any action. `clicks` 1..=3 gives
/// double- and triple-click bindings on the same button.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Remap {
    pub button: Button,
    pub clicks: u8,
    pub action: Action,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Scroll {
    /// 25..=400, 100 = unchanged.
    pub speed_percent: u16,
    pub reverse: bool,
    /// While held, the vertical wheel scrolls horizontally.
    pub horizontal_modifier: Modifier,
}

impl Default for Scroll {
    fn default() -> Self {
        Self {
            speed_percent: 100,
            reverse: false,
            horizontal_modifier: Modifier::None,
        }
    }
}

impl Scroll {
    pub fn active(&self) -> bool {
        self.speed_percent != 100 || self.reverse || self.horizontal_modifier != Modifier::None
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Pointer {
    /// Windows pointer speed 1..=20 (10 = default). `None` leaves it alone.
    pub speed: Option<u8>,
    /// Pointer speed used while precision mode is on.
    pub precision_speed: u8,
    /// Windows double-click interval, 200..=900 ms. `None` leaves it alone.
    pub double_click_ms: Option<u16>,
}

impl Default for Pointer {
    fn default() -> Self {
        Self {
            speed: None,
            precision_speed: 3,
            double_click_ms: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Accessibility {
    /// Big high-contrast ring around the pointer so it is easy to follow.
    pub large_pointer: bool,
    pub large_pointer_size: u16,
    pub pointer_color: String,
    pub click_visual: bool,
    pub click_color: String,
    pub click_sound: bool,
}

impl Default for Accessibility {
    fn default() -> Self {
        Self {
            large_pointer: false,
            large_pointer_size: 90,
            pointer_color: "#ffd60a".into(),
            click_visual: false,
            click_color: "#3ecf8e".into(),
            click_sound: false,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Presentation {
    pub laser: bool,
    pub color: String,
    pub size: u8,
}

impl Default for Presentation {
    fn default() -> Self {
        Self {
            laser: false,
            color: "#ff3b30".into(),
            size: 22,
        }
    }
}

/// Everything that changes with the active profile.
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Behavior {
    pub effects: Effects,
    pub gestures: Gestures,
    pub radial: Radial,
    pub edges: Edges,
    pub remaps: Vec<Remap>,
    pub scroll: Scroll,
    pub pointer: Pointer,
    pub accessibility: Accessibility,
    pub presentation: Presentation,
}

fn valid_color(c: &str) -> bool {
    c.len() == 7 && c.starts_with('#') && c[1..].chars().all(|ch| ch.is_ascii_hexdigit())
}

impl Behavior {
    /// Does anything in this behaviour need the global mouse hook?
    pub fn needs_hook(&self) -> bool {
        self.effects.any()
            || self.gestures.enabled
            || self.gestures.shake_locate
            || self.radial.enabled
            || self.edges.enabled
            || !self.remaps.is_empty()
            || self.scroll.active()
            || self.accessibility.large_pointer
            || self.accessibility.click_visual
            || self.accessibility.click_sound
            || self.presentation.laser
    }

    /// Does anything need the transparent overlay window?
    pub fn needs_overlay(&self) -> bool {
        self.effects.any()
            || self.gestures.enabled
            || self.gestures.shake_locate
            || self.radial.enabled
            || self.accessibility.large_pointer
            || self.accessibility.click_visual
            || self.presentation.laser
    }

    fn clamp(&mut self) {
        let e = &mut self.effects;
        e.trail_length = e.trail_length.clamp(5, 60);
        e.glow_size = e.glow_size.clamp(20, 200);
        e.spotlight_radius = e.spotlight_radius.clamp(80, 600);
        e.spotlight_dim = e.spotlight_dim.clamp(0, 90);
        e.intensity = e.intensity.clamp(10, 100);
        e.speed = e.speed.clamp(25, 200);
        let g = &mut self.gestures;
        g.min_distance = g.min_distance.clamp(20, 400);
        g.shake_sensitivity = g.shake_sensitivity.clamp(1, 10);
        g.bindings.truncate(MAX_BINDINGS);
        self.radial.items.truncate(8);
        for i in &mut self.radial.items {
            i.label.truncate(24);
        }
        self.edges.dwell_ms = self.edges.dwell_ms.clamp(150, 2000);
        self.remaps.truncate(MAX_REMAPS);
        for r in &mut self.remaps {
            r.clicks = r.clicks.clamp(1, 3);
        }
        self.scroll.speed_percent = self.scroll.speed_percent.clamp(25, 400);
        let p = &mut self.pointer;
        p.speed = p.speed.map(|s| s.clamp(1, 20));
        p.precision_speed = p.precision_speed.clamp(1, 20);
        p.double_click_ms = p.double_click_ms.map(|d| d.clamp(200, 900));
        self.accessibility.large_pointer_size =
            self.accessibility.large_pointer_size.clamp(40, 240);
        self.presentation.size = self.presentation.size.clamp(8, 60);
    }

    fn validate(&self) -> Result<(), String> {
        for (name, c) in [
            ("effect color", &self.effects.color),
            ("pointer color", &self.accessibility.pointer_color),
            ("click color", &self.accessibility.click_color),
            ("laser color", &self.presentation.color),
        ] {
            if !valid_color(c) {
                return Err(format!("{name} must look like #rrggbb"));
            }
        }
        if self.gestures.button == Button::Left {
            return Err("the left button cannot be used for gestures".into());
        }
        if self.radial.button == Button::Left {
            return Err("the left button cannot open the radial menu".into());
        }
        if self.gestures.enabled
            && self.radial.enabled
            && self.gestures.button == self.radial.button
        {
            return Err("gestures and the radial menu need different buttons".into());
        }
        let mut seen = HashSet::new();
        for b in &self.gestures.bindings {
            if !valid_pattern(&b.pattern) {
                return Err(format!(
                    "\"{}\" is not a valid gesture (use U, D, L, R; up to 6)",
                    b.pattern
                ));
            }
            if !seen.insert(b.pattern.clone()) {
                return Err(format!("gesture \"{}\" is bound twice", b.pattern));
            }
            b.action.validate()?;
        }
        if self.radial.items.len() < 2 || self.radial.items.len() > 8 {
            return Err("the radial menu needs 2 to 8 items".into());
        }
        for i in &self.radial.items {
            i.action.validate()?;
        }
        for a in [
            &self.edges.top_left,
            &self.edges.top_right,
            &self.edges.bottom_left,
            &self.edges.bottom_right,
            &self.edges.top,
            &self.edges.bottom,
            &self.edges.left,
            &self.edges.right,
        ] {
            a.validate()?;
        }
        let mut seen = HashSet::new();
        for r in &self.remaps {
            if matches!(r.button, Button::Left | Button::Right) {
                return Err(
                    "only middle, X1 and X2 can be remapped (left and right stay safe)".into(),
                );
            }
            if self.gestures.enabled && r.button == self.gestures.button
                || self.radial.enabled && r.button == self.radial.button
            {
                return Err(format!(
                    "{:?} is already used by gestures or the radial menu",
                    r.button
                ));
            }
            if !seen.insert((r.button, r.clicks)) {
                return Err(format!("{:?} x{} is mapped twice", r.button, r.clicks));
            }
            r.action.validate()?;
        }
        Ok(())
    }
}

// --------------------------------------------------------------- profiles --

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Profile {
    pub id: String,
    pub name: String,
    /// Executable names (e.g. `valorant.exe`). When auto-switching is on, the
    /// profile applies while one of these has focus.
    pub apps: Vec<String>,
    pub behavior: Behavior,
}

impl Default for Profile {
    fn default() -> Self {
        Self {
            id: DEFAULT_PROFILE.into(),
            name: "Default".into(),
            apps: Vec::new(),
            behavior: Behavior::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Macro {
    pub id: String,
    pub name: String,
    pub steps: Vec<Action>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct General {
    /// Closing the window keeps MouseMore running in the tray.
    pub close_to_tray: bool,
    pub start_with_windows: bool,
    pub start_hidden: bool,
}

impl Default for General {
    fn default() -> Self {
        Self {
            close_to_tray: true,
            start_with_windows: false,
            start_hidden: false,
        }
    }
}

/// User settings. Everything is local; nothing here is ever transmitted.
///
/// Invasive behaviours default to **off**: no hook, overlay or gesture runs
/// until the user turns the corresponding feature on.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields, default)]
pub struct Settings {
    pub version: u32,
    /// Master switch. When false, MouseMore installs no hooks and runs no features.
    pub global_enabled: bool,
    /// Opt-in: installs a global mouse hook to show live input on the dashboard.
    pub live_monitor: bool,
    pub theme: Theme,
    pub reduce_motion: bool,
    pub active_profile: String,
    /// Switch profile automatically based on the focused application.
    pub auto_switch_profiles: bool,
    /// Most recently visited feature ids, newest first. Stored locally only.
    pub recent_features: Vec<String>,
    pub general: General,
    pub profiles: Vec<Profile>,
    pub macros: Vec<Macro>,
    /// Ids of installed plugins the user has enabled.
    pub plugins_enabled: Vec<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: SETTINGS_VERSION,
            global_enabled: true,
            live_monitor: false,
            theme: Theme::Dark,
            reduce_motion: false,
            active_profile: DEFAULT_PROFILE.to_owned(),
            auto_switch_profiles: false,
            recent_features: Vec::new(),
            general: General::default(),
            profiles: vec![Profile::default()],
            macros: Vec::new(),
            plugins_enabled: Vec::new(),
        }
    }
}

#[derive(Debug)]
pub enum SettingsError {
    Invalid(String),
    TooNew { found: u32, supported: u32 },
    VersionLocked,
}

impl fmt::Display for SettingsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Invalid(m) => write!(f, "invalid settings: {m}"),
            Self::TooNew { found, supported } => write!(
                f,
                "settings were written by a newer MouseMore (format {found}, this build supports {supported})"
            ),
            Self::VersionLocked => write!(f, "the settings version cannot be changed"),
        }
    }
}

impl std::error::Error for SettingsError {}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 32
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

impl Settings {
    /// Parse and validate settings from JSON (used by load and import).
    pub fn from_json(json: &str) -> Result<Self, SettingsError> {
        let s: Settings =
            serde_json::from_str(json).map_err(|e| SettingsError::Invalid(e.to_string()))?;
        if s.version > SETTINGS_VERSION {
            return Err(SettingsError::TooNew {
                found: s.version,
                supported: SETTINGS_VERSION,
            });
        }
        let mut s = s.finalize()?;
        s.version = SETTINGS_VERSION;
        Ok(s)
    }

    pub fn to_json_pretty(&self) -> String {
        serde_json::to_string_pretty(self).expect("settings are always serializable")
    }

    /// Merge a partial JSON object into a copy of these settings.
    /// Top-level keys are replaced wholesale (send the full `profiles` array).
    pub fn apply_patch(&self, patch: Value) -> Result<Self, SettingsError> {
        let Value::Object(fields) = patch else {
            return Err(SettingsError::Invalid("patch must be an object".into()));
        };
        if let Some(v) = fields.get("version") {
            if v != &Value::from(self.version) {
                return Err(SettingsError::VersionLocked);
            }
        }
        let mut current = serde_json::to_value(self).expect("settings are serializable");
        let obj = current
            .as_object_mut()
            .expect("settings serialize to an object");
        for (k, v) in fields {
            obj.insert(k, v);
        }
        let merged: Settings =
            serde_json::from_value(current).map_err(|e| SettingsError::Invalid(e.to_string()))?;
        merged.finalize()
    }

    /// Clamp ranges, repair structure, then validate.
    fn finalize(mut self) -> Result<Self, SettingsError> {
        let bad = |m: String| SettingsError::Invalid(m);

        // recents
        let mut seen = Vec::<String>::new();
        for id in self.recent_features.drain(..) {
            if !id.is_empty() && id.len() <= 64 && !seen.contains(&id) {
                seen.push(id);
            }
        }
        seen.truncate(MAX_RECENT);
        self.recent_features = seen;

        // profiles: unique valid ids, a default profile always present and first
        if self.profiles.len() > MAX_PROFILES {
            return Err(bad(format!("at most {MAX_PROFILES} profiles")));
        }
        let mut ids = HashSet::new();
        for p in &mut self.profiles {
            if !valid_id(&p.id) {
                return Err(bad(format!(
                    "profile id \"{}\" must be lowercase letters, digits or -",
                    p.id
                )));
            }
            if !ids.insert(p.id.clone()) {
                return Err(bad(format!("profile id \"{}\" is used twice", p.id)));
            }
            p.name = p.name.trim().chars().take(40).collect();
            if p.name.is_empty() {
                p.name = p.id.clone();
            }
            p.apps = p
                .apps
                .iter()
                .map(|a| a.trim().to_ascii_lowercase())
                .filter(|a| !a.is_empty() && a.len() <= 64 && !a.contains(['\\', '/']))
                .take(32)
                .collect();
            p.behavior.clamp();
            p.behavior
                .validate()
                .map_err(|m| bad(format!("profile \"{}\": {m}", p.name)))?;
        }
        if !ids.contains(DEFAULT_PROFILE) {
            self.profiles.insert(0, Profile::default());
        } else if let Some(pos) = self.profiles.iter().position(|p| p.id == DEFAULT_PROFILE) {
            let d = self.profiles.remove(pos);
            self.profiles.insert(0, d);
        }
        if !self.profiles.iter().any(|p| p.id == self.active_profile) {
            self.active_profile = DEFAULT_PROFILE.into();
        }

        // macros
        if self.macros.len() > MAX_MACROS {
            return Err(bad(format!("at most {MAX_MACROS} macros")));
        }
        let mut mids = HashSet::new();
        for m in &mut self.macros {
            if !valid_id(&m.id) {
                return Err(bad(format!(
                    "macro id \"{}\" must be lowercase letters, digits or -",
                    m.id
                )));
            }
            if !mids.insert(m.id.clone()) {
                return Err(bad(format!("macro id \"{}\" is used twice", m.id)));
            }
            m.name = m.name.trim().chars().take(40).collect();
            if m.steps.len() > MAX_STEPS {
                return Err(bad(format!(
                    "macro \"{}\" has more than {MAX_STEPS} steps",
                    m.name
                )));
            }
            for s in &m.steps {
                s.validate()
                    .map_err(|e| bad(format!("macro \"{}\": {e}", m.name)))?;
            }
        }
        self.plugins_enabled.truncate(64);
        Ok(self)
    }

    pub fn profile(&self, id: &str) -> Option<&Profile> {
        self.profiles.iter().find(|p| p.id == id)
    }

    /// The profile in force for the focused application.
    pub fn effective_profile(&self, foreground_exe: Option<&str>) -> &Profile {
        if self.auto_switch_profiles {
            if let Some(exe) = foreground_exe {
                let exe = exe.to_ascii_lowercase();
                if let Some(p) = self
                    .profiles
                    .iter()
                    .filter(|p| p.id != DEFAULT_PROFILE)
                    .find(|p| p.apps.contains(&exe))
                {
                    return p;
                }
            }
        }
        self.profile(&self.active_profile)
            .or_else(|| self.profile(DEFAULT_PROFILE))
            .expect("a default profile always exists")
    }

    /// Hook is needed when enabled and either the monitor or a feature wants it.
    pub fn hook_wanted(&self, behavior: &Behavior) -> bool {
        self.global_enabled && (self.live_monitor || behavior.needs_hook())
    }

    /// Every launch target in the settings; shown to the user before an import.
    pub fn launch_targets(&self) -> Vec<String> {
        fn collect(a: &Action, out: &mut Vec<String>) {
            match a {
                Action::Launch { target, args } => out.push(if args.is_empty() {
                    target.clone()
                } else {
                    format!("{target} {args}")
                }),
                Action::Plugin { plugin, action } => out.push(format!("plugin {plugin}/{action}")),
                _ => {}
            }
        }
        let mut out = Vec::new();
        for p in &self.profiles {
            let b = &p.behavior;
            b.gestures
                .bindings
                .iter()
                .for_each(|g| collect(&g.action, &mut out));
            b.radial
                .items
                .iter()
                .for_each(|i| collect(&i.action, &mut out));
            b.remaps.iter().for_each(|r| collect(&r.action, &mut out));
            for a in [
                &b.edges.top_left,
                &b.edges.top_right,
                &b.edges.bottom_left,
                &b.edges.bottom_right,
                &b.edges.top,
                &b.edges.bottom,
                &b.edges.left,
                &b.edges.right,
            ] {
                collect(a, &mut out);
            }
        }
        self.macros
            .iter()
            .flat_map(|m| m.steps.iter())
            .for_each(|a| collect(a, &mut out));
        out.sort();
        out.dedup();
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn defaults_are_non_invasive() {
        let s = Settings::default();
        assert!(s.global_enabled);
        assert!(!s.live_monitor, "global hook must be opt-in");
        let b = &s.effective_profile(None).behavior;
        assert!(!b.needs_hook(), "nothing may hook the mouse by default");
        assert!(!b.needs_overlay());
        assert!(!s.general.start_with_windows);
    }

    #[test]
    fn default_is_valid() {
        assert!(Settings::default().finalize().is_ok());
    }

    #[test]
    fn roundtrip() {
        let s = Settings::default();
        assert_eq!(Settings::from_json(&s.to_json_pretty()).unwrap(), s);
    }

    #[test]
    fn patch_merges_fields() {
        let s = Settings::default()
            .apply_patch(json!({"live_monitor": true, "theme": "light"}))
            .unwrap();
        assert!(s.live_monitor);
        assert_eq!(s.theme, Theme::Light);
        assert!(s.global_enabled);
    }

    #[test]
    fn patch_rejects_unknown_and_bad_types() {
        let s = Settings::default();
        assert!(s.apply_patch(json!({"nope": 1})).is_err());
        assert!(s.apply_patch(json!({"theme": "neon"})).is_err());
        assert!(s.apply_patch(json!({"live_monitor": "yes"})).is_err());
        assert!(s.apply_patch(json!([1])).is_err());
    }

    #[test]
    fn version_is_locked() {
        assert!(matches!(
            Settings::default().apply_patch(json!({"version": 99})),
            Err(SettingsError::VersionLocked)
        ));
    }

    #[test]
    fn newer_format_is_refused() {
        assert!(matches!(
            Settings::from_json(r#"{"version": 99}"#).unwrap_err(),
            SettingsError::TooNew { .. }
        ));
    }

    #[test]
    fn missing_fields_fall_back_to_defaults() {
        let s = Settings::from_json(r#"{"theme":"light"}"#).unwrap();
        assert_eq!(s.theme, Theme::Light);
        assert!(s.global_enabled);
        assert_eq!(s.profiles.len(), 1);
    }

    #[test]
    fn recents_are_deduped_and_capped() {
        let ids: Vec<String> = (0..10).map(|i| format!("f{}", i % 8)).collect();
        let s = Settings::default()
            .apply_patch(json!({ "recent_features": ids }))
            .unwrap();
        assert_eq!(s.recent_features.len(), MAX_RECENT);
        let mut d = s.recent_features.clone();
        d.sort();
        d.dedup();
        assert_eq!(d.len(), s.recent_features.len());
    }

    fn with_default_behavior(f: impl FnOnce(&mut Behavior)) -> Value {
        let mut s = Settings::default();
        f(&mut s.profiles[0].behavior);
        json!({ "profiles": s.profiles })
    }

    #[test]
    fn numbers_are_clamped() {
        let s = Settings::default()
            .apply_patch(with_default_behavior(|b| {
                b.effects.trail_length = 250;
                b.effects.speed = 0;
                b.scroll.speed_percent = 5000;
                b.pointer.speed = Some(99);
                b.edges.dwell_ms = 1;
            }))
            .unwrap();
        let b = &s.profiles[0].behavior;
        assert_eq!(b.effects.trail_length, 60);
        assert_eq!(b.effects.speed, 25);
        assert_eq!(b.scroll.speed_percent, 400);
        assert_eq!(b.pointer.speed, Some(20));
        assert_eq!(b.edges.dwell_ms, 150);
    }

    #[test]
    fn rejects_bad_colors_patterns_and_actions() {
        let s = Settings::default();
        assert!(s
            .apply_patch(with_default_behavior(|b| b.effects.color = "red".into()))
            .is_err());
        assert!(s
            .apply_patch(with_default_behavior(
                |b| b.gestures.bindings[0].pattern = "XX".into()
            ))
            .is_err());
        assert!(s
            .apply_patch(with_default_behavior(
                |b| b.gestures.bindings[0].action = Action::keys("ctrl+nope")
            ))
            .is_err());
        assert!(
            s.apply_patch(with_default_behavior(
                |b| b.gestures.bindings[1].pattern = "L".into()
            ))
            .is_err(),
            "duplicate pattern"
        );
    }

    #[test]
    fn left_and_right_buttons_cannot_be_remapped() {
        let s = Settings::default();
        for btn in [Button::Left, Button::Right] {
            assert!(s
                .apply_patch(with_default_behavior(|b| b.remaps.push(Remap {
                    button: btn,
                    clicks: 1,
                    action: Action::keys("ctrl+c")
                })))
                .is_err());
        }
        assert!(s
            .apply_patch(with_default_behavior(|b| b.gestures.button = Button::Left))
            .is_err());
    }

    #[test]
    fn button_roles_cannot_collide() {
        let s = Settings::default();
        assert!(s
            .apply_patch(with_default_behavior(|b| {
                b.gestures.enabled = true;
                b.radial.enabled = true;
                b.radial.button = b.gestures.button;
            }))
            .is_err());
        assert!(s
            .apply_patch(with_default_behavior(|b| {
                b.radial.enabled = true;
                b.remaps.push(Remap {
                    button: Button::Middle,
                    clicks: 1,
                    action: Action::keys("ctrl+c"),
                });
            }))
            .is_err());
    }

    #[test]
    fn remaps_enable_the_hook() {
        let s = Settings::default()
            .apply_patch(with_default_behavior(|b| {
                b.remaps.push(Remap {
                    button: Button::X1,
                    clicks: 1,
                    action: Action::keys("ctrl+c"),
                })
            }))
            .unwrap();
        let b = &s.effective_profile(None).behavior;
        assert!(b.needs_hook());
        assert!(!b.needs_overlay());
        assert!(s.hook_wanted(b));
        let off = s.apply_patch(json!({"global_enabled": false})).unwrap();
        assert!(!off.hook_wanted(&off.effective_profile(None).behavior));
    }

    #[test]
    fn profiles_are_repaired_and_validated() {
        // missing default is re-created and put first
        let s = Settings::default()
            .apply_patch(json!({"profiles": [{"id": "game", "name": "Game", "apps": [" Game.EXE ", "a\\b.exe"]}]}))
            .unwrap();
        assert_eq!(s.profiles[0].id, DEFAULT_PROFILE);
        assert_eq!(s.profiles[1].apps, vec!["game.exe"]);
        // duplicate / invalid ids
        let dup = json!({"profiles": [{"id": "a"}, {"id": "a"}]});
        assert!(Settings::default().apply_patch(dup).is_err());
        assert!(Settings::default()
            .apply_patch(json!({"profiles": [{"id": "Bad Id"}]}))
            .is_err());
        // unknown active profile falls back
        let s = Settings::default()
            .apply_patch(json!({"active_profile": "ghost"}))
            .unwrap();
        assert_eq!(s.active_profile, DEFAULT_PROFILE);
    }

    #[test]
    fn auto_switch_picks_profile_by_app() {
        let s = Settings::default()
            .apply_patch(json!({
                "auto_switch_profiles": true,
                "profiles": [{"id": "default"}, {"id": "game", "name": "Game", "apps": ["game.exe"]}]
            }))
            .unwrap();
        assert_eq!(s.effective_profile(Some("GAME.exe")).id, "game");
        assert_eq!(s.effective_profile(Some("notepad.exe")).id, "default");
        assert_eq!(s.effective_profile(None).id, "default");
        let off = s
            .apply_patch(json!({"auto_switch_profiles": false}))
            .unwrap();
        assert_eq!(off.effective_profile(Some("game.exe")).id, "default");
    }

    #[test]
    fn macros_are_validated() {
        let s = Settings::default();
        let ok = json!({"macros": [{"id": "m1", "name": "Copy twice", "steps": [
            {"type": "keys", "combo": "ctrl+c"}, {"type": "delay", "ms": 100}]}]});
        assert!(s.apply_patch(ok).is_ok());
        let bad = json!({"macros": [{"id": "m1", "name": "x", "steps": [{"type": "keys", "combo": "ctrl+zzz"}]}]});
        assert!(s.apply_patch(bad).is_err());
        let long: Vec<Value> = (0..51).map(|_| json!({"type": "delay", "ms": 1})).collect();
        assert!(s
            .apply_patch(json!({"macros": [{"id": "m1", "name": "x", "steps": long}]}))
            .is_err());
    }

    #[test]
    fn launch_targets_are_listed_for_import_review() {
        let s = Settings::default()
            .apply_patch(with_default_behavior(|b| {
                b.edges.top = Action::Launch {
                    target: "calc.exe".into(),
                    args: String::new(),
                };
            }))
            .unwrap();
        assert_eq!(s.launch_targets(), vec!["calc.exe"]);
        assert!(Settings::default().launch_targets().is_empty());
    }
}
