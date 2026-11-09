//! The dispatcher thread: turns raw input into behaviour.
//!
//! It blocks on a channel (no polling). A timeout is only armed while a
//! multi-click or corner-dwell timer is pending.

use std::collections::HashMap;
use std::sync::mpsc::{self, RecvTimeoutError, Sender};
use std::sync::Arc;
use std::time::{Duration, Instant};

use mousemore_core::action::{Action, Button, ToolKind};
use mousemore_core::gesture::{radial_sector, zone_at, RateEstimator, Rect, ShakeDetector, StrokeRecognizer, Zone};
use mousemore_core::settings::{Behavior, Macro, Modifier};
use serde_json::json;
use tauri::{AppHandle, Emitter};

use crate::actions;
use crate::engine::{Hotkey, Input};
use crate::platform;
use crate::plugins::PluginAction;

/// Everything the dispatcher needs, swapped atomically on every change.
#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub behavior: Behavior,
    pub macros: Vec<Macro>,
    pub plugins: Vec<PluginAction>,
    pub live_monitor: bool,
    pub overlay_visible: bool,
}

pub enum Msg {
    Input(Input),
    Config(Arc<RuntimeConfig>),
    /// Capture the next drawn gesture instead of running it.
    Record(bool),
    Shutdown,
}

const MULTI_CLICK_MS: u64 = 250;
const FX_INTERVAL_MS: u128 = 16;
const MONITOR_INTERVAL_MS: u128 = 50;
const RADIAL_DEAD_ZONE: f64 = 28.0;
const EDGE_CORNER_PX: i32 = 24;

struct GestureSession {
    stroke: StrokeRecognizer,
}

struct RadialSession {
    cx: i32,
    cy: i32,
    hover: Option<usize>,
}

#[derive(Default)]
struct ClickState {
    count: u8,
    deadline: Option<Instant>,
}

struct ZoneState {
    zone: Zone,
    since: Instant,
    fired: bool,
}

struct Dispatcher {
    app: AppHandle,
    cfg: Arc<RuntimeConfig>,
    shake: ShakeDetector,
    gesture: Option<GestureSession>,
    radial: Option<RadialSession>,
    clicks: HashMap<Button, ClickState>,
    zone: Option<ZoneState>,
    vs: Rect,
    rate: RateEstimator,
    moves: u64,
    click_count: u64,
    wheel_count: u64,
    last_pos: (i32, i32),
    last_fx: Instant,
    last_monitor: Instant,
    record: bool,
    wheel_acc: [f64; 2],
    started: Instant,
}

pub fn spawn(app: AppHandle, initial: Arc<RuntimeConfig>) -> Sender<Msg> {
    let (tx, rx) = mpsc::channel::<Msg>();
    std::thread::Builder::new()
        .name("mousemore-dispatch".into())
        .spawn(move || {
            let now = Instant::now();
            let mut d = Dispatcher {
                app,
                shake: ShakeDetector::new(initial.behavior.gestures.shake_sensitivity),
                cfg: initial,
                gesture: None,
                radial: None,
                clicks: HashMap::new(),
                zone: None,
                vs: platform::virtual_screen(),
                rate: RateEstimator::default(),
                moves: 0,
                click_count: 0,
                wheel_count: 0,
                last_pos: (0, 0),
                last_fx: now,
                last_monitor: now,
                record: false,
                wheel_acc: [0.0; 2],
                started: now,
            };
            loop {
                let msg = match d.next_deadline() {
                    Some(at) => match rx.recv_timeout(at.saturating_duration_since(Instant::now())) {
                        Ok(m) => Some(m),
                        Err(RecvTimeoutError::Timeout) => None,
                        Err(RecvTimeoutError::Disconnected) => break,
                    },
                    None => match rx.recv() {
                        Ok(m) => Some(m),
                        Err(_) => break,
                    },
                };
                match msg {
                    Some(Msg::Input(i)) => d.input(i),
                    Some(Msg::Config(c)) => d.config(c),
                    Some(Msg::Record(on)) => d.record = on,
                    Some(Msg::Shutdown) => break,
                    None => {}
                }
                d.tick();
            }
        })
        .expect("spawn dispatcher thread");
    tx
}

impl Dispatcher {
    fn fx(&self, v: serde_json::Value) {
        let _ = self.app.emit_to("overlay", "fx", v);
    }

    fn run(&self, action: Action) {
        if action.is_none() {
            return;
        }
        let app = self.app.clone();
        let cfg = Arc::clone(&self.cfg);
        // Off-thread: some actions sleep (search) or run macros.
        std::thread::spawn(move || actions::run_top(&app, &cfg, &action));
    }

    fn replay_click(&self, b: Button) {
        let _ = platform::inject_button(b, true);
        let _ = platform::inject_button(b, false);
    }

    fn config(&mut self, c: Arc<RuntimeConfig>) {
        self.shake.set_sensitivity(c.behavior.gestures.shake_sensitivity);
        if c.live_monitor && !self.cfg.live_monitor {
            self.moves = 0;
            self.click_count = 0;
            self.wheel_count = 0;
            self.rate.reset();
        }
        self.vs = platform::virtual_screen();
        self.cfg = c;
        self.zone = None;
        self.clicks.clear();
        // Sessions belong to the old configuration.
        if self.gesture.take().is_some() {
            self.fx(json!({"k": "gesture", "s": "cancel"}));
        }
        if self.radial.take().is_some() {
            self.fx(json!({"k": "radial", "s": "close"}));
        }
    }

    fn input(&mut self, i: Input) {
        match i {
            Input::Move { x, y, t_us } => self.on_move(x, y, t_us),
            Input::Button { button, down, x, y, swallowed } => self.on_button(button, down, x, y, swallowed),
            Input::Wheel { delta, horizontal, x, y, swallowed } => self.on_wheel(delta, horizontal, x, y, swallowed),
            Input::Foreground(fg) => crate::on_foreground(&self.app, fg),
            Input::Hotkey(h) => crate::tools::run(
                &self.app,
                match h {
                    Hotkey::Annotate => ToolKind::Annotate,
                    Hotkey::Ruler => ToolKind::Ruler,
                },
            ),
        }
    }

    // ------------------------------------------------------------- move ---

    fn on_move(&mut self, x: i32, y: i32, t_us: u64) {
        self.moves += 1;
        self.rate.feed(t_us);
        self.last_pos = (x, y);
        let now = Instant::now();
        let t_ms = t_us / 1000;
        let b = &self.cfg.behavior;

        if let Some(g) = &mut self.gesture {
            g.stroke.push(x, y);
        }
        let mut hover_changed = None;
        if let Some(r) = &mut self.radial {
            let sector = radial_sector(
                (x - r.cx) as f64,
                (y - r.cy) as f64,
                b.radial.items.len(),
                RADIAL_DEAD_ZONE,
            );
            if sector != r.hover {
                r.hover = sector;
                hover_changed = Some(sector.map(|s| s as i64).unwrap_or(-1));
            }
        }
        if let Some(h) = hover_changed {
            self.fx(json!({"k": "radial", "s": "hover", "i": h}));
        }
        if b.gestures.shake_locate && self.shake.feed(x, t_ms) {
            self.fx(json!({"k": "locate", "x": x, "y": y}));
        }
        if b.edges.enabled {
            self.track_zone(x, y, now);
        }
        if self.cfg.overlay_visible && now.duration_since(self.last_fx).as_millis() >= FX_INTERVAL_MS {
            self.last_fx = now;
            self.fx(json!({"k": "move", "x": x, "y": y}));
        }
        self.emit_monitor("move", now, false);
    }

    fn track_zone(&mut self, x: i32, y: i32, now: Instant) {
        let z = zone_at(x, y, self.vs, EDGE_CORNER_PX);
        match (z, &mut self.zone) {
            (Some(z), Some(cur)) if cur.zone == z => {}
            (Some(z), _) => self.zone = Some(ZoneState { zone: z, since: now, fired: false }),
            (None, _) => self.zone = None,
        }
    }

    fn edge_action(&self, z: Zone) -> Action {
        let e = &self.cfg.behavior.edges;
        match z {
            Zone::TopLeft => e.top_left.clone(),
            Zone::TopRight => e.top_right.clone(),
            Zone::BottomLeft => e.bottom_left.clone(),
            Zone::BottomRight => e.bottom_right.clone(),
            Zone::Top => e.top.clone(),
            Zone::Bottom => e.bottom.clone(),
            Zone::Left => e.left.clone(),
            Zone::Right => e.right.clone(),
        }
    }

    // ----------------------------------------------------------- buttons ---

    fn remap_max(&self, b: Button) -> u8 {
        self.cfg.behavior.remaps.iter().filter(|r| r.button == b).map(|r| r.clicks).max().unwrap_or(0)
    }

    fn on_button(&mut self, b: Button, down: bool, x: i32, y: i32, swallowed: bool) {
        let now = Instant::now();
        if down {
            self.click_count += 1;
            if self.cfg.overlay_visible {
                self.fx(json!({"k": "click", "x": x, "y": y, "b": format!("{b:?}").to_lowercase()}));
            }
            self.emit_monitor(&format!("{b:?}").to_lowercase(), now, true);
        }
        let beh = &self.cfg.behavior;
        let is_gesture = beh.gestures.enabled && b == beh.gestures.button;
        let is_radial = beh.radial.enabled && b == beh.radial.button;
        let is_remap = self.remap_max(b) > 0;

        if is_gesture {
            if down {
                let mut stroke = StrokeRecognizer::new();
                stroke.push(x, y);
                self.gesture = Some(GestureSession { stroke });
                self.fx(json!({"k": "gesture", "s": "start", "x": x, "y": y}));
            } else if let Some(g) = self.gesture.take() {
                self.finish_gesture(b, g);
            } else if swallowed {
                self.replay_click(b);
            }
        } else if is_radial {
            if down {
                let labels: Vec<String> = beh.radial.items.iter().map(|i| i.label.clone()).collect();
                self.radial = Some(RadialSession { cx: x, cy: y, hover: None });
                self.fx(json!({"k": "radial", "s": "open", "x": x, "y": y, "items": labels}));
            } else if let Some(r) = self.radial.take() {
                self.fx(json!({"k": "radial", "s": "close"}));
                match r.hover.and_then(|i| beh.radial.items.get(i)) {
                    Some(item) => self.run(item.action.clone()),
                    None => self.replay_click(b),
                }
            } else if swallowed {
                self.replay_click(b);
            }
        } else if is_remap {
            if down {
                self.remap_press(b, now);
            }
        } else if swallowed {
            // The hook's policy was a moment out of date: pass the button through.
            let _ = platform::inject_button(b, down);
        }
    }

    fn finish_gesture(&mut self, b: Button, g: GestureSession) {
        let beh = &self.cfg.behavior;
        let len = g.stroke.path_length();
        let pattern = g.stroke.pattern();
        if len < beh.gestures.min_distance as f64 || pattern.is_empty() {
            self.fx(json!({"k": "gesture", "s": "cancel"}));
            self.replay_click(b);
            return;
        }
        if self.record {
            self.record = false;
            let _ = self.app.emit_to("main", "gesture-recorded", json!({"pattern": pattern}));
            self.fx(json!({"k": "gesture", "s": "end", "pattern": pattern, "matched": true, "label": "Recorded"}));
            return;
        }
        match beh.gestures.bindings.iter().find(|bd| bd.pattern == pattern) {
            Some(bd) if !bd.action.is_none() => {
                self.fx(json!({"k": "gesture", "s": "end", "pattern": pattern, "matched": true,
                               "label": bd.action.describe()}));
                self.run(bd.action.clone());
            }
            _ => self.fx(json!({"k": "gesture", "s": "end", "pattern": pattern, "matched": false, "label": "No match"})),
        }
    }

    fn remap_press(&mut self, b: Button, now: Instant) {
        let max = self.remap_max(b);
        let st = self.clicks.entry(b).or_default();
        st.count += 1;
        if max <= 1 || st.count >= max {
            let n = st.count;
            *st = ClickState::default();
            self.fire_remap(b, n);
        } else {
            st.deadline = Some(now + Duration::from_millis(MULTI_CLICK_MS));
        }
    }

    fn fire_remap(&self, b: Button, clicks: u8) {
        let best = self
            .cfg
            .behavior
            .remaps
            .iter()
            .filter(|r| r.button == b && r.clicks <= clicks)
            .max_by_key(|r| r.clicks);
        if let Some(r) = best {
            self.run(r.action.clone());
        }
    }

    // ------------------------------------------------------------ wheel ----

    fn on_wheel(&mut self, delta: i32, horizontal: bool, _x: i32, _y: i32, swallowed: bool) {
        self.wheel_count += 1;
        self.emit_monitor("wheel", Instant::now(), false);
        let s = &self.cfg.behavior.scroll;
        if !s.active() {
            if swallowed {
                let _ = platform::inject_wheel(delta, horizontal);
            }
            return;
        }
        let mut d = delta as f64 * s.speed_percent as f64 / 100.0;
        if s.reverse {
            d = -d;
        }
        let mut horiz = horizontal;
        if !horizontal && s.horizontal_modifier != Modifier::None && platform::modifier_down(s.horizontal_modifier) {
            horiz = true;
            d = -d; // wheel down scrolls right, like every other horizontal scroller
        }
        let axis = horiz as usize;
        self.wheel_acc[axis] += d;
        let whole = self.wheel_acc[axis].trunc();
        if whole != 0.0 {
            self.wheel_acc[axis] -= whole;
            let _ = platform::inject_wheel(whole as i32, horiz);
        }
    }

    // ----------------------------------------------------------- timers ----

    fn next_deadline(&self) -> Option<Instant> {
        let clicks = self.clicks.values().filter_map(|c| c.deadline).min();
        let edge = self.zone.as_ref().filter(|z| !z.fired && self.cfg.behavior.edges.enabled).map(|z| {
            z.since + Duration::from_millis(self.cfg.behavior.edges.dwell_ms as u64)
        });
        [clicks, edge].into_iter().flatten().min()
    }

    fn tick(&mut self) {
        let now = Instant::now();
        let due: Vec<(Button, u8)> = self
            .clicks
            .iter()
            .filter(|(_, c)| c.deadline.is_some_and(|d| d <= now))
            .map(|(b, c)| (*b, c.count))
            .collect();
        for (b, n) in due {
            self.clicks.remove(&b);
            self.fire_remap(b, n);
        }
        let dwell = Duration::from_millis(self.cfg.behavior.edges.dwell_ms as u64);
        if self.cfg.behavior.edges.enabled {
            let fire = match &mut self.zone {
                Some(z) if !z.fired && now.duration_since(z.since) >= dwell => {
                    z.fired = true;
                    Some(z.zone)
                }
                _ => None,
            };
            if let Some(z) = fire {
                let a = self.edge_action(z);
                self.run(a);
            }
        }
    }

    // --------------------------------------------------------- live feed ---

    fn emit_monitor(&mut self, kind: &str, now: Instant, force: bool) {
        if !self.cfg.live_monitor {
            return;
        }
        if !force && now.duration_since(self.last_monitor).as_millis() < MONITOR_INTERVAL_MS {
            return;
        }
        self.last_monitor = now;
        let _ = self.app.emit_to(
            "main",
            "mouse-activity",
            json!({
                "x": self.last_pos.0, "y": self.last_pos.1, "kind": kind,
                "moves": self.moves, "clicks": self.click_count, "wheel": self.wheel_count,
                "rate_hz": self.rate.peak_hz(),
                "uptime_s": self.started.elapsed().as_secs(),
            }),
        );
    }
}
