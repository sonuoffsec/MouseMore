//! The transparent, click-through, always-on-top overlay that spans every
//! monitor. It is created once (hidden) and only shown while something needs
//! it, so an idle MouseMore draws nothing on screen.

use std::sync::Mutex;

use tauri::{
    AppHandle, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};

use crate::platform;

/// (visible, interactive) as last applied, to avoid redundant window calls.
static APPLIED: Mutex<(bool, bool)> = Mutex::new((false, false));

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let builder = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("overlay.html".into()))
        .title("MouseMore overlay")
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .resizable(false)
        .focused(false)
        .focusable(false)
        .visible(false);
    // The overlay never gets a user click, so allow the optional click sound to play.
    #[cfg(windows)]
    let builder = builder.additional_browser_args(
        "--autoplay-policy=no-user-gesture-required --disable-features=msWebOOUI,msPdfOOUI,msSmartScreenProtection",
    );
    let w = builder.build()?;
    let _ = w.set_ignore_cursor_events(true);
    Ok(())
}

fn fit(w: &WebviewWindow) {
    let vs = platform::virtual_screen();
    if vs.w > 0 && vs.h > 0 {
        let _ = w.set_position(PhysicalPosition::new(vs.x, vs.y));
        let _ = w.set_size(PhysicalSize::new(vs.w as u32, vs.h as u32));
    }
}

/// `interactive`: the overlay captures the mouse and keyboard (annotate/ruler).
pub fn apply(app: &AppHandle, visible: bool, interactive: bool) {
    let Some(w) = app.get_webview_window("overlay") else {
        return;
    };
    let mut last = APPLIED.lock().unwrap();
    if *last == (visible, interactive) {
        return;
    }
    *last = (visible, interactive);
    if visible {
        fit(&w);
        let _ = w.set_ignore_cursor_events(!interactive);
        let _ = w.set_focusable(interactive);
        let _ = w.show();
        if interactive {
            let _ = w.set_focus();
        }
    } else {
        let _ = w.hide();
    }
}
