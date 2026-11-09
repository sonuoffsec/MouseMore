//! Win32 implementations behind `platform`: input injection, window and system actions,
//! monitors, clipboard search, pointer-speed overrides, single-instance lock.
//! Our own injected input is tagged with `MM_TAG` so the hook can ignore it.

use std::ffi::c_void;
use std::mem::size_of;
use std::thread::sleep;
use std::time::Duration;

use mousemore_core::action::{
    parse_combo, Button, Cycle, SystemOp, WindowOp, VK_CONTROL, VK_LWIN, VK_MENU, VK_SHIFT,
};
use mousemore_core::gesture::Rect;
use mousemore_core::settings::Modifier;
use windows::core::PCWSTR;
use windows::Win32::Foundation::{
    CloseHandle, GetLastError, BOOL, ERROR_ALREADY_EXISTS, HWND, LPARAM, POINT, RECT, WPARAM,
};
use windows::Win32::Graphics::Gdi::{
    EnumDisplayMonitors, GetMonitorInfoW, MonitorFromWindow, HDC, HMONITOR, MONITORINFO,
    MONITOR_DEFAULTTONEAREST,
};
use windows::Win32::System::DataExchange::{
    CloseClipboard, GetClipboardData, GetClipboardSequenceNumber, OpenClipboard,
};
use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};
use windows::Win32::System::Threading::{
    CreateMutexW, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    GetAsyncKeyState, GetDoubleClickTime, SendInput, SetDoubleClickTime, INPUT, INPUT_0,
    INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT, KEYBD_EVENT_FLAGS, KEYEVENTF_EXTENDEDKEY,
    KEYEVENTF_KEYUP, MOUSEEVENTF_HWHEEL, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
    MOUSEEVENTF_MIDDLEDOWN, MOUSEEVENTF_MIDDLEUP, MOUSEEVENTF_RIGHTDOWN, MOUSEEVENTF_RIGHTUP,
    MOUSEEVENTF_WHEEL, MOUSEEVENTF_XDOWN, MOUSEEVENTF_XUP, MOUSEINPUT, MOUSE_EVENT_FLAGS,
    VIRTUAL_KEY,
};
use windows::Win32::UI::Shell::ShellExecuteW;
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetCursorPos, GetForegroundWindow, GetSystemMetrics, GetWindowRect,
    GetWindowTextLengthW, GetWindowThreadProcessId, IsWindowVisible, IsZoomed, PostMessageW,
    SetCursorPos, ShowWindow, SystemParametersInfoW, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
    SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, SPI_GETMOUSESPEED, SPI_SETMOUSESPEED, SW_MAXIMIZE,
    SW_MINIMIZE, SW_RESTORE, SW_SHOWNORMAL, SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS, WM_CLOSE,
};

use super::{url_encode, Foreground};

/// Marks input MouseMore synthesised itself, so its own hook never reprocesses it.
pub const MM_TAG: usize = 0x4D4D_4D4D;

fn wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

// ------------------------------------------------------------- keyboard ----

fn is_extended(vk: u16) -> bool {
    matches!(vk, 0x21..=0x28 | 0x2D | 0x2E | 0x5B | 0x5C)
}

fn key_input(vk: u16, up: bool) -> INPUT {
    let mut flags = KEYBD_EVENT_FLAGS(0);
    if up {
        flags |= KEYEVENTF_KEYUP;
    }
    if is_extended(vk) {
        flags |= KEYEVENTF_EXTENDEDKEY;
    }
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(vk),
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: MM_TAG,
            },
        },
    }
}

fn send(inputs: &[INPUT]) -> Result<(), String> {
    let sent = unsafe { SendInput(inputs, size_of::<INPUT>() as i32) };
    if sent as usize == inputs.len() {
        Ok(())
    } else {
        Err("Windows blocked the simulated input (the active window may be running as administrator)".into())
    }
}

/// Press the keys of a combo (modifiers first) and release in reverse order.
pub fn send_combo(vks: &[u16]) -> Result<(), String> {
    let mut seq: Vec<INPUT> = vks.iter().map(|&v| key_input(v, false)).collect();
    seq.extend(vks.iter().rev().map(|&v| key_input(v, true)));
    send(&seq)
}

fn combo(s: &str) -> Result<(), String> {
    send_combo(&parse_combo(s)?)
}

// ---------------------------------------------------------------- mouse ----

fn mouse_input(flags: MOUSE_EVENT_FLAGS, data: u32) -> INPUT {
    INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: data,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: MM_TAG,
            },
        },
    }
}

fn button_flags(b: Button, down: bool) -> (MOUSE_EVENT_FLAGS, u32) {
    match (b, down) {
        (Button::Left, true) => (MOUSEEVENTF_LEFTDOWN, 0),
        (Button::Left, false) => (MOUSEEVENTF_LEFTUP, 0),
        (Button::Right, true) => (MOUSEEVENTF_RIGHTDOWN, 0),
        (Button::Right, false) => (MOUSEEVENTF_RIGHTUP, 0),
        (Button::Middle, true) => (MOUSEEVENTF_MIDDLEDOWN, 0),
        (Button::Middle, false) => (MOUSEEVENTF_MIDDLEUP, 0),
        (Button::X1, true) => (MOUSEEVENTF_XDOWN, 1),
        (Button::X1, false) => (MOUSEEVENTF_XUP, 1),
        (Button::X2, true) => (MOUSEEVENTF_XDOWN, 2),
        (Button::X2, false) => (MOUSEEVENTF_XUP, 2),
    }
}

pub fn inject_button(b: Button, down: bool) -> Result<(), String> {
    let (f, d) = button_flags(b, down);
    send(&[mouse_input(f, d)])
}

pub fn click(b: Button, double: bool) -> Result<(), String> {
    let mut seq = Vec::new();
    for _ in 0..if double { 2 } else { 1 } {
        for down in [true, false] {
            let (f, d) = button_flags(b, down);
            seq.push(mouse_input(f, d));
        }
    }
    send(&seq)
}

pub fn inject_wheel(delta: i32, horizontal: bool) -> Result<(), String> {
    let f = if horizontal {
        MOUSEEVENTF_HWHEEL
    } else {
        MOUSEEVENTF_WHEEL
    };
    send(&[mouse_input(f, delta as u32)])
}

pub fn modifier_down(m: Modifier) -> bool {
    let vk = match m {
        Modifier::None => return false,
        Modifier::Ctrl => VK_CONTROL,
        Modifier::Alt => VK_MENU,
        Modifier::Shift => VK_SHIFT,
    };
    // Use the generic virtual keys (0x11/0x12/0x10): the L/R variants above are for sending.
    let generic = match vk {
        VK_CONTROL => 0x11,
        VK_MENU => 0x12,
        _ => 0x10,
    };
    unsafe { (GetAsyncKeyState(generic) as u16) & 0x8000 != 0 }
}

pub fn cursor_pos() -> Option<(i32, i32)> {
    let mut p = POINT::default();
    unsafe { GetCursorPos(&mut p).ok().map(|_| (p.x, p.y)) }
}

pub fn virtual_screen() -> Rect {
    unsafe {
        Rect {
            x: GetSystemMetrics(SM_XVIRTUALSCREEN),
            y: GetSystemMetrics(SM_YVIRTUALSCREEN),
            w: GetSystemMetrics(SM_CXVIRTUALSCREEN),
            h: GetSystemMetrics(SM_CYVIRTUALSCREEN),
        }
    }
}

// -------------------------------------------------------------- monitors ---

unsafe extern "system" fn collect_monitor(
    _m: HMONITOR,
    _dc: HDC,
    rc: *mut RECT,
    data: LPARAM,
) -> BOOL {
    let list = &mut *(data.0 as *mut Vec<RECT>);
    list.push(*rc);
    BOOL(1)
}

fn monitors() -> Vec<RECT> {
    let mut list: Vec<RECT> = Vec::new();
    unsafe {
        let _ = EnumDisplayMonitors(
            None,
            None,
            Some(collect_monitor),
            LPARAM(&mut list as *mut _ as isize),
        );
    }
    list.sort_by_key(|r| (r.left, r.top));
    list
}

pub fn pointer_to_monitor(which: Cycle) -> Result<(), String> {
    let mons = monitors();
    if mons.len() < 2 {
        return Err("only one monitor is connected".into());
    }
    let (x, y) = cursor_pos().ok_or("cannot read the pointer position")?;
    let cur = mons
        .iter()
        .position(|r| x >= r.left && x < r.right && y >= r.top && y < r.bottom)
        .unwrap_or(0);
    let n = mons.len();
    let next = match which {
        Cycle::Next => (cur + 1) % n,
        Cycle::Prev => (cur + n - 1) % n,
    };
    let r = mons[next];
    unsafe {
        SetCursorPos((r.left + r.right) / 2, (r.top + r.bottom) / 2).map_err(|e| e.to_string())
    }
}

// --------------------------------------------------------------- windows ---

fn foreground_window() -> Result<HWND, String> {
    let h = unsafe { GetForegroundWindow() };
    if h.0.is_null() {
        Err("no active window".into())
    } else {
        Ok(h)
    }
}

pub fn window_op(op: WindowOp) -> Result<(), String> {
    match op {
        WindowOp::SnapLeft => return combo("win+left"),
        WindowOp::SnapRight => return combo("win+right"),
        WindowOp::MoveToNextMonitor => return combo("win+shift+right"),
        WindowOp::MoveToPrevMonitor => return combo("win+shift+left"),
        _ => {}
    }
    let h = foreground_window()?;
    unsafe {
        match op {
            WindowOp::Minimize => {
                let _ = ShowWindow(h, SW_MINIMIZE);
            }
            WindowOp::MaximizeToggle => {
                let _ = ShowWindow(
                    h,
                    if IsZoomed(h).as_bool() {
                        SW_RESTORE
                    } else {
                        SW_MAXIMIZE
                    },
                );
            }
            WindowOp::Restore => {
                let _ = ShowWindow(h, SW_RESTORE);
            }
            WindowOp::Close => {
                PostMessageW(h, WM_CLOSE, WPARAM(0), LPARAM(0)).map_err(|e| e.to_string())?;
            }
            _ => {}
        }
    }
    Ok(())
}

// ---------------------------------------------------------------- system ---

pub fn launch(target: &str, args: &str) -> Result<(), String> {
    let file = wide(target);
    let params = wide(args);
    let op = wide("open");
    let r = unsafe {
        ShellExecuteW(
            None,
            PCWSTR(op.as_ptr()),
            PCWSTR(file.as_ptr()),
            if args.is_empty() {
                PCWSTR::null()
            } else {
                PCWSTR(params.as_ptr())
            },
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    if r.0 as isize > 32 {
        Ok(())
    } else {
        Err(format!(
            "could not open \"{target}\" (Windows error {})",
            r.0 as isize
        ))
    }
}

pub fn system_op(op: SystemOp) -> Result<(), String> {
    match op {
        SystemOp::Screenshot => combo("win+shift+s"),
        SystemOp::ScreenRecord => combo("win+alt+r"),
        SystemOp::ClipboardHistory => combo("win+v"),
        SystemOp::TaskView => combo("win+tab"),
        SystemOp::ShowDesktop => combo("win+d"),
        SystemOp::SwitchApp => combo("alt+tab"),
        SystemOp::VolumeUp => combo("volumeup"),
        SystemOp::VolumeDown => combo("volumedown"),
        SystemOp::VolumeMute => combo("volumemute"),
        SystemOp::MediaPlayPause => combo("playpause"),
        SystemOp::MediaNext => combo("nexttrack"),
        SystemOp::MediaPrev => combo("prevtrack"),
        SystemOp::Magnifier => send_combo(&[VK_LWIN, 0xBB]),
        SystemOp::PointerSettings => launch("ms-settings:easeofaccess-mouse", ""),
    }
}

fn clipboard_text() -> Option<String> {
    unsafe {
        OpenClipboard(None).ok()?;
        let text = (|| {
            let h = GetClipboardData(13).ok()?; // CF_UNICODETEXT
            let p = GlobalLock(windows::Win32::Foundation::HGLOBAL(h.0)) as *const u16;
            if p.is_null() {
                return None;
            }
            let mut len = 0usize;
            while *p.add(len) != 0 && len < 4096 {
                len += 1;
            }
            let s = String::from_utf16_lossy(std::slice::from_raw_parts(p, len));
            let _ = GlobalUnlock(windows::Win32::Foundation::HGLOBAL(h.0));
            Some(s)
        })();
        let _ = CloseClipboard();
        text
    }
}

/// Copy the selection (Ctrl+C), then search for it. If nothing was copied
/// the clipboard is left exactly as it was.
pub fn search_selected(url_template: &str) -> Result<(), String> {
    let before = unsafe { GetClipboardSequenceNumber() };
    combo("ctrl+c")?;
    for _ in 0..10 {
        sleep(Duration::from_millis(40));
        if unsafe { GetClipboardSequenceNumber() } != before {
            break;
        }
    }
    if unsafe { GetClipboardSequenceNumber() } == before {
        return Err("nothing was selected".into());
    }
    let text = clipboard_text().ok_or("the selection was not text")?;
    let q: String = text.trim().chars().take(300).collect();
    if q.is_empty() {
        return Err("the selection was empty".into());
    }
    launch(&url_template.replace("{q}", &url_encode(&q)), "")
}

// ------------------------------------------------------ foreground info ----

pub fn exe_of(hwnd: HWND) -> Option<String> {
    unsafe {
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return None;
        }
        let h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 520];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(
            h,
            PROCESS_NAME_WIN32,
            windows::core::PWSTR(buf.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(h);
        ok.ok()?;
        let path = String::from_utf16_lossy(&buf[..len as usize]);
        path.rsplit(['\\', '/'])
            .next()
            .map(|s| s.to_ascii_lowercase())
    }
}

fn own_exe() -> Option<String> {
    use std::sync::OnceLock;
    static OWN: OnceLock<Option<String>> = OnceLock::new();
    OWN.get_or_init(|| {
        std::env::current_exe().ok().and_then(|p| {
            p.file_name()
                .map(|n| n.to_string_lossy().to_ascii_lowercase())
        })
    })
    .clone()
}

pub fn foreground() -> Foreground {
    unsafe {
        let h = GetForegroundWindow();
        if h.0.is_null() {
            return Foreground::default();
        }
        let exe = exe_of(h);
        // MouseMore's own windows never count as "the app in front". The overlay
        // covers the whole screen, so treating it as a full-screen app would hide
        // the overlay, change focus again, and flicker in an endless loop.
        if own_exe().is_some() && exe == own_exe() {
            return Foreground {
                exe,
                fullscreen: false,
            };
        }
        let mut rc = RECT::default();
        let mut fullscreen = false;
        if GetWindowRect(h, &mut rc).is_ok()
            && !IsZoomed(h).as_bool()
            && exe.as_deref() != Some("explorer.exe")
        {
            let mon = MonitorFromWindow(h, MONITOR_DEFAULTTONEAREST);
            let mut mi = MONITORINFO {
                cbSize: size_of::<MONITORINFO>() as u32,
                ..Default::default()
            };
            if GetMonitorInfoW(mon, &mut mi).as_bool() {
                let m = mi.rcMonitor;
                fullscreen = rc.left <= m.left
                    && rc.top <= m.top
                    && rc.right >= m.right
                    && rc.bottom >= m.bottom;
            }
        }
        Foreground { exe, fullscreen }
    }
}

// ----------------------------------------------------- pointer settings ----

/// Applies pointer speed / double-click time for the session and remembers the
/// user's original values so they are always put back (disable, quit).
#[derive(Default)]
pub struct SystemParams {
    orig_speed: Option<u32>,
    orig_dbl: Option<u32>,
}

fn get_speed() -> Option<u32> {
    let mut v = 0u32;
    unsafe {
        SystemParametersInfoW(
            SPI_GETMOUSESPEED,
            0,
            Some(&mut v as *mut u32 as *mut c_void),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        )
        .ok()?;
    }
    Some(v)
}

fn set_speed(v: u32) {
    unsafe {
        // fWinIni = 0: applies now without writing the user's saved setting.
        let _ = SystemParametersInfoW(
            SPI_SETMOUSESPEED,
            0,
            Some(v as usize as *mut c_void),
            SYSTEM_PARAMETERS_INFO_UPDATE_FLAGS(0),
        );
    }
}

impl SystemParams {
    pub fn apply(&mut self, speed: Option<u8>, double_click_ms: Option<u16>) {
        match speed {
            Some(s) => {
                if self.orig_speed.is_none() {
                    self.orig_speed = get_speed();
                }
                set_speed(s as u32);
            }
            None => self.restore_speed(),
        }
        match double_click_ms {
            Some(ms) => {
                if self.orig_dbl.is_none() {
                    self.orig_dbl = Some(unsafe { GetDoubleClickTime() });
                }
                unsafe {
                    let _ = SetDoubleClickTime(ms as u32);
                }
            }
            None => self.restore_dbl(),
        }
    }

    fn restore_speed(&mut self) {
        if let Some(v) = self.orig_speed.take() {
            set_speed(v);
        }
    }

    fn restore_dbl(&mut self) {
        if let Some(v) = self.orig_dbl.take() {
            unsafe {
                let _ = SetDoubleClickTime(v);
            }
        }
    }

    pub fn restore(&mut self) {
        self.restore_speed();
        self.restore_dbl();
    }
}

// ------------------------------------------------------------- process ----

/// True for the first MouseMore instance; false if one is already running.
pub fn single_instance() -> bool {
    let name = wide(r"Local\MouseMore.SingleInstance");
    unsafe {
        match CreateMutexW(None, false, PCWSTR(name.as_ptr())) {
            // The handle is intentionally kept open for the life of the process.
            Ok(_h) => GetLastError() != ERROR_ALREADY_EXISTS,
            Err(_) => true,
        }
    }
}

unsafe extern "system" fn collect_window(hwnd: HWND, data: LPARAM) -> BOOL {
    if IsWindowVisible(hwnd).as_bool() && GetWindowTextLengthW(hwnd) > 0 {
        if let Some(exe) = exe_of(hwnd) {
            (*(data.0 as *mut Vec<String>)).push(exe);
        }
    }
    BOOL(1)
}

/// Executables that currently own a visible window (for the profile app picker).
pub fn running_apps() -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    unsafe {
        let _ = EnumWindows(Some(collect_window), LPARAM(&mut out as *mut _ as isize));
    }
    out.retain(|e| e != "mousemore.exe");
    out.sort();
    out.dedup();
    out
}
