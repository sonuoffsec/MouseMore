//! Pure gesture logic (no OS calls): shake detection, stroke recognition,
//! radial sectors, screen-edge zones and a report-rate estimator.
//! Everything takes explicit timestamps so it is deterministic to test.

use std::collections::VecDeque;

/// Screen rectangle in physical pixels.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, serde::Serialize)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

// ---------------------------------------------------------------- shake ----

/// Detects a rapid left/right shake. Sensitivity 1 (hard to trigger) .. 10 (easy).
#[derive(Debug)]
pub struct ShakeDetector {
    required: usize,
    last_x: i32,
    dir: i32,
    run_start: i32,
    extreme: i32,
    reversals: VecDeque<u64>,
    cooldown_until: u64,
    primed: bool,
}

const SHAKE_WINDOW_MS: u64 = 700;
const SHAKE_MIN_SWING_PX: i32 = 40;
/// Movement against the current direction smaller than this is hand noise.
const SHAKE_NOISE_PX: i32 = 4;
const SHAKE_COOLDOWN_MS: u64 = 1500;

fn required_for(sensitivity: u8) -> usize {
    11 - (sensitivity.clamp(1, 10) as usize).min(8) // 10 -> 3 reversals ... 1 -> 10
}

impl ShakeDetector {
    pub fn new(sensitivity: u8) -> Self {
        Self {
            required: required_for(sensitivity),
            last_x: 0,
            dir: 0,
            run_start: 0,
            extreme: 0,
            reversals: VecDeque::new(),
            cooldown_until: 0,
            primed: false,
        }
    }

    pub fn set_sensitivity(&mut self, sensitivity: u8) {
        self.required = required_for(sensitivity);
    }

    /// Feed a pointer sample. Returns true once per shake.
    pub fn feed(&mut self, x: i32, t_ms: u64) -> bool {
        if !self.primed {
            self.primed = true;
            self.last_x = x;
            self.run_start = x;
            self.extreme = x;
            return false;
        }
        let dx = x - self.last_x;
        self.last_x = x;
        if dx == 0 {
            return false;
        }
        let d = dx.signum();
        if self.dir == 0 {
            self.dir = d;
            self.extreme = x;
            return false;
        }
        if d == self.dir {
            self.extreme = x;
            return false;
        }
        if (x - self.extreme).abs() < SHAKE_NOISE_PX {
            return false; // wobble, not a reversal
        }
        // A real reversal. It counts only if the swing just finished was big.
        let counted = (self.extreme - self.run_start).abs() >= SHAKE_MIN_SWING_PX;
        self.run_start = self.extreme;
        self.dir = d;
        self.extreme = x;
        if !counted {
            return false;
        }
        self.reversals.push_back(t_ms);
        while self.reversals.front().is_some_and(|&t| t_ms.saturating_sub(t) > SHAKE_WINDOW_MS) {
            self.reversals.pop_front();
        }
        if self.reversals.len() >= self.required && t_ms >= self.cooldown_until {
            self.reversals.clear();
            self.cooldown_until = t_ms + SHAKE_COOLDOWN_MS;
            return true;
        }
        false
    }
}

// --------------------------------------------------------------- stroke ----

/// Turns a pointer path into a direction string such as `"DR"` (U/D/L/R).
#[derive(Debug, Default)]
pub struct StrokeRecognizer {
    anchor: Option<(i32, i32)>,
    runs: Vec<(char, u32)>,
    length: f64,
    last: Option<(i32, i32)>,
}

const STROKE_STEP_PX: f64 = 24.0;
pub const MAX_PATTERN_LEN: usize = 6;

impl StrokeRecognizer {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn push(&mut self, x: i32, y: i32) {
        if let Some((lx, ly)) = self.last {
            self.length += (((x - lx) as f64).powi(2) + ((y - ly) as f64).powi(2)).sqrt();
        }
        self.last = Some((x, y));
        let Some((ax, ay)) = self.anchor else {
            self.anchor = Some((x, y));
            return;
        };
        let (dx, dy) = ((x - ax) as f64, (y - ay) as f64);
        if (dx * dx + dy * dy).sqrt() < STROKE_STEP_PX {
            return;
        }
        let dir = if dx.abs() > dy.abs() {
            if dx > 0.0 { 'R' } else { 'L' }
        } else if dy > 0.0 {
            'D'
        } else {
            'U'
        };
        self.anchor = Some((x, y));
        match self.runs.last_mut() {
            Some((c, n)) if *c == dir => *n += 1,
            _ => self.runs.push((dir, 1)),
        }
    }

    pub fn path_length(&self) -> f64 {
        self.length
    }

    /// The recognized pattern. One-step wobbles between longer runs are
    /// dropped, so a hand-drawn "R" is not read as "RDR".
    pub fn pattern(&self) -> String {
        let mut runs = self.runs.clone();
        if runs.len() > 1 {
            let filtered: Vec<(char, u32)> = runs
                .iter()
                .enumerate()
                .filter(|(i, (_, n))| *n >= 2 || *i == 0 || (*i == runs.len() - 1 && runs.len() <= 2))
                .map(|(_, r)| *r)
                .collect();
            if !filtered.is_empty() {
                runs = filtered;
            }
        }
        let mut out = String::new();
        for (c, _) in runs {
            if !out.ends_with(c) {
                out.push(c);
            }
        }
        out.truncate(MAX_PATTERN_LEN);
        out
    }
}

pub fn valid_pattern(p: &str) -> bool {
    !p.is_empty() && p.len() <= MAX_PATTERN_LEN && p.chars().all(|c| matches!(c, 'U' | 'D' | 'L' | 'R'))
}

// --------------------------------------------------------------- radial ----

/// Sector index (0 = straight up, clockwise) for a pointer offset from the
/// radial centre. `None` while inside the dead zone.
pub fn radial_sector(dx: f64, dy: f64, n: usize, dead_zone: f64) -> Option<usize> {
    if n == 0 || (dx * dx + dy * dy).sqrt() < dead_zone {
        return None;
    }
    let tau = std::f64::consts::TAU;
    // atan2(dx, -dy): 0 at top, increasing clockwise (screen y points down).
    let mut a = dx.atan2(-dy);
    if a < 0.0 {
        a += tau;
    }
    let step = tau / n as f64;
    Some((((a + step / 2.0) % tau) / step) as usize % n)
}

// ----------------------------------------------------------------- edges ---

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Zone {
    TopLeft,
    TopRight,
    BottomLeft,
    BottomRight,
    Top,
    Bottom,
    Left,
    Right,
}

/// Which screen edge/corner the pointer is pinned against, if any.
/// `corner` is how far along an edge still counts as the corner.
pub fn zone_at(x: i32, y: i32, vs: Rect, corner: i32) -> Option<Zone> {
    if vs.w <= 0 || vs.h <= 0 {
        return None;
    }
    let l = x - vs.x;
    let r = vs.x + vs.w - 1 - x;
    let t = y - vs.y;
    let b = vs.y + vs.h - 1 - y;
    if l < 0 || r < 0 || t < 0 || b < 0 {
        return None;
    }
    let near = |hard: i32, along: i32| hard <= 1 && along <= corner;
    if near(l, t) || near(t, l) {
        Some(Zone::TopLeft)
    } else if near(r, t) || near(t, r) {
        Some(Zone::TopRight)
    } else if near(l, b) || near(b, l) {
        Some(Zone::BottomLeft)
    } else if near(r, b) || near(b, r) {
        Some(Zone::BottomRight)
    } else if t <= 1 {
        Some(Zone::Top)
    } else if b <= 1 {
        Some(Zone::Bottom)
    } else if l <= 1 {
        Some(Zone::Left)
    } else if r <= 1 {
        Some(Zone::Right)
    } else {
        None
    }
}

// ------------------------------------------------------------ report rate --

/// Estimates how many movement reports per second the mouse delivers while
/// moving. This is an *estimate from observed events*, not a hardware value.
#[derive(Debug, Default)]
pub struct RateEstimator {
    bucket_start: u64,
    count: u32,
    peak_hz: u32,
}

const RATE_BUCKET_MS: u64 = 250;

impl RateEstimator {
    pub fn feed(&mut self, t_us: u64) {
        let t_ms = t_us / 1000;
        if self.count == 0 {
            self.bucket_start = t_ms;
        }
        if t_ms.saturating_sub(self.bucket_start) >= RATE_BUCKET_MS {
            // Only a bucket that was filled continuously counts as movement.
            let span = (t_ms - self.bucket_start).max(1);
            if span <= RATE_BUCKET_MS * 2 {
                let hz = (self.count as u64 * 1000 / span) as u32;
                self.peak_hz = self.peak_hz.max(hz);
            }
            self.bucket_start = t_ms;
            self.count = 0;
        }
        self.count += 1;
    }

    pub fn peak_hz(&self) -> Option<u32> {
        (self.peak_hz > 0).then_some(self.peak_hz)
    }

    pub fn reset(&mut self) {
        *self = Self::default();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn draw(points: &[(i32, i32)]) -> StrokeRecognizer {
        let mut s = StrokeRecognizer::new();
        for &(x, y) in points {
            s.push(x, y);
        }
        s
    }

    fn line(from: (i32, i32), to: (i32, i32), steps: i32) -> Vec<(i32, i32)> {
        (0..=steps)
            .map(|i| (from.0 + (to.0 - from.0) * i / steps, from.1 + (to.1 - from.1) * i / steps))
            .collect()
    }

    #[test]
    fn shake_triggers_on_fast_reversals() {
        let mut d = ShakeDetector::new(5);
        let mut hit = false;
        let mut t = 0;
        let mut x = 0;
        for i in 0..12 {
            let dir = if i % 2 == 0 { 1 } else { -1 };
            for _ in 0..5 {
                x += dir * 15;
                t += 8;
                hit |= d.feed(x, t);
            }
        }
        assert!(hit);
    }

    #[test]
    fn shake_ignores_slow_or_small_motion() {
        let mut d = ShakeDetector::new(5);
        let mut t = 0;
        // slow sweep back and forth, 1.2 s per swing
        let mut x = 0;
        for i in 0..6 {
            let dir = if i % 2 == 0 { 1 } else { -1 };
            for _ in 0..40 {
                x += dir * 10;
                t += 30;
                assert!(!d.feed(x, t));
            }
        }
        // tiny jitter
        let mut d = ShakeDetector::new(5);
        for i in 0..200 {
            assert!(!d.feed(if i % 2 == 0 { 0 } else { 6 }, i as u64 * 5));
        }
    }

    #[test]
    fn shake_has_cooldown() {
        let mut d = ShakeDetector::new(10);
        let mut hits = 0;
        let mut x = 0;
        let mut t = 0;
        for i in 0..30 {
            let dir = if i % 2 == 0 { 1 } else { -1 };
            for _ in 0..5 {
                x += dir * 15;
                t += 6;
                if d.feed(x, t) {
                    hits += 1;
                }
            }
        }
        assert_eq!(hits, 1);
    }

    #[test]
    fn strokes() {
        assert_eq!(draw(&line((0, 0), (200, 0), 20)).pattern(), "R");
        assert_eq!(draw(&line((200, 0), (0, 0), 20)).pattern(), "L");
        assert_eq!(draw(&line((0, 100), (0, 0), 20)).pattern(), "U");
        let mut pts = line((0, 0), (0, 120), 12);
        pts.extend(line((0, 120), (120, 120), 12));
        assert_eq!(draw(&pts).pattern(), "DR");
    }

    #[test]
    fn stroke_ignores_wobble_and_tiny_moves() {
        assert_eq!(draw(&[(0, 0), (3, 2), (5, -1)]).pattern(), "");
        // mostly right with a one-sample dip down
        let mut pts = line((0, 0), (100, 0), 10);
        pts.push((110, 30));
        pts.extend(line((110, 30), (220, 30), 10));
        assert_eq!(draw(&pts).pattern(), "R");
    }

    #[test]
    fn stroke_length_tracks_path() {
        let s = draw(&line((0, 0), (300, 0), 30));
        assert!((s.path_length() - 300.0).abs() < 1.0);
    }

    #[test]
    fn pattern_validation() {
        assert!(valid_pattern("DR"));
        assert!(!valid_pattern(""));
        assert!(!valid_pattern("DX"));
        assert!(!valid_pattern("UUUUUUU"));
    }

    #[test]
    fn radial_sectors() {
        assert_eq!(radial_sector(0.0, -80.0, 4, 20.0), Some(0)); // up
        assert_eq!(radial_sector(80.0, 0.0, 4, 20.0), Some(1)); // right
        assert_eq!(radial_sector(0.0, 80.0, 4, 20.0), Some(2)); // down
        assert_eq!(radial_sector(-80.0, 0.0, 4, 20.0), Some(3)); // left
        assert_eq!(radial_sector(5.0, 5.0, 4, 20.0), None);
        assert_eq!(radial_sector(-1.0, -80.0, 6, 20.0), Some(0));
        assert_eq!(radial_sector(1.0, 1.0, 0, 0.0), None);
    }

    #[test]
    fn zones() {
        let vs = Rect { x: 0, y: 0, w: 1920, h: 1080 };
        assert_eq!(zone_at(0, 0, vs, 24), Some(Zone::TopLeft));
        assert_eq!(zone_at(1919, 0, vs, 24), Some(Zone::TopRight));
        assert_eq!(zone_at(0, 1079, vs, 24), Some(Zone::BottomLeft));
        assert_eq!(zone_at(1919, 1079, vs, 24), Some(Zone::BottomRight));
        assert_eq!(zone_at(10, 0, vs, 24), Some(Zone::TopLeft));
        assert_eq!(zone_at(960, 0, vs, 24), Some(Zone::Top));
        assert_eq!(zone_at(0, 500, vs, 24), Some(Zone::Left));
        assert_eq!(zone_at(1919, 500, vs, 24), Some(Zone::Right));
        assert_eq!(zone_at(960, 1079, vs, 24), Some(Zone::Bottom));
        assert_eq!(zone_at(960, 500, vs, 24), None);
        assert_eq!(zone_at(-5, 500, vs, 24), None);
    }

    #[test]
    fn zones_with_offset_virtual_screen() {
        let vs = Rect { x: -1920, y: 0, w: 3840, h: 1080 };
        assert_eq!(zone_at(-1920, 0, vs, 24), Some(Zone::TopLeft));
        assert_eq!(zone_at(1919, 1079, vs, 24), Some(Zone::BottomRight));
        assert_eq!(zone_at(0, 500, vs, 24), None);
    }

    #[test]
    fn rate_estimator_measures_steady_stream() {
        let mut r = RateEstimator::default();
        assert_eq!(r.peak_hz(), None);
        for i in 0..2000u64 {
            r.feed(i * 1000); // 1000 Hz
        }
        let hz = r.peak_hz().unwrap();
        assert!((900..=1100).contains(&hz), "{hz}");
    }

    #[test]
    fn rate_estimator_ignores_gaps() {
        let mut r = RateEstimator::default();
        r.feed(0);
        r.feed(5_000_000); // 5 s of nothing, then a lone event
        r.feed(5_001_000);
        assert_eq!(r.peak_hz(), None);
    }
}
