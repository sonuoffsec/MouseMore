//! Crate root of the desktop app: shared state (`AppState`), the Tauri commands the UI calls,
//! and `apply_runtime()`, the one function that decides what is hooked, trapped, shown or changed.
//! Start with docs/ARCHITECTURE.md for how the threads fit together.

mod actions;
mod autostart;
mod capabilities;
mod devices;
mod dispatch;
mod engine;
mod overlay;
mod paths;
mod platform;
mod plugins;
mod tools;
mod tray;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Sender;
use std::sync::{Arc, Mutex};

use mousemore_core::action::{Action, Button, ToggleKind, ToolKind};
use mousemore_core::gesture::Rect;
use mousemore_core::{presets, Behavior, Capability, Settings, Store};
use serde::Serialize;
use serde_json::json;
use tauri::{AppHandle, Emitter, Manager, RunEvent, State, WindowEvent};

use dispatch::{Msg, RuntimeConfig};
use engine::{Engine, EngineStatus, Policy};
use platform::Foreground;
use plugins::{PluginAction, PluginInfo};

/// Session-only switches (never saved), toggled from actions or the UI.
#[derive(Debug, Clone, Default, Serialize, PartialEq)]
pub struct RuntimeFlags {
    pub effects_off: bool,
    pub gestures_off: bool,
    pub precision: bool,
}

pub struct AppState {
    settings: Mutex<Settings>,
    store: Store,
    engine: Engine,
    portable: bool,
    plugin_dir: PathBuf,
    /// One-time message for the UI (e.g. a corrupt settings file was set aside).
    notice: Mutex<Option<String>>,
    dispatch: Sender<Msg>,
    foreground: Mutex<Foreground>,
    flags: Mutex<RuntimeFlags>,
    pub tool: Mutex<Option<ToolKind>>,
    sysparams: Mutex<platform::SystemParams>,
    plugins: Mutex<Vec<(PluginInfo, Vec<PluginAction>)>>,
    runtime: Mutex<Arc<RuntimeConfig>>,
    overlay_ready: AtomicBool,
    tray_ready: AtomicBool,
}

#[derive(Serialize, Clone)]
struct PlatformInfo {
    os: &'static str,
    portable: bool,
    config_path: String,
    plugin_dir: String,
    app_version: &'static str,
    virtual_screen: Rect,
}

#[derive(Serialize, Clone)]
struct RuntimeInfo {
    effective_profile: String,
    foreground: Foreground,
    flags: RuntimeFlags,
    tool: Option<ToolKind>,
    overlay_visible: bool,
    hook_wanted: bool,
    /// The behaviour actually in force (profile + session switches).
    behavior: Behavior,
}

#[derive(Serialize, Clone)]
struct Snapshot {
    settings: Settings,
    engine: EngineStatus,
    platform: PlatformInfo,
    runtime: RuntimeInfo,
    notice: Option<String>,
}

fn effective_behavior(s: &Settings, fg: &Foreground, flags: &RuntimeFlags) -> (String, Behavior) {
    let profile = s.effective_profile(fg.exe.as_deref());
    let mut b = profile.behavior.clone();
    if flags.effects_off {
        let e = &mut b.effects;
        e.trail = false;
        e.click_ripple = false;
        e.click_burst = false;
        e.glow = false;
        e.spotlight = false;
    }
    if flags.gestures_off {
        b.gestures.enabled = false;
        b.gestures.shake_locate = false;
        b.radial.enabled = false;
        b.edges.enabled = false;
    }
    (profile.id.clone(), b)
}

fn snapshot(state: &AppState) -> Snapshot {
    let settings = state.settings.lock().unwrap().clone();
    let fg = state.foreground.lock().unwrap().clone();
    let flags = state.flags.lock().unwrap().clone();
    let tool = *state.tool.lock().unwrap();
    let (profile_id, behavior) = effective_behavior(&settings, &fg, &flags);
    let cfg = state.runtime.lock().unwrap().clone();
    Snapshot {
        runtime: RuntimeInfo {
            effective_profile: profile_id,
            foreground: fg,
            flags,
            tool,
            overlay_visible: cfg.overlay_visible,
            hook_wanted: settings.hook_wanted(&behavior),
            behavior,
        },
        engine: state.engine.status(),
        platform: PlatformInfo {
            os: std::env::consts::OS,
            portable: state.portable,
            config_path: state.store.path().display().to_string(),
            plugin_dir: state.plugin_dir.display().to_string(),
            app_version: env!("CARGO_PKG_VERSION"),
            virtual_screen: platform::virtual_screen(),
        },
        notice: state.notice.lock().unwrap().clone(),
        settings,
    }
}

fn policy_for(b: &Behavior, live_monitor: bool) -> Policy {
    let mut p = Policy::default();
    if b.gestures.enabled {
        p.trap[b.gestures.button.index()] = true;
    }
    if b.radial.enabled {
        p.trap[b.radial.button.index()] = true;
    }
    for r in &b.remaps {
        p.trap[r.button.index()] = true;
    }
    // The left button is never held back, whatever the settings say.
    p.trap[Button::Left.index()] = false;
    p.wheel_rewrite = b.scroll.active();
    p.send_moves = live_monitor
        || b.effects.any()
        || b.gestures.enabled
        || b.gestures.shake_locate
        || b.radial.enabled
        || b.edges.enabled
        || b.accessibility.large_pointer
        || b.presentation.laser;
    p
}

/// The one place that decides what is hooked, trapped, shown or changed.
/// Call it after anything that could alter the answer.
pub fn apply_runtime(app: &AppHandle) {
    let st = app.state::<AppState>();
    let s = st.settings.lock().unwrap().clone();
    let flags = st.flags.lock().unwrap().clone();
    let tool = *st.tool.lock().unwrap();
    let on = s.global_enabled;

    let fg = st.foreground.lock().unwrap().clone();
    let (_, behavior) = effective_behavior(&s, &fg, &flags);

    let overlay_wanted = on && behavior.needs_overlay();
    let watch = on && (s.auto_switch_profiles || overlay_wanted);
    if !watch {
        *st.foreground.lock().unwrap() = Foreground::default();
    }
    let fullscreen_block = watch && fg.fullscreen && behavior.effects.disable_in_fullscreen;
    let tool_active = on && tool.is_some();
    let overlay_visible = (overlay_wanted && !fullscreen_block) || tool_active;

    let hook = s.hook_wanted(&behavior);
    let policy = if hook {
        policy_for(&behavior, s.live_monitor)
    } else {
        Policy::default()
    };

    // OS pointer settings: applied only while enabled, restored otherwise.
    {
        let (speed, dbl) = if on {
            (
                if flags.precision {
                    Some(behavior.pointer.precision_speed)
                } else {
                    behavior.pointer.speed
                },
                behavior.pointer.double_click_ms,
            )
        } else {
            (None, None)
        };
        st.sysparams.lock().unwrap().apply(speed, dbl);
    }

    let plugin_actions: Vec<PluginAction> = st
        .plugins
        .lock()
        .unwrap()
        .iter()
        .filter(|(info, _)| info.error.is_none() && s.plugins_enabled.contains(&info.id))
        .flat_map(|(_, a)| a.iter().cloned())
        .collect();
    let cfg = Arc::new(RuntimeConfig {
        behavior,
        macros: s.macros.clone(),
        plugins: plugin_actions,
        live_monitor: on && s.live_monitor,
        overlay_visible,
    });
    *st.runtime.lock().unwrap() = Arc::clone(&cfg);

    // Order matters: the dispatcher learns the new rules before the hook
    // starts (or stops) holding buttons back.
    let _ = st.dispatch.send(Msg::Config(cfg));
    st.engine.set_policy(policy);
    st.engine.set_hook(hook);
    st.engine.set_foreground_watch(watch);
    overlay::apply(app, overlay_visible, tool_active);
    tray::sync(app, on);
    // Keep the native title bar in step with the app theme. Only touch the
    // window when the theme really changed: re-applying it redraws the frame,
    // which shows up as a flicker.
    {
        static LAST_THEME: Mutex<Option<mousemore_core::Theme>> = Mutex::new(None);
        let mut last = LAST_THEME.lock().unwrap();
        if *last != Some(s.theme) {
            *last = Some(s.theme);
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_theme(match s.theme {
                    mousemore_core::Theme::Dark => Some(tauri::Theme::Dark),
                    mousemore_core::Theme::Light => Some(tauri::Theme::Light),
                    mousemore_core::Theme::System => None,
                });
            }
        }
    }
    let _ = app.emit("state-changed", snapshot(&st));
}

/// Persist `new`, make it current, and bring the whole runtime in line with it.
fn commit(app: &AppHandle, state: &AppState, new: Settings) -> Result<Snapshot, String> {
    let old = state.settings.lock().unwrap().clone();
    if new.general.start_with_windows != old.general.start_with_windows {
        autostart::set(new.general.start_with_windows)?;
    }
    state
        .store
        .save(&new)
        .map_err(|e| format!("could not save settings: {e}"))?;
    let enabled = new.global_enabled;
    *state.settings.lock().unwrap() = new;
    if !enabled {
        actions::stop_all_macros();
        *state.tool.lock().unwrap() = None;
    }
    apply_runtime(app);
    Ok(snapshot(state))
}

/// Used by actions, the tray and the emergency hotkey.
pub fn toggle(app: &AppHandle, kind: ToggleKind) {
    let st = app.state::<AppState>();
    match kind {
        ToggleKind::Global => {
            let mut next = st.settings.lock().unwrap().clone();
            next.global_enabled = !next.global_enabled;
            if let Err(e) = commit(app, &st, next) {
                let _ = app.emit_to("main", "action-error", e);
            }
        }
        ToggleKind::Effects | ToggleKind::Gestures | ToggleKind::Precision => {
            {
                let mut f = st.flags.lock().unwrap();
                match kind {
                    ToggleKind::Effects => f.effects_off = !f.effects_off,
                    ToggleKind::Gestures => f.gestures_off = !f.gestures_off,
                    _ => f.precision = !f.precision,
                }
            }
            apply_runtime(app);
        }
    }
}

/// The focused application changed (from the engine's foreground watcher).
pub fn on_foreground(app: &AppHandle, fg: Foreground) {
    let st = app.state::<AppState>();
    let (before_profile, before_fs) = {
        let s = st.settings.lock().unwrap();
        let cur = st.foreground.lock().unwrap();
        (
            s.effective_profile(cur.exe.as_deref()).id.clone(),
            cur.fullscreen,
        )
    };
    let (after_profile, after_fs) = {
        let s = st.settings.lock().unwrap();
        (
            s.effective_profile(fg.exe.as_deref()).id.clone(),
            fg.fullscreen,
        )
    };
    *st.foreground.lock().unwrap() = fg;
    if before_profile != after_profile || before_fs != after_fs {
        apply_runtime(app);
    }
}

// ------------------------------------------------------------- commands ----

#[tauri::command]
fn get_snapshot(state: State<'_, AppState>) -> Snapshot {
    snapshot(&state)
}

#[tauri::command]
fn update_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    patch: serde_json::Value,
) -> Result<Snapshot, String> {
    let current = state.settings.lock().unwrap().clone();
    let next = current.apply_patch(patch).map_err(|e| e.to_string())?;
    commit(&app, &state, next)
}

#[tauri::command]
fn reset_settings(app: AppHandle, state: State<'_, AppState>) -> Result<Snapshot, String> {
    commit(&app, &state, Settings::default())
}

#[tauri::command]
fn export_settings(state: State<'_, AppState>) -> String {
    state.settings.lock().unwrap().to_json_pretty()
}

#[derive(Serialize)]
struct ImportPreview {
    profiles: usize,
    macros: usize,
    /// Programs/links the imported settings can open. The UI shows these and
    /// asks for confirmation before importing.
    launch_targets: Vec<String>,
}

#[tauri::command]
fn inspect_import(json: String) -> Result<ImportPreview, String> {
    let s = Settings::from_json(&json).map_err(|e| e.to_string())?;
    Ok(ImportPreview {
        profiles: s.profiles.len(),
        macros: s.macros.len(),
        launch_targets: s.launch_targets(),
    })
}

#[tauri::command]
fn import_settings(
    app: AppHandle,
    state: State<'_, AppState>,
    json: String,
) -> Result<Snapshot, String> {
    let imported = Settings::from_json(&json).map_err(|e| e.to_string())?;
    commit(&app, &state, imported)
}

#[tauri::command]
fn dismiss_notice(state: State<'_, AppState>) {
    *state.notice.lock().unwrap() = None;
}

#[tauri::command]
fn get_devices() -> devices::DeviceReport {
    devices::detect()
}

#[tauri::command]
fn get_capabilities(state: State<'_, AppState>) -> Vec<Capability> {
    capabilities::detect(
        &state.engine.status(),
        &devices::detect(),
        state.overlay_ready.load(Ordering::Relaxed),
    )
}

#[derive(Serialize)]
struct PresetInfo {
    id: &'static str,
    name: &'static str,
    description: &'static str,
}

#[tauri::command]
fn list_presets() -> Vec<PresetInfo> {
    presets::PRESETS
        .iter()
        .map(|p| PresetInfo {
            id: p.id,
            name: p.name,
            description: p.description,
        })
        .collect()
}

#[tauri::command]
fn apply_preset(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Snapshot, String> {
    let preset = presets::find(&id).ok_or("unknown preset")?;
    let mut s = state.settings.lock().unwrap().clone();
    let active = s.active_profile.clone();
    let p = s
        .profiles
        .iter_mut()
        .find(|p| p.id == active)
        .ok_or("no active profile")?;
    p.behavior = (preset.behavior)();
    let next = Settings::default()
        .apply_patch(json!({ "profiles": s.profiles }))
        .map(|validated| Settings {
            profiles: validated.profiles,
            ..s
        })
        .map_err(|e| e.to_string())?;
    commit(&app, &state, next)
}

#[tauri::command]
fn list_plugins(state: State<'_, AppState>) -> Vec<PluginInfo> {
    let found = plugins::scan(&state.plugin_dir);
    let infos = found.iter().map(|(i, _)| i.clone()).collect();
    *state.plugins.lock().unwrap() = found;
    infos
}

#[tauri::command]
fn end_tool(app: AppHandle) {
    tools::set(&app, None);
}

#[tauri::command]
fn record_gesture(state: State<'_, AppState>, on: bool) {
    let _ = state.dispatch.send(Msg::Record(on));
}

/// Run an action now, on request (the "Test" buttons in the UI).
#[tauri::command]
fn run_action(app: AppHandle, state: State<'_, AppState>, action: Action) -> Result<(), String> {
    action.validate()?;
    let cfg = state.runtime.lock().unwrap().clone();
    std::thread::spawn(move || actions::run_top(&app, &cfg, &action));
    Ok(())
}

#[tauri::command]
fn toggle_runtime(app: AppHandle, what: ToggleKind) {
    toggle(&app, what);
}

/// Emergency stop for running macros (also triggered by the global hotkey).
#[tauri::command]
fn stop_macros() {
    actions::stop_all_macros();
}

#[tauri::command]
fn running_apps() -> Vec<String> {
    platform::running_apps()
}

#[tauri::command]
fn open_config_folder(state: State<'_, AppState>) -> Result<(), String> {
    let dir = state
        .store
        .path()
        .parent()
        .ok_or("no folder")?
        .to_path_buf();
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    platform::launch(&dir.to_string_lossy(), "")
}

// ----------------------------------------------------------------- run ----

pub fn run() {
    if !platform::single_instance() {
        eprintln!("MouseMore is already running.");
        return;
    }
    let app = tauri::Builder::default()
        .setup(|app| {
            let location = paths::resolve(app.handle())?;
            let store = Store::new(&location.dir);
            let loaded = store.load();
            let notice = loaded.recovered_from.map(|p| {
                format!(
                    "Your settings file could not be read, so defaults were loaded. The original was kept at {}.",
                    p.display()
                )
            });
            let settings = loaded.settings;
            let plugin_dir = location.dir.join("plugins");

            let initial = Arc::new(RuntimeConfig {
                behavior: Behavior::default(),
                macros: Vec::new(),
                plugins: Vec::new(),
                live_monitor: false,
                overlay_visible: false,
            });
            let tx = dispatch::spawn(app.handle().clone(), Arc::clone(&initial));

            let sink: engine::InputSink = Arc::new({
                let tx = tx.clone();
                move |i| {
                    let _ = tx.send(Msg::Input(i));
                }
            });
            // Runs on the engine thread, so the real work happens elsewhere to
            // avoid that thread waiting on itself.
            let on_emergency: engine::EmergencyCallback = Arc::new({
                let handle = app.handle().clone();
                move || {
                    actions::stop_all_macros();
                    let handle = handle.clone();
                    std::thread::spawn(move || toggle(&handle, ToggleKind::Global));
                }
            });
            let engine = Engine::start(sink, on_emergency);

            let enabled = settings.global_enabled;
            let hidden = settings.general.start_hidden || std::env::args().any(|a| a == "--minimized");
            app.manage(AppState {
                settings: Mutex::new(settings),
                store,
                engine,
                portable: location.portable,
                plugin_dir: plugin_dir.clone(),
                notice: Mutex::new(notice),
                dispatch: tx,
                foreground: Mutex::new(Foreground::default()),
                flags: Mutex::new(RuntimeFlags::default()),
                tool: Mutex::new(None),
                sysparams: Mutex::new(platform::SystemParams::default()),
                plugins: Mutex::new(plugins::scan(&plugin_dir)),
                runtime: Mutex::new(initial),
                overlay_ready: AtomicBool::new(false),
                tray_ready: AtomicBool::new(false),
            });

            let st = app.state::<AppState>();
            st.overlay_ready.store(overlay::create(app.handle()).is_ok(), Ordering::Relaxed);
            st.tray_ready.store(tray::build(app.handle(), enabled).is_ok(), Ordering::Relaxed);
            if hidden && st.tray_ready.load(Ordering::Relaxed) {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.hide();
                }
            }
            apply_runtime(app.handle());
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if window.label() != "main" {
                    return;
                }
                let app = window.app_handle();
                let st = app.state::<AppState>();
                let to_tray = st.settings.lock().unwrap().general.close_to_tray && st.tray_ready.load(Ordering::Relaxed);
                if to_tray {
                    api.prevent_close();
                    let _ = window.hide();
                } else {
                    app.exit(0);
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            update_settings,
            reset_settings,
            export_settings,
            inspect_import,
            import_settings,
            dismiss_notice,
            get_devices,
            get_capabilities,
            list_presets,
            apply_preset,
            list_plugins,
            end_tool,
            record_gesture,
            run_action,
            toggle_runtime,
            running_apps,
            stop_macros,
            open_config_folder,
        ])
        .build(tauri::generate_context!())
        .expect("error while building MouseMore");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = handle.try_state::<AppState>() {
                actions::stop_all_macros();
                let _ = state.dispatch.send(Msg::Shutdown);
                state.engine.shutdown();
                // Give the user's pointer settings back.
                state.sysparams.lock().unwrap().restore();
            }
        }
    });
}
