//! Operating-system actions. Every function here either does what its name
//! says or returns an error string the UI can show; nothing silently no-ops.

#[cfg(windows)]
mod win;
#[cfg(windows)]
pub use win::*;

#[cfg(not(windows))]
mod stub;
#[cfg(not(windows))]
pub use stub::*;

/// What the foreground window looks like to the profile switcher.
#[derive(Debug, Clone, Default, PartialEq, Eq, serde::Serialize)]
pub struct Foreground {
    pub exe: Option<String>,
    pub fullscreen: bool,
}

/// Percent-encode for a URL query component (RFC 3986 unreserved kept).
pub fn url_encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 3);
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{b:02X}")),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encodes_queries() {
        assert_eq!(url_encode("hello world"), "hello%20world");
        assert_eq!(url_encode("a&b=c"), "a%26b%3Dc");
        assert_eq!(url_encode("é"), "%C3%A9");
        assert_eq!(url_encode("safe-_.~"), "safe-_.~");
    }
}
