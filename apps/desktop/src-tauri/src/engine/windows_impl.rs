//! Windows engine thread: owns the low-level mouse hook, the global hotkeys and the
//! foreground-window watcher, and forwards events to the dispatcher over a channel.
//! The hook callback must stay tiny: classify, read the static `Policy`, send, return.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::{Arc, Mutex, OnceLock, RwLock};
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use mousemore_core::Button;
use windows::Win32::Foundation::{HINSTANCE, HMODULE, HWND, LPARAM, LRESULT, WPARAM};
use windows::Win32::System::Threading::GetCurrentThreadId;
use windows::Win32::UI::Accessibility::{SetWinEventHook, UnhookWinEvent, HWINEVENTHOOK};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    RegisterHotKey, UnregisterHotKey, MOD_ALT, MOD_CONTROL, MOD_NOREPEAT, MOD_SHIFT,
};
use windows::Win32::UI::WindowsAndMessaging::{
    CallNextHookEx, GetMessageW, PeekMessageW, PostThreadMessageW, SetWindowsHookExW,
    UnhookWindowsHookEx, HHOOK, MSG, MSLLHOOKSTRUCT, PM_NOREMOVE, WH_MOUSE_LL, WM_HOTKEY,
    WM_LBUTTONDOWN, WM_LBUTTONUP, WM_MBUTTONDOWN, WM_MBUTTONUP, WM_MOUSEHWHEEL, WM_MOUSEMOVE,
    WM_MOUSEWHEEL, WM_QUIT, WM_RBUTTONDOWN, WM_RBUTTONUP, WM_USER, WM_XBUTTONDOWN, WM_XBUTTONUP,
};

use super::{
    EmergencyCallback, EngineStatus, Hotkey, Input, InputSink, Policy, ANNOTATE_HOTKEY_LABEL,
    HOTKEY_LABEL, RULER_HOTKEY_LABEL,
};
use crate::platform;

const MSG_SET_HOOK: u32 = WM_USER + 1;
const MSG_SET_FG: u32 = WM_USER + 2;
const HK_EMERGENCY: i32 = 0x4D01;
const HK_ANNOTATE: i32 = 0x4D02;
const HK_RULER: i32 = 0x4D03;
const ACK_TIMEOUT: Duration = Duration::from_secs(2);
const LLMHF_INJECTED: u32 = 0x01;
const EVENT_SYSTEM_FOREGROUND: u32 = 0x0003;
const WINEVENT_OUTOFCONTEXT: u32 = 0x0000;

// The hook procedure has no user-data pointer, so its state must be static.
static SINK: OnceLock<InputSink> = OnceLock::new();
/// Debug builds only (env `MOUSEMORE_TEST_INPUT`): treat other programs' injected
/// input as real, so automated UI tests can drive the hook. Never set in release builds.
static ACCEPT_INJECTED: AtomicBool = AtomicBool::new(false);
static START: OnceLock<Instant> = OnceLock::new();
static POLICY: RwLock<Policy> = RwLock::new(Policy {
    trap: [false; Button::COUNT],
    wheel_rewrite: false,
    send_moves: false,
});
/// Buttons whose press we swallowed, so the matching release is swallowed too.
static SWALLOWED: [AtomicBool; Button::COUNT] = [
    AtomicBool::new(false),
    AtomicBool::new(false),
    AtomicBool::new(false),
    AtomicBool::new(false),
    AtomicBool::new(false),
];

fn emit(i: Input) {
    if let Some(s) = SINK.get() {
        s(i);
    }
}

fn policy() -> Policy {
    // A poisoned lock must never take the hook down: fall back to "do nothing".
    POLICY.read().map(|p| *p).unwrap_or_default()
}

/// Must stay fast: Windows removes slow low-level hooks. It only reads a small
/// policy and forwards through a non-blocking channel.
unsafe extern "system" fn mouse_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code >= 0 {
        let info = &*(lparam.0 as *const MSLLHOOKSTRUCT);
        // Events we synthesised ourselves are never reprocessed; other injected
        // input is ignored too, except in the debug-only test mode.
        let ours = info.dwExtraInfo == platform::MM_TAG;
        let injected = info.flags & LLMHF_INJECTED != 0;
        if !ours && (!injected || ACCEPT_INJECTED.load(Ordering::Relaxed)) {
            let (x, y) = (info.pt.x, info.pt.y);
            let msg = wparam.0 as u32;
            let hi = (info.mouseData >> 16) & 0xFFFF;
            let button = match msg {
                WM_LBUTTONDOWN | WM_LBUTTONUP => Some((Button::Left, msg == WM_LBUTTONDOWN)),
                WM_RBUTTONDOWN | WM_RBUTTONUP => Some((Button::Right, msg == WM_RBUTTONDOWN)),
                WM_MBUTTONDOWN | WM_MBUTTONUP => Some((Button::Middle, msg == WM_MBUTTONDOWN)),
                WM_XBUTTONDOWN | WM_XBUTTONUP => Some((
                    if hi == 1 { Button::X1 } else { Button::X2 },
                    msg == WM_XBUTTONDOWN,
                )),
                _ => None,
            };
            if let Some((b, down)) = button {
                let trap = policy().trap[b.index()];
                if down {
                    if trap {
                        SWALLOWED[b.index()].store(true, Ordering::Relaxed);
                    }
                    emit(Input::Button {
                        button: b,
                        down,
                        x,
                        y,
                        swallowed: trap,
                    });
                    if trap {
                        return LRESULT(1);
                    }
                } else {
                    let was = SWALLOWED[b.index()].swap(false, Ordering::Relaxed);
                    emit(Input::Button {
                        button: b,
                        down,
                        x,
                        y,
                        swallowed: was,
                    });
                    if was {
                        return LRESULT(1);
                    }
                }
            } else if msg == WM_MOUSEMOVE {
                if policy().send_moves {
                    let t_us = START.get_or_init(Instant::now).elapsed().as_micros() as u64;
                    emit(Input::Move { x, y, t_us });
                }
            } else if msg == WM_MOUSEWHEEL || msg == WM_MOUSEHWHEEL {
                let p = policy();
                let delta = (info.mouseData >> 16) as u16 as i16 as i32;
                emit(Input::Wheel {
                    delta,
                    horizontal: msg == WM_MOUSEHWHEEL,
                    x,
                    y,
                    swallowed: p.wheel_rewrite,
                });
                if p.wheel_rewrite {
                    return LRESULT(1);
                }
            }
        }
    }
    CallNextHookEx(HHOOK::default(), code, wparam, lparam)
}

unsafe extern "system" fn foreground_proc(
    _hook: HWINEVENTHOOK,
    _event: u32,
    _hwnd: HWND,
    _id_object: i32,
    _id_child: i32,
    _thread: u32,
    _time: u32,
) {
    emit(Input::Foreground(platform::foreground()));
}

pub struct Engine {
    thread_id: u32,
    status: Arc<Mutex<EngineStatus>>,
    ack: Mutex<Receiver<()>>,
    handle: Mutex<Option<JoinHandle<()>>>,
}

impl Engine {
    pub fn start(sink: InputSink, on_emergency: EmergencyCallback) -> Engine {
        let _ = START.set(Instant::now());
        if cfg!(debug_assertions) && std::env::var_os("MOUSEMORE_TEST_INPUT").is_some() {
            ACCEPT_INJECTED.store(true, Ordering::Relaxed);
        }
        let _ = SINK.set(sink);
        let status = Arc::new(Mutex::new(EngineStatus {
            engine_running: false,
            hook_installed: false,
            hook_error: None,
            hotkey_registered: false,
            hotkey_label: HOTKEY_LABEL,
            tool_hotkeys_registered: false,
            annotate_hotkey_label: ANNOTATE_HOTKEY_LABEL,
            ruler_hotkey_label: RULER_HOTKEY_LABEL,
        }));
        let (ready_tx, ready_rx) = mpsc::channel::<u32>();
        let (ack_tx, ack_rx) = mpsc::channel::<()>();
        let thread_status = Arc::clone(&status);
        let handle = thread::Builder::new()
            .name("mousemore-engine".into())
            .spawn(move || engine_thread(ready_tx, ack_tx, thread_status, on_emergency))
            .expect("spawn engine thread");
        let thread_id = ready_rx.recv().unwrap_or(0);
        Engine {
            thread_id,
            status,
            ack: Mutex::new(ack_rx),
            handle: Mutex::new(Some(handle)),
        }
    }

    pub fn set_policy(&self, p: Policy) {
        if let Ok(mut w) = POLICY.write() {
            *w = p;
        }
    }

    pub fn set_hook(&self, on: bool) {
        if self.thread_id == 0 {
            return;
        }
        let ack = self.ack.lock().unwrap();
        while ack.try_recv().is_ok() {} // drop stale acks
        let posted = unsafe {
            PostThreadMessageW(self.thread_id, MSG_SET_HOOK, WPARAM(on as usize), LPARAM(0))
        };
        if posted.is_ok() {
            let _ = ack.recv_timeout(ACK_TIMEOUT);
        }
    }

    pub fn set_foreground_watch(&self, on: bool) {
        if self.thread_id != 0 {
            unsafe {
                let _ =
                    PostThreadMessageW(self.thread_id, MSG_SET_FG, WPARAM(on as usize), LPARAM(0));
            }
        }
    }

    pub fn status(&self) -> EngineStatus {
        self.status.lock().unwrap().clone()
    }

    pub fn shutdown(&self) {
        if self.thread_id != 0 {
            unsafe {
                let _ = PostThreadMessageW(self.thread_id, WM_QUIT, WPARAM(0), LPARAM(0));
            }
        }
        if let Some(h) = self.handle.lock().unwrap().take() {
            let _ = h.join();
        }
    }
}

fn engine_thread(
    ready: Sender<u32>,
    ack: Sender<()>,
    status: Arc<Mutex<EngineStatus>>,
    on_emergency: EmergencyCallback,
) {
    unsafe {
        // Touch the message queue so PostThreadMessage from other threads works.
        let mut msg = MSG::default();
        let _ = PeekMessageW(&mut msg, None, WM_USER, WM_USER, PM_NOREMOVE);

        let mods = MOD_CONTROL | MOD_ALT | MOD_SHIFT | MOD_NOREPEAT;
        let emergency = RegisterHotKey(None, HK_EMERGENCY, mods, 0x4D).is_ok(); // M
        let annotate = RegisterHotKey(None, HK_ANNOTATE, mods, 0x44).is_ok(); // D
        let ruler = RegisterHotKey(None, HK_RULER, mods, 0x52).is_ok(); // R
        {
            let mut s = status.lock().unwrap();
            s.engine_running = true;
            s.hotkey_registered = emergency;
            s.tool_hotkeys_registered = annotate && ruler;
        }
        let _ = ready.send(GetCurrentThreadId());

        let mut hook: Option<HHOOK> = None;
        let mut fg_hook: Option<HWINEVENTHOOK> = None;
        while GetMessageW(&mut msg, None, 0, 0).0 > 0 {
            match msg.message {
                WM_HOTKEY => match msg.wParam.0 as i32 {
                    HK_EMERGENCY => on_emergency(),
                    HK_ANNOTATE => emit(Input::Hotkey(Hotkey::Annotate)),
                    HK_RULER => emit(Input::Hotkey(Hotkey::Ruler)),
                    _ => {}
                },
                MSG_SET_HOOK => {
                    let want = msg.wParam.0 != 0;
                    if want && hook.is_none() {
                        match SetWindowsHookExW(
                            WH_MOUSE_LL,
                            Some(mouse_proc),
                            HINSTANCE::default(),
                            0,
                        ) {
                            Ok(h) => {
                                hook = Some(h);
                                let mut s = status.lock().unwrap();
                                s.hook_installed = true;
                                s.hook_error = None;
                            }
                            Err(e) => {
                                let mut s = status.lock().unwrap();
                                s.hook_installed = false;
                                s.hook_error = Some(format!("Windows refused the mouse hook: {e}"));
                            }
                        }
                    } else if !want {
                        if let Some(h) = hook.take() {
                            let _ = UnhookWindowsHookEx(h);
                        }
                        for s in &SWALLOWED {
                            s.store(false, Ordering::Relaxed);
                        }
                        let mut s = status.lock().unwrap();
                        s.hook_installed = false;
                        s.hook_error = None;
                    }
                    let _ = ack.send(());
                }
                MSG_SET_FG => {
                    let want = msg.wParam.0 != 0;
                    if want && fg_hook.is_none() {
                        let h = SetWinEventHook(
                            EVENT_SYSTEM_FOREGROUND,
                            EVENT_SYSTEM_FOREGROUND,
                            HMODULE::default(),
                            Some(foreground_proc),
                            0,
                            0,
                            WINEVENT_OUTOFCONTEXT,
                        );
                        if !h.is_invalid() {
                            fg_hook = Some(h);
                            emit(Input::Foreground(platform::foreground()));
                        }
                    } else if !want {
                        if let Some(h) = fg_hook.take() {
                            let _ = UnhookWinEvent(h);
                        }
                    }
                }
                _ => {}
            }
        }

        if let Some(h) = hook.take() {
            let _ = UnhookWindowsHookEx(h);
        }
        if let Some(h) = fg_hook.take() {
            let _ = UnhookWinEvent(h);
        }
        for id in [HK_EMERGENCY, HK_ANNOTATE, HK_RULER] {
            let _ = UnregisterHotKey(None, id);
        }
        let mut s = status.lock().unwrap();
        s.engine_running = false;
        s.hook_installed = false;
        s.hotkey_registered = false;
        s.tool_hotkeys_registered = false;
    }
}
