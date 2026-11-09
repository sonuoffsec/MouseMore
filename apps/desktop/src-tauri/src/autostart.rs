//! "Start with Windows": a per-user Run entry. Off by default, never touched
//! unless the user flips the setting, and removed again when they turn it off.

const KEY: &str = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE: &str = "MouseMore";

#[cfg(windows)]
pub fn set(enabled: bool) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let mut cmd = Command::new("reg");
    cmd.creation_flags(CREATE_NO_WINDOW);
    if enabled {
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let data = format!("\"{}\" --minimized", exe.display());
        cmd.args(["add", KEY, "/v", VALUE, "/t", "REG_SZ", "/d", &data, "/f"]);
    } else {
        cmd.args(["delete", KEY, "/v", VALUE, "/f"]);
    }
    let out = cmd.output().map_err(|e| format!("could not run reg.exe: {e}"))?;
    if out.status.success() || !enabled {
        // Deleting a value that is already gone is not an error.
        Ok(())
    } else {
        Err(format!("could not update startup entry: {}", String::from_utf8_lossy(&out.stderr).trim()))
    }
}

#[cfg(not(windows))]
pub fn set(enabled: bool) -> Result<(), String> {
    if enabled {
        Err("Start-with-system is not implemented on this operating system yet.".into())
    } else {
        Ok(())
    }
}
