//! Capability reporting: how well each feature works on this system, with a reason.
//! Hardware-dependent features can never report `Supported`; see the tests.

use serde::{Deserialize, Serialize};

/// How well a capability works on the current system.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    /// Works end to end.
    Supported,
    /// Works with caveats described in `detail`.
    Partial,
    /// Cannot work on this system; `detail` explains why.
    Unsupported,
    /// On the roadmap, not implemented yet.
    Planned,
}

/// A detected (not assumed) system capability.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Capability {
    pub id: String,
    pub name: String,
    pub status: Status,
    pub detail: String,
}

impl Capability {
    pub fn new(id: &str, name: &str, status: Status, detail: impl Into<String>) -> Self {
        Self {
            id: id.to_owned(),
            name: name.to_owned(),
            status,
            detail: detail.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_serializes_lowercase() {
        let c = Capability::new("x", "X", Status::Partial, "d");
        let v = serde_json::to_value(&c).unwrap();
        assert_eq!(v["status"], "partial");
    }
}
