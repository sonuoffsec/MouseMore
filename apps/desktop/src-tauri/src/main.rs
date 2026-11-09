//! Binary entry point. Everything lives in the library crate so tests can reach it.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    mousemore_lib::run()
}
