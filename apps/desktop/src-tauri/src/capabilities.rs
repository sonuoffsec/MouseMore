//! Runtime capability detection. Statuses reflect what was actually probed
//! on this machine, or a documented platform limit, never optimism.

use mousemore_core::{Capability, Status};

use crate::devices::DeviceReport;
use crate::engine::EngineStatus;

pub fn detect(engine: &EngineStatus, devices: &DeviceReport, overlay_ready: bool) -> Vec<Capability> {
    let running = engine.engine_running;
    let c = |id: &str, name: &str, status: Status, detail: &str| Capability::new(id, name, status, detail);
    let mut caps = Vec::new();

    caps.push(c(
        "native-engine",
        "Native input engine",
        if running { Status::Supported } else { Status::Unsupported },
        if running {
            "The native event loop is running."
        } else {
            "No native backend exists for this operating system yet (Windows 10/11 only in this release)."
        },
    ));

    caps.push(Capability::new(
        "global-mouse-hook",
        "Global mouse hook",
        if !running || engine.hook_error.is_some() { Status::Unsupported } else { Status::Partial },
        match (&engine.hook_error, running) {
            (Some(e), _) => e.clone(),
            (None, true) => "Available, and only active while a feature that needs it is on. Windows does not deliver input from elevated (administrator) windows to a non-elevated app, so MouseMore cannot see or act on those unless it is run as administrator.".to_owned(),
            (None, false) => "Needs the native engine.".to_owned(),
        },
    ));

    caps.push(Capability::new(
        "emergency-stop",
        "Emergency stop hotkey",
        if engine.hotkey_registered { Status::Supported } else { Status::Unsupported },
        if engine.hotkey_registered {
            format!("{} toggles the global disable switch from anywhere and stops running macros.", engine.hotkey_label)
        } else {
            format!(
                "{} could not be registered (another application may be using it). Use the in-app switch or tray menu instead.",
                engine.hotkey_label
            )
        },
    ));

    caps.push(Capability::new(
        "tool-hotkeys",
        "Annotate and ruler hotkeys",
        if engine.tool_hotkeys_registered { Status::Supported } else { Status::Partial },
        if engine.tool_hotkeys_registered {
            format!("{} annotates, {} measures.", engine.annotate_hotkey_label, engine.ruler_hotkey_label)
        } else {
            "One of the tool shortcuts is taken by another app; both tools stay reachable from actions and the Creative Tools page.".to_owned()
        },
    ));

    caps.push(c(
        "overlay",
        "Overlay window (effects, tools)",
        if overlay_ready { Status::Supported } else { Status::Unsupported },
        if overlay_ready {
            "A transparent click-through window spans all monitors, and is shown only while something needs it. Exclusive full-screen games may draw over it; that is why effects pause for full-screen apps by default."
        } else {
            "The overlay window could not be created."
        },
    ));

    caps.push(c(
        "gestures",
        "Gestures, radial menu and button remapping",
        if running { Status::Supported } else { Status::Unsupported },
        "The chosen button is held back and replayed as a normal click when you do not draw a gesture, so a short press still clicks. Dragging with that button held (for example drag-select with the right button) is not possible while gestures use it.",
    ));

    caps.push(c(
        "app-profiles",
        "Per-application profiles",
        if running { Status::Supported } else { Status::Unsupported },
        "Matched by executable name of the focused window.",
    ));

    caps.push(c(
        "pointer-settings",
        "Pointer speed and double-click time",
        if cfg!(windows) { Status::Supported } else { Status::Unsupported },
        "Applied for the session and restored to your original values when you disable MouseMore or quit.",
    ));

    caps.push(Capability::new(
        "device-enumeration",
        "Pointing device detection",
        if devices.devices.is_empty() { Status::Partial } else { Status::Supported },
        devices
            .note
            .clone()
            .unwrap_or_else(|| format!("{} pointing device(s) reported by the OS.", devices.devices.len())),
    ));

    caps.push(c(
        "report-rate",
        "Report-rate estimate",
        Status::Partial,
        "MouseMore counts the movement reports it receives while you move the mouse and shows the peak. It is an estimate of what Windows delivers, not a hardware reading, and it cannot be changed from software.",
    ));

    caps.push(c(
        "battery",
        "Mouse battery level",
        Status::Unsupported,
        "Windows exposes no standard battery interface for generic mice. Only vendor software or some Bluetooth LE devices can report it; MouseMore will show it only if a device exposes it.",
    ));

    caps.push(c(
        "hardware-dpi",
        "Hardware DPI switching",
        Status::Unsupported,
        "There is no standard way to change a mouse's DPI from software; it needs the vendor's proprietary protocol. MouseMore will not claim otherwise. Software pointer-speed profiles are provided instead.",
    ));

    caps.push(c(
        "device-profiles",
        "Per-device profiles",
        Status::Unsupported,
        "The low-level mouse hook cannot tell which physical mouse produced an event. Use per-application profiles instead.",
    ));

    caps
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::{ANNOTATE_HOTKEY_LABEL, HOTKEY_LABEL, RULER_HOTKEY_LABEL};

    fn engine(running: bool, hotkey: bool, err: Option<&str>) -> EngineStatus {
        EngineStatus {
            engine_running: running,
            hook_installed: false,
            hook_error: err.map(str::to_owned),
            hotkey_registered: hotkey,
            hotkey_label: HOTKEY_LABEL,
            tool_hotkeys_registered: true,
            annotate_hotkey_label: ANNOTATE_HOTKEY_LABEL,
            ruler_hotkey_label: RULER_HOTKEY_LABEL,
        }
    }

    fn find<'a>(caps: &'a [Capability], id: &str) -> &'a Capability {
        caps.iter().find(|c| c.id == id).unwrap()
    }

    #[test]
    fn dead_engine_is_reported_unsupported() {
        let caps = detect(&engine(false, false, None), &DeviceReport::default(), true);
        assert_eq!(find(&caps, "native-engine").status, Status::Unsupported);
        assert_eq!(find(&caps, "global-mouse-hook").status, Status::Unsupported);
        assert_eq!(find(&caps, "gestures").status, Status::Unsupported);
    }

    #[test]
    fn hotkey_conflict_is_visible() {
        let caps = detect(&engine(true, false, None), &DeviceReport::default(), true);
        assert_eq!(find(&caps, "emergency-stop").status, Status::Unsupported);
    }

    #[test]
    fn hardware_claims_are_never_supported() {
        let caps = detect(&engine(true, true, None), &DeviceReport::default(), true);
        for id in ["hardware-dpi", "battery", "device-profiles"] {
            assert_eq!(find(&caps, id).status, Status::Unsupported, "{id}");
        }
        assert_ne!(find(&caps, "report-rate").status, Status::Supported, "rate is an estimate");
    }

    #[test]
    fn missing_overlay_is_reported() {
        let caps = detect(&engine(true, true, None), &DeviceReport::default(), false);
        assert_eq!(find(&caps, "overlay").status, Status::Unsupported);
    }
}
