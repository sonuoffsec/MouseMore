//! Ready-to-use starting points. Applying one replaces the *active profile's*
//! behaviour; the user can then tweak anything.

use crate::action::{Action, Button, SystemOp};
use crate::settings::{Behavior, ColorMode, Modifier, Remap};

pub struct Preset {
    pub id: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub behavior: fn() -> Behavior,
}

fn minimal() -> Behavior {
    Behavior::default()
}

fn showcase() -> Behavior {
    let mut b = Behavior::default();
    b.effects.trail = true;
    b.effects.click_ripple = true;
    b.effects.glow = true;
    b.effects.color_mode = ColorMode::Rainbow;
    b
}

fn presenter() -> Behavior {
    let mut b = Behavior::default();
    b.presentation.laser = true;
    b.effects.click_ripple = true;
    b.effects.color = "#ff3b30".into();
    b.accessibility.click_visual = false;
    b
}

fn accessibility() -> Behavior {
    let mut b = Behavior::default();
    b.accessibility.large_pointer = true;
    b.accessibility.click_visual = true;
    b.gestures.shake_locate = true;
    b.pointer.speed = Some(6);
    b
}

fn productivity() -> Behavior {
    let mut b = Behavior::default();
    b.gestures.enabled = true;
    b.gestures.shake_locate = true;
    b.edges.enabled = true;
    b.radial.enabled = true;
    b.remaps = vec![
        Remap {
            button: Button::X1,
            clicks: 1,
            action: Action::keys("alt+left"),
        },
        Remap {
            button: Button::X2,
            clicks: 1,
            action: Action::keys("alt+right"),
        },
    ];
    b.scroll.horizontal_modifier = Modifier::Shift;
    b
}

fn gaming() -> Behavior {
    // Everything quiet: no overlay, no gestures, no scroll rewriting.
    Behavior {
        remaps: vec![
            Remap {
                button: Button::X1,
                clicks: 1,
                action: Action::System {
                    op: SystemOp::VolumeDown,
                },
            },
            Remap {
                button: Button::X2,
                clicks: 1,
                action: Action::System {
                    op: SystemOp::VolumeUp,
                },
            },
        ],
        ..Behavior::default()
    }
}

pub const PRESETS: &[Preset] = &[
    Preset { id: "minimal", name: "Minimal", description: "Everything off. A clean slate.", behavior: minimal },
    Preset { id: "showcase", name: "Showcase", description: "Rainbow trail, click ripples and a soft glow.", behavior: showcase },
    Preset { id: "presenter", name: "Presenter", description: "Red laser pointer with click ripples.", behavior: presenter },
    Preset { id: "accessibility", name: "Easy to see", description: "Large high-contrast pointer, click feedback, shake to locate, slower pointer.", behavior: accessibility },
    Preset { id: "productivity", name: "Productivity", description: "Gestures, radial menu, corner triggers, back/forward side buttons, Shift+wheel scrolls sideways.", behavior: productivity },
    Preset { id: "gaming", name: "Gaming", description: "No overlay or gestures; side buttons control volume. Pair it with a per-game profile.", behavior: gaming },
];

pub fn find(id: &str) -> Option<&'static Preset> {
    PRESETS.iter().find(|p| p.id == id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::Settings;
    use serde_json::json;

    #[test]
    fn every_preset_passes_validation() {
        for p in PRESETS {
            let mut s = Settings::default();
            s.profiles[0].behavior = (p.behavior)();
            let patch = json!({ "profiles": s.profiles });
            Settings::default()
                .apply_patch(patch)
                .unwrap_or_else(|e| panic!("preset {} invalid: {e}", p.id));
        }
    }

    #[test]
    fn gaming_preset_is_quiet() {
        let b = (find("gaming").unwrap().behavior)();
        assert!(!b.needs_overlay());
        assert!(!b.gestures.enabled && !b.radial.enabled);
    }

    #[test]
    fn ids_are_unique() {
        let mut ids: Vec<_> = PRESETS.iter().map(|p| p.id).collect();
        ids.sort();
        ids.dedup();
        assert_eq!(ids.len(), PRESETS.len());
    }
}
