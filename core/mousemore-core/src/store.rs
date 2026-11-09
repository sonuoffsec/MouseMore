//! File-backed JSON settings store: atomic writes (temp file then rename) and recovery
//! from a corrupt file by setting it aside instead of overwriting it.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use crate::settings::Settings;

/// File-backed settings store with atomic writes.
#[derive(Debug, Clone)]
pub struct Store {
    path: PathBuf,
}

#[derive(Debug)]
pub struct LoadOutcome {
    pub settings: Settings,
    /// Set when an unreadable file was moved aside and defaults were used.
    pub recovered_from: Option<PathBuf>,
}

impl Store {
    pub fn new(dir: impl AsRef<Path>) -> Self {
        Self {
            path: dir.as_ref().join("settings.json"),
        }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Load settings. A missing file yields defaults; a corrupt or too-new
    /// file is preserved as `settings.json.bak` rather than overwritten.
    pub fn load(&self) -> LoadOutcome {
        let text = match fs::read_to_string(&self.path) {
            Ok(t) => t,
            Err(_) => {
                return LoadOutcome {
                    settings: Settings::default(),
                    recovered_from: None,
                }
            }
        };
        match Settings::from_json(&text) {
            Ok(settings) => LoadOutcome {
                settings,
                recovered_from: None,
            },
            Err(_) => {
                let bak = self.path.with_extension("json.bak");
                let moved = fs::rename(&self.path, &bak).is_ok();
                LoadOutcome {
                    settings: Settings::default(),
                    recovered_from: moved.then_some(bak),
                }
            }
        }
    }

    /// Write via a temp file + rename so a crash never leaves a half-written file.
    pub fn save(&self, settings: &Settings) -> io::Result<()> {
        if let Some(dir) = self.path.parent() {
            fs::create_dir_all(dir)?;
        }
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, settings.to_json_pretty())?;
        fs::rename(&tmp, &self.path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::Theme;

    fn scratch(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("mousemore-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        d
    }

    #[test]
    fn missing_file_gives_defaults() {
        let store = Store::new(scratch("missing"));
        let out = store.load();
        assert_eq!(out.settings, Settings::default());
        assert!(out.recovered_from.is_none());
    }

    #[test]
    fn save_then_load() {
        let dir = scratch("roundtrip");
        let store = Store::new(&dir);
        let s = Settings {
            theme: Theme::Light,
            live_monitor: true,
            ..Default::default()
        };
        store.save(&s).unwrap();
        assert_eq!(store.load().settings, s);
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn corrupt_file_is_preserved() {
        let dir = scratch("corrupt");
        fs::create_dir_all(&dir).unwrap();
        let store = Store::new(&dir);
        fs::write(store.path(), "{ not json").unwrap();
        let out = store.load();
        assert_eq!(out.settings, Settings::default());
        let bak = out.recovered_from.expect("backup path");
        assert_eq!(fs::read_to_string(bak).unwrap(), "{ not json");
        let _ = fs::remove_dir_all(dir);
    }
}
