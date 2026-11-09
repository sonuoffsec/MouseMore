//! Pointing-device detection.
//!
//! Everything reported here comes from the operating system. Fields the OS
//! does not expose are `None` and the UI says so; nothing is guessed.

use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq)]
pub struct MouseDevice {
    /// OS device interface path (stable identifier, useful for bug reports).
    pub path: String,
    /// Product name from the device's own HID descriptor, when it reports one.
    pub name: Option<String>,
    pub manufacturer: Option<String>,
    pub vendor_id: Option<String>,
    pub product_id: Option<String>,
    /// Best-effort bus classification derived from the device path.
    pub connection: Option<&'static str>,
    pub buttons: u32,
    /// Report rate as stated by the driver. Frequently 0/unreliable, so it is
    /// treated as unknown when 0. It is NOT a measured polling rate.
    pub reported_sample_rate_hz: Option<u32>,
    pub has_horizontal_wheel: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq, Default)]
pub struct SystemMouse {
    pub present: bool,
    pub buttons: i32,
    pub wheel: bool,
    pub horizontal_wheel: bool,
    pub buttons_swapped: bool,
}

#[derive(Debug, Clone, Serialize, Default)]
pub struct DeviceReport {
    pub devices: Vec<MouseDevice>,
    pub system: SystemMouse,
    /// Why the list may be empty or incomplete.
    pub note: Option<String>,
}

fn hex4(s: &str) -> Option<String> {
    let h: String = s.chars().take(4).collect();
    (h.len() == 4 && h.chars().all(|c| c.is_ascii_hexdigit())).then(|| h.to_uppercase())
}

/// Extract (vendor, product) ids from a device path. Handles both the USB form
/// `VID_046D&PID_C077` and the Bluetooth HID form `VID&02046D_PID&B01D`.
pub fn parse_ids(path: &str) -> (Option<String>, Option<String>) {
    let up = path.to_uppercase();
    let vid = if let Some(i) = up.find("VID_") {
        hex4(&up[i + 4..])
    } else if let Some(i) = up.find("VID&") {
        up.get(i + 4 + 2..).and_then(hex4) // skip the 2-digit vendor-id-source prefix
    } else {
        None
    };
    let pid = if let Some(i) = up.find("PID_") {
        hex4(&up[i + 4..])
    } else if let Some(i) = up.find("PID&") {
        hex4(&up[i + 4..])
    } else {
        None
    };
    (vid, pid)
}

pub fn classify_connection(path: &str) -> Option<&'static str> {
    let up = path.to_uppercase();
    if up.contains("RDP_MOU") || up.contains("ROOT#RDP") {
        Some("Remote desktop (virtual)")
    } else if up.contains("BTHENUM")
        || up.contains("BTHLE")
        || up.contains("00001124-0000-1000-8000-00805F9B34FB")
        || up.contains("00001812-0000-1000-8000-00805F9B34FB")
    {
        Some("Bluetooth")
    } else if up.contains("ACPI#") || up.contains("PNP0F") {
        Some("Built-in / PS/2 (e.g. laptop touchpad)")
    } else if up.contains("HID#VID_") || up.contains("USB#VID_") {
        Some("USB or wireless receiver")
    } else {
        None
    }
}

#[cfg(windows)]
fn hid_strings(path: &str) -> (Option<String>, Option<String>) {
    use std::ffi::c_void;
    use windows::core::PCWSTR;
    use windows::Win32::Devices::HumanInterfaceDevice::{HidD_GetManufacturerString, HidD_GetProductString};
    use windows::Win32::Foundation::CloseHandle;
    use windows::Win32::Storage::FileSystem::{
        CreateFileW, FILE_FLAGS_AND_ATTRIBUTES, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };

    let wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
    unsafe {
        // Access 0: query-only, so it works even though the OS owns the mouse.
        let Ok(h) = CreateFileW(
            PCWSTR(wide.as_ptr()),
            0,
            FILE_SHARE_READ | FILE_SHARE_WRITE,
            None,
            OPEN_EXISTING,
            FILE_FLAGS_AND_ATTRIBUTES(0),
            None,
        ) else {
            return (None, None);
        };
        let read = |f: unsafe fn(windows::Win32::Foundation::HANDLE, *mut c_void, u32) -> windows::Win32::Foundation::BOOLEAN| {
            let mut buf = [0u16; 127];
            if f(h, buf.as_mut_ptr() as *mut c_void, (buf.len() * 2) as u32).as_bool() {
                let end = buf.iter().position(|&c| c == 0).unwrap_or(buf.len());
                let s = String::from_utf16_lossy(&buf[..end]).trim().to_owned();
                (!s.is_empty()).then_some(s)
            } else {
                None
            }
        };
        let product = read(HidD_GetProductString);
        let maker = read(HidD_GetManufacturerString);
        let _ = CloseHandle(h);
        (product, maker)
    }
}

#[cfg(windows)]
pub fn detect() -> DeviceReport {
    use std::mem::size_of;
    use std::ffi::c_void;
    use windows::Win32::UI::Input::{
        GetRawInputDeviceInfoW, GetRawInputDeviceList, RAWINPUTDEVICELIST, RIDI_DEVICEINFO,
        RIDI_DEVICENAME, RID_DEVICE_INFO, RIM_TYPEMOUSE,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        GetSystemMetrics, SM_CMOUSEBUTTONS, SM_MOUSEHORIZONTALWHEELPRESENT, SM_MOUSEPRESENT,
        SM_MOUSEWHEELPRESENT, SM_SWAPBUTTON,
    };

    let system = unsafe {
        SystemMouse {
            present: GetSystemMetrics(SM_MOUSEPRESENT) != 0,
            buttons: GetSystemMetrics(SM_CMOUSEBUTTONS),
            wheel: GetSystemMetrics(SM_MOUSEWHEELPRESENT) != 0,
            horizontal_wheel: GetSystemMetrics(SM_MOUSEHORIZONTALWHEELPRESENT) != 0,
            buttons_swapped: GetSystemMetrics(SM_SWAPBUTTON) != 0,
        }
    };

    let mut devices = Vec::new();
    let mut note = None;
    unsafe {
        let entry = size_of::<RAWINPUTDEVICELIST>() as u32;
        let mut count = 0u32;
        if GetRawInputDeviceList(None, &mut count, entry) == u32::MAX {
            note = Some("Windows could not list input devices.".to_owned());
        } else if count > 0 {
            let mut list = vec![RAWINPUTDEVICELIST::default(); count as usize];
            let got = GetRawInputDeviceList(Some(list.as_mut_ptr()), &mut count, entry);
            if got == u32::MAX {
                note = Some("Windows could not list input devices.".to_owned());
            } else {
                for dev in list.iter().take(got as usize) {
                    if dev.dwType != RIM_TYPEMOUSE {
                        continue;
                    }
                    // Device path (UTF-16).
                    let mut chars = 0u32;
                    GetRawInputDeviceInfoW(dev.hDevice, RIDI_DEVICENAME, None, &mut chars);
                    let mut buf = vec![0u16; chars as usize];
                    let n = GetRawInputDeviceInfoW(
                        dev.hDevice,
                        RIDI_DEVICENAME,
                        Some(buf.as_mut_ptr() as *mut c_void),
                        &mut chars,
                    );
                    if n == u32::MAX {
                        continue;
                    }
                    let path = String::from_utf16_lossy(&buf)
                        .trim_end_matches('\0')
                        .to_owned();

                    // Capabilities.
                    let mut info = RID_DEVICE_INFO {
                        cbSize: size_of::<RID_DEVICE_INFO>() as u32,
                        ..Default::default()
                    };
                    let mut size = info.cbSize;
                    let ok = GetRawInputDeviceInfoW(
                        dev.hDevice,
                        RIDI_DEVICEINFO,
                        Some(&mut info as *mut _ as *mut c_void),
                        &mut size,
                    ) != u32::MAX;
                    let (buttons, rate, hwheel) = if ok {
                        let m = info.Anonymous.mouse;
                        (
                            m.dwNumberOfButtons,
                            (m.dwSampleRate != 0).then_some(m.dwSampleRate),
                            m.fHasHorizontalWheel.as_bool(),
                        )
                    } else {
                        (0, None, false)
                    };

                    let (vendor_id, product_id) = parse_ids(&path);
                    let (name, manufacturer) = hid_strings(&path);
                    devices.push(MouseDevice {
                        connection: classify_connection(&path),
                        name,
                        manufacturer,
                        path,
                        vendor_id,
                        product_id,
                        buttons,
                        reported_sample_rate_hz: rate,
                        has_horizontal_wheel: hwheel,
                    });
                }
            }
        }
    }
    if devices.is_empty() && note.is_none() {
        note = Some("No pointing devices were reported by Windows.".to_owned());
    }
    DeviceReport { devices, system, note }
}

#[cfg(not(windows))]
pub fn detect() -> DeviceReport {
    DeviceReport {
        devices: Vec::new(),
        system: SystemMouse::default(),
        note: Some("Device detection is not implemented on this operating system yet.".to_owned()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn usb_ids() {
        let p = r"\\?\HID#VID_046D&PID_C077#7&2a1b3c4d&0&0000#{378de44c-56ef-11d1-bc8c-00a0c91405dd}";
        assert_eq!(parse_ids(p), (Some("046D".into()), Some("C077".into())));
        assert_eq!(classify_connection(p), Some("USB or wireless receiver"));
    }

    #[test]
    fn bluetooth_ids() {
        let p = r"\\?\HID#{00001124-0000-1000-8000-00805f9b34fb}_VID&02046d_PID&b01d#8&1&0&0000";
        assert_eq!(parse_ids(p), (Some("046D".into()), Some("B01D".into())));
        assert_eq!(classify_connection(p), Some("Bluetooth"));
    }

    #[test]
    fn virtual_and_builtin() {
        assert_eq!(
            classify_connection(r"\\?\ROOT#RDP_MOU#0000#{378de44c}"),
            Some("Remote desktop (virtual)")
        );
        assert_eq!(
            classify_connection(r"\\?\ACPI#PNP0F13#4&1&0"),
            Some("Built-in / PS/2 (e.g. laptop touchpad)")
        );
    }

    #[test]
    fn unknown_path_yields_nothing() {
        assert_eq!(parse_ids("garbage"), (None, None));
        assert_eq!(classify_connection("garbage"), None);
    }
}
