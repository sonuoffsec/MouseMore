//! System tray: open, enable/disable, quit. Lets MouseMore keep working with
//! its window closed, and keeps the master switch one click away.

use std::sync::OnceLock;

use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, Wry};

static TOGGLE: OnceLock<CheckMenuItem<Wry>> = OnceLock::new();

pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

pub fn build(app: &AppHandle, enabled: bool) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open MouseMore", true, None::<&str>)?;
    let toggle = CheckMenuItem::with_id(app, "toggle", "Enabled", true, enabled, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit MouseMore", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[&open, &toggle, &PredefinedMenuItem::separator(app)?, &quit],
    )?;
    let _ = TOGGLE.set(toggle);

    let mut b = TrayIconBuilder::with_id("main")
        .tooltip("MouseMore")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_main(app),
            "toggle" => crate::toggle(app, mousemore_core::action::ToggleKind::Global),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        b = b.icon(icon.clone());
    }
    b.build(app)?;
    Ok(())
}

/// Keep the tray checkbox and tooltip in step with the real state.
pub fn sync(app: &AppHandle, enabled: bool) {
    if let Some(t) = TOGGLE.get() {
        let _ = t.set_checked(enabled);
    }
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_tooltip(Some(if enabled {
            "MouseMore"
        } else {
            "MouseMore (disabled)"
        }));
    }
}
