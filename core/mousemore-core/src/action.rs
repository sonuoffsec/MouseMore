//! User-configurable actions. Everything MouseMore can *do* in response to a
//! gesture, button, corner or macro step is one of these, so it is all visible
//! and editable in the UI. Nothing runs that the user did not configure.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Button {
    Left,
    Right,
    Middle,
    X1,
    X2,
}

impl Button {
    pub const COUNT: usize = 5;
    pub fn index(self) -> usize {
        self as usize
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WindowOp {
    Minimize,
    MaximizeToggle,
    Restore,
    Close,
    SnapLeft,
    SnapRight,
    MoveToNextMonitor,
    MoveToPrevMonitor,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SystemOp {
    Screenshot,
    ScreenRecord,
    ClipboardHistory,
    TaskView,
    ShowDesktop,
    SwitchApp,
    VolumeUp,
    VolumeDown,
    VolumeMute,
    MediaPlayPause,
    MediaNext,
    MediaPrev,
    Magnifier,
    PointerSettings,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Cycle {
    Next,
    Prev,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToolKind {
    Annotate,
    Ruler,
    ClearAnnotations,
    LocatePointer,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ToggleKind {
    Global,
    Effects,
    Gestures,
    Precision,
}

pub const DEFAULT_SEARCH_URL: &str = "https://www.google.com/search?q={q}";

fn default_search() -> String {
    DEFAULT_SEARCH_URL.to_owned()
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Action {
    #[default]
    None,
    Keys {
        combo: String,
    },
    Launch {
        target: String,
        #[serde(default)]
        args: String,
    },
    Window {
        op: WindowOp,
    },
    System {
        op: SystemOp,
    },
    SearchSelected {
        #[serde(default = "default_search")]
        url: String,
    },
    PointerToMonitor {
        which: Cycle,
    },
    MouseClick {
        button: Button,
        #[serde(default)]
        double: bool,
    },
    Tool {
        tool: ToolKind,
    },
    Toggle {
        what: ToggleKind,
    },
    Macro {
        id: String,
    },
    Plugin {
        plugin: String,
        action: String,
    },
    Delay {
        ms: u32,
    },
}

impl Action {
    pub fn is_none(&self) -> bool {
        matches!(self, Action::None)
    }

    pub fn keys(combo: &str) -> Action {
        Action::Keys {
            combo: combo.to_owned(),
        }
    }

    /// Reject anything that could not be executed safely or meaningfully.
    pub fn validate(&self) -> Result<(), String> {
        match self {
            Action::Keys { combo } => parse_combo(combo).map(|_| ()),
            Action::Launch { target, args } => {
                if target.trim().is_empty() {
                    return Err("launch target is empty".into());
                }
                if target.len() > 512 || args.len() > 512 {
                    return Err("launch target or arguments are too long".into());
                }
                if target.chars().chain(args.chars()).any(|c| c.is_control()) {
                    return Err("launch target contains control characters".into());
                }
                Ok(())
            }
            Action::SearchSelected { url } => {
                if url.starts_with("https://") && url.contains("{q}") && url.len() <= 256 {
                    Ok(())
                } else {
                    Err("search URL must start with https:// and contain {q}".into())
                }
            }
            Action::Macro { id } | Action::Plugin { plugin: id, .. } => {
                if id.is_empty() || id.len() > 64 {
                    Err("missing macro/plugin id".into())
                } else {
                    Ok(())
                }
            }
            Action::Delay { ms } => {
                if *ms <= 10_000 {
                    Ok(())
                } else {
                    Err("delay is limited to 10 seconds".into())
                }
            }
            _ => Ok(()),
        }
    }

    /// Human-readable one-liner for UI lists and logs.
    pub fn describe(&self) -> String {
        match self {
            Action::None => "Do nothing".into(),
            Action::Keys { combo } => format!("Press {combo}"),
            Action::Launch { target, .. } => format!("Open {target}"),
            Action::Window { op } => format!("Window: {op:?}"),
            Action::System { op } => format!("System: {op:?}"),
            Action::SearchSelected { .. } => "Search selected text".into(),
            Action::PointerToMonitor { which } => format!("Pointer to {which:?} monitor"),
            Action::MouseClick { button, double } => {
                format!("{}{button:?} click", if *double { "Double " } else { "" })
            }
            Action::Tool { tool } => format!("Tool: {tool:?}"),
            Action::Toggle { what } => format!("Toggle {what:?}"),
            Action::Macro { id } => format!("Macro {id}"),
            Action::Plugin { plugin, action } => format!("Plugin {plugin}/{action}"),
            Action::Delay { ms } => format!("Wait {ms} ms"),
        }
    }
}

pub const VK_CONTROL: u16 = 0xA2;
pub const VK_MENU: u16 = 0xA4;
pub const VK_SHIFT: u16 = 0xA0;
pub const VK_LWIN: u16 = 0x5B;

/// Parse `ctrl+alt+left` into an ordered list of virtual-key codes
/// (modifiers first). Case-insensitive.
pub fn parse_combo(combo: &str) -> Result<Vec<u16>, String> {
    let mut mods: Vec<u16> = Vec::new();
    let mut keys: Vec<u16> = Vec::new();
    for raw in combo.split('+') {
        let t = raw.trim().to_ascii_lowercase();
        if t.is_empty() {
            return Err(format!("empty key in \"{combo}\""));
        }
        let m = match t.as_str() {
            "ctrl" | "control" => Some(VK_CONTROL),
            "alt" => Some(VK_MENU),
            "shift" => Some(VK_SHIFT),
            "win" | "super" | "meta" => Some(VK_LWIN),
            _ => None,
        };
        if let Some(m) = m {
            if !mods.contains(&m) {
                mods.push(m);
            }
            continue;
        }
        let vk = match t.as_str() {
            "enter" | "return" => 0x0D,
            "esc" | "escape" => 0x1B,
            "tab" => 0x09,
            "space" => 0x20,
            "backspace" => 0x08,
            "delete" | "del" => 0x2E,
            "insert" | "ins" => 0x2D,
            "home" => 0x24,
            "end" => 0x23,
            "pageup" | "pgup" => 0x21,
            "pagedown" | "pgdn" => 0x22,
            "left" => 0x25,
            "up" => 0x26,
            "right" => 0x27,
            "down" => 0x28,
            "printscreen" | "prtsc" => 0x2C,
            "volumeup" => 0xAF,
            "volumedown" => 0xAE,
            "volumemute" => 0xAD,
            "playpause" => 0xB3,
            "nexttrack" => 0xB0,
            "prevtrack" => 0xB1,
            "plus" => 0xBB,
            "minus" => 0xBD,
            s if s.len() == 1 && s.as_bytes()[0].is_ascii_lowercase() => {
                s.as_bytes()[0].to_ascii_uppercase() as u16
            }
            s if s.len() == 1 && s.as_bytes()[0].is_ascii_digit() => s.as_bytes()[0] as u16,
            s if s.starts_with('f')
                && s[1..].parse::<u16>().is_ok_and(|n| (1..=24).contains(&n)) =>
            {
                0x70 + s[1..].parse::<u16>().unwrap() - 1
            }
            other => return Err(format!("unknown key \"{other}\"")),
        };
        keys.push(vk);
    }
    if keys.is_empty() {
        return Err(format!("\"{combo}\" has no non-modifier key"));
    }
    if keys.len() > 2 {
        return Err("at most two non-modifier keys are supported".into());
    }
    mods.extend(keys);
    Ok(mods)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_combos() {
        assert_eq!(parse_combo("ctrl+c").unwrap(), vec![VK_CONTROL, 0x43]);
        assert_eq!(parse_combo("Alt+Left").unwrap(), vec![VK_MENU, 0x25]);
        assert_eq!(
            parse_combo("ctrl+shift+F5").unwrap(),
            vec![VK_CONTROL, VK_SHIFT, 0x74]
        );
        assert_eq!(
            parse_combo("win+shift+s").unwrap(),
            vec![VK_LWIN, VK_SHIFT, 0x53]
        );
        assert_eq!(parse_combo("ctrl+1").unwrap(), vec![VK_CONTROL, 0x31]);
    }

    #[test]
    fn rejects_bad_combos() {
        assert!(parse_combo("").is_err());
        assert!(parse_combo("ctrl").is_err());
        assert!(parse_combo("ctrl+").is_err());
        assert!(parse_combo("ctrl+banana").is_err());
        assert!(parse_combo("f25").is_err());
    }

    #[test]
    fn action_json_shape() {
        let a: Action = serde_json::from_str(r#"{"type":"window","op":"snap_left"}"#).unwrap();
        assert_eq!(
            a,
            Action::Window {
                op: WindowOp::SnapLeft
            }
        );
        let b: Action = serde_json::from_str(r#"{"type":"search_selected"}"#).unwrap();
        assert!(matches!(b, Action::SearchSelected { .. }));
        assert!(serde_json::from_str::<Action>(r#"{"type":"format_disk"}"#).is_err());
    }

    #[test]
    fn validation() {
        assert!(Action::keys("ctrl+c").validate().is_ok());
        assert!(Action::keys("ctrl+nope").validate().is_err());
        assert!(Action::Launch {
            target: " ".into(),
            args: String::new()
        }
        .validate()
        .is_err());
        assert!(Action::Launch {
            target: "notepad.exe".into(),
            args: String::new()
        }
        .validate()
        .is_ok());
        assert!(Action::SearchSelected {
            url: "http://x/?q={q}".into()
        }
        .validate()
        .is_err());
        assert!(Action::SearchSelected {
            url: "https://x/?q={q}".into()
        }
        .validate()
        .is_ok());
        assert!(Action::Delay { ms: 20_000 }.validate().is_err());
    }
}
