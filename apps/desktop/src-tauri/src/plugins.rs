//! Optional community plugins.
//!
//! A plugin is a folder `plugins/<name>/plugin.json` next to the settings that
//! adds *actions* (open a program that ships in the folder, or an https link).
//! Plugins never run on their own: an action only runs when the user binds it
//! to a gesture/button and enables the plugin. Paths cannot leave the folder.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
struct Manifest {
    id: String,
    name: String,
    #[serde(default)]
    version: String,
    #[serde(default)]
    description: String,
    actions: Vec<ManifestAction>,
}

#[derive(Debug, Deserialize)]
struct ManifestAction {
    id: String,
    label: String,
    run: String,
    #[serde(default)]
    args: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct ActionInfo {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub actions: Vec<ActionInfo>,
    pub folder: String,
    /// Set when the manifest is invalid; the plugin cannot be enabled.
    pub error: Option<String>,
}

/// A runnable, already-validated action of an enabled plugin.
#[derive(Debug, Clone)]
pub struct PluginAction {
    pub plugin: String,
    pub action: String,
    pub target: String,
    pub args: String,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 32
        && id
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
}

/// A relative path that stays inside the plugin folder (no drives, no `..`).
pub fn safe_relative(p: &str) -> bool {
    !p.is_empty()
        && p.len() <= 200
        && !p.starts_with(['/', '\\'])
        && !p.contains(':')
        && !p
            .split(['/', '\\'])
            .any(|seg| seg == ".." || seg.is_empty())
        && !p.chars().any(|c| c.is_control())
}

fn resolve(folder: &Path, run: &str) -> Result<String, String> {
    if run.starts_with("https://")
        && run.len() <= 500
        && !run.chars().any(|c| c.is_control() || c == ' ')
    {
        return Ok(run.to_owned());
    }
    if !safe_relative(run) {
        return Err(format!(
            "\"{run}\" must be an https:// link or a path inside the plugin folder"
        ));
    }
    let full: PathBuf = folder.join(run);
    let canon = full
        .canonicalize()
        .map_err(|_| format!("\"{run}\" does not exist"))?;
    let root = folder.canonicalize().map_err(|e| e.to_string())?;
    if !canon.starts_with(&root) || !canon.is_file() {
        return Err(format!("\"{run}\" is not a file inside the plugin folder"));
    }
    Ok(canon
        .to_string_lossy()
        .trim_start_matches(r"\\?\")
        .to_owned())
}

fn load_one(folder: &Path) -> Option<(PluginInfo, Vec<PluginAction>)> {
    let text = fs::read_to_string(folder.join("plugin.json")).ok()?;
    let folder_name = folder.file_name()?.to_string_lossy().into_owned();
    let fail = |msg: String| {
        (
            PluginInfo {
                id: folder_name.to_ascii_lowercase(),
                name: folder_name.clone(),
                version: String::new(),
                description: String::new(),
                actions: vec![],
                folder: folder_name.clone(),
                error: Some(msg),
            },
            vec![],
        )
    };
    let m: Manifest = match serde_json::from_str(&text) {
        Ok(m) => m,
        Err(e) => return Some(fail(format!("plugin.json is invalid: {e}"))),
    };
    if !valid_id(&m.id) {
        return Some(fail(
            "plugin id must be lowercase letters, digits or -".into(),
        ));
    }
    let mut infos = Vec::new();
    let mut runnable = Vec::new();
    for a in m.actions.iter().take(20) {
        if !valid_id(&a.id) {
            return Some(fail(format!("action id \"{}\" is not valid", a.id)));
        }
        match resolve(folder, &a.run) {
            Ok(target) => {
                infos.push(ActionInfo {
                    id: a.id.clone(),
                    label: a.label.chars().take(40).collect(),
                });
                runnable.push(PluginAction {
                    plugin: m.id.clone(),
                    action: a.id.clone(),
                    target,
                    args: a.args.chars().take(300).collect(),
                });
            }
            Err(e) => return Some(fail(format!("action \"{}\": {e}", a.id))),
        }
    }
    Some((
        PluginInfo {
            id: m.id,
            name: m.name.chars().take(40).collect(),
            version: m.version.chars().take(20).collect(),
            description: m.description.chars().take(200).collect(),
            actions: infos,
            folder: folder_name,
            error: None,
        },
        runnable,
    ))
}

pub fn scan(dir: &Path) -> Vec<(PluginInfo, Vec<PluginAction>)> {
    let Ok(rd) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut out: Vec<_> = rd
        .flatten()
        .filter(|e| e.path().is_dir())
        .filter_map(|e| load_one(&e.path()))
        .collect();
    out.sort_by(|a, b| a.0.id.cmp(&b.0.id));
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn relative_paths() {
        assert!(safe_relative("tool.exe"));
        assert!(safe_relative("bin/tool.exe"));
        assert!(!safe_relative("../evil.exe"));
        assert!(!safe_relative("a/../../b"));
        assert!(!safe_relative("C:\\Windows\\notepad.exe"));
        assert!(!safe_relative("/etc/passwd"));
        assert!(!safe_relative("\\\\server\\share\\x.exe"));
        assert!(!safe_relative(""));
        assert!(!safe_relative("a//b"));
    }

    fn scratch(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("mousemore-plug-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn loads_valid_plugin_and_rejects_bad_ones() {
        let root = scratch("scan");
        let good = root.join("hello");
        fs::create_dir_all(&good).unwrap();
        fs::write(good.join("hi.cmd"), "echo hi").unwrap();
        fs::write(
            good.join("plugin.json"),
            r#"{"id":"hello","name":"Hello","actions":[{"id":"hi","label":"Say hi","run":"hi.cmd"},
                {"id":"site","label":"Site","run":"https://example.com/"}]}"#,
        )
        .unwrap();

        let evil = root.join("evil");
        fs::create_dir_all(&evil).unwrap();
        fs::write(evil.join("plugin.json"), r#"{"id":"evil","name":"Evil","actions":[{"id":"x","label":"x","run":"..\\hello\\hi.cmd"}]}"#).unwrap();

        let junk = root.join("junk");
        fs::create_dir_all(&junk).unwrap();
        fs::write(junk.join("plugin.json"), "not json").unwrap();

        let found = scan(&root);
        assert_eq!(found.len(), 3);
        let by = |id: &str| found.iter().find(|(i, _)| i.id == id).unwrap();
        assert!(by("hello").0.error.is_none());
        assert_eq!(by("hello").1.len(), 2);
        assert!(by("evil").0.error.is_some());
        assert!(by("evil").1.is_empty());
        assert!(by("junk").0.error.is_some());
        let _ = fs::remove_dir_all(root);
    }
}
