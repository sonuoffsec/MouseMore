import type { MouseDevice } from "./types";

/** Prefer the name the device reports itself; never invent one. */
export function deviceTitle(d: MouseDevice, index: number): string {
  if (d.name) {
    const maker = d.manufacturer && !d.name.toLowerCase().includes(d.manufacturer.toLowerCase()) ? `${d.manufacturer} ` : "";
    return `${maker}${d.name}`;
  }
  if (d.vendor_id && d.product_id) return `Pointing device ${d.vendor_id}:${d.product_id}`;
  return `Pointing device ${index + 1}`;
}

/** Checks the text of an imported settings file before it is sent to the engine. */
export function looksLikeSettingsJson(text: string): string | null {
  const t = text.trim();
  if (!t) return "Paste the exported settings first.";
  try {
    const v: unknown = JSON.parse(t);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return "Settings must be a JSON object.";
  } catch {
    return "That is not valid JSON.";
  }
  return null;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
