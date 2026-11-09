import { describe, expect, it } from "vitest";
import { GROUPS, SECTIONS, allFeatures, countByStatus } from "./catalog";
import { ARROW, arrows, comboProblem, describeAction, validPattern } from "./actions";
import { deviceTitle, looksLikeSettingsJson, pluralize } from "./format";

describe("feature catalog", () => {
  it("has the twelve required sections in order", () => {
    expect(SECTIONS.map((s) => s.name)).toEqual([
      "Overview", "Cursor Effects", "Gestures", "Productivity", "Customization",
      "Creative Tools", "Accessibility", "Gaming", "Automation", "Devices", "Profiles", "Settings",
    ]);
  });

  it("puts every section in a known group", () => {
    for (const s of SECTIONS) expect(GROUPS).toContain(s.group);
  });

  it("has unique feature ids", () => {
    const ids = allFeatures().map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every planned feature names a roadmap phase", () => {
    for (const f of allFeatures().filter((f) => f.status === "planned")) {
      expect(f.phase, f.id).toBeGreaterThanOrEqual(2);
      expect(f.phase, f.id).toBeLessThanOrEqual(6);
    }
  });

  it("every limited or unsupported feature explains why", () => {
    for (const f of allFeatures().filter((f) => f.status === "unsupported" || f.status === "partial")) {
      expect(f.note?.length ?? 0, f.id).toBeGreaterThan(20);
    }
  });

  it("never claims hardware DPI, battery or per-device profiles as working", () => {
    const byId = Object.fromEntries(allFeatures().map((f) => [f.id, f]));
    for (const id of ["hw-dpi", "battery", "device-profiles"]) expect(byId[id]?.status, id).toBe("unsupported");
    expect(byId["polling-rate"]?.status).toBe("partial");
  });

  it("counts add up", () => {
    const c = countByStatus();
    expect(c.working + c.partial + c.planned + c.unsupported).toBe(allFeatures().length);
  });
});

describe("action helpers", () => {
  it("validates key combos like the engine does", () => {
    expect(comboProblem("ctrl+c")).toBeNull();
    expect(comboProblem("Alt+Left")).toBeNull();
    expect(comboProblem("win+shift+s")).toBeNull();
    expect(comboProblem("f12")).toBeNull();
    expect(comboProblem("")).not.toBeNull();
    expect(comboProblem("ctrl")).not.toBeNull();
    expect(comboProblem("ctrl+banana")).not.toBeNull();
    expect(comboProblem("f25")).not.toBeNull();
    expect(comboProblem("a+b+c")).not.toBeNull();
  });

  it("validates gesture patterns", () => {
    expect(validPattern("DR")).toBe(true);
    expect(validPattern("")).toBe(false);
    expect(validPattern("DX")).toBe(false);
    expect(validPattern("UUUUUUU")).toBe(false);
  });

  it("renders patterns as arrows", () => {
    expect(arrows("UDLR")).toBe(`${ARROW.U} ${ARROW.D} ${ARROW.L} ${ARROW.R}`);
  });

  it("describes actions", () => {
    expect(describeAction({ type: "keys", combo: "ctrl+c" })).toBe("Press ctrl+c");
    expect(describeAction({ type: "window", op: "snap_left" })).toBe("Snap window left");
    expect(describeAction({ type: "none" })).toBe("Do nothing");
  });
});

describe("format helpers", () => {
  it("validates settings json", () => {
    expect(looksLikeSettingsJson("")).not.toBeNull();
    expect(looksLikeSettingsJson("{nope")).not.toBeNull();
    expect(looksLikeSettingsJson("[1]")).not.toBeNull();
    expect(looksLikeSettingsJson('{"theme":"dark"}')).toBeNull();
  });

  it("titles devices without inventing names", () => {
    const base = { path: "", name: null, manufacturer: null, connection: null, buttons: 3, reported_sample_rate_hz: null, has_horizontal_wheel: false };
    expect(deviceTitle({ ...base, vendor_id: "046D", product_id: "C077" }, 0)).toBe("Pointing device 046D:C077");
    expect(deviceTitle({ ...base, vendor_id: null, product_id: null }, 1)).toBe("Pointing device 2");
    expect(deviceTitle({ ...base, name: "USB Optical Mouse", manufacturer: "Logitech", vendor_id: "046D", product_id: "C077" }, 0))
      .toBe("Logitech USB Optical Mouse");
  });

  it("pluralizes", () => {
    expect(pluralize(1, "device")).toBe("1 device");
    expect(pluralize(2, "device")).toBe("2 devices");
  });
});
