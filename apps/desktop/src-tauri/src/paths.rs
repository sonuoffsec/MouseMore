//! Where settings live: next to the executable when a `portable.flag` file exists,
//! otherwise in the per-user app data folder.

use std::path::PathBuf;

use tauri::{AppHandle, Manager};

#[derive(Debug, Clone)]
pub struct ConfigLocation {
    pub dir: PathBuf,
    pub portable: bool,
}

/// Portable mode: a `portable.flag` file next to the executable makes
/// MouseMore keep its data in `<exe dir>/data` and nowhere else.
/// Otherwise the per-user config directory is used.
pub fn resolve(app: &AppHandle) -> Result<ConfigLocation, String> {
    if let Some(exe_dir) = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()))
    {
        if exe_dir.join("portable.flag").exists() {
            return Ok(ConfigLocation {
                dir: exe_dir.join("data"),
                portable: true,
            });
        }
    }
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("cannot resolve config directory: {e}"))?;
    Ok(ConfigLocation {
        dir,
        portable: false,
    })
}
