// Generates app-icon.png (1024x1024): a rounded dark tile with a mouse glyph.
// No dependencies; feed the result to `tauri icon`.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const N = 1024, px = Buffer.alloc(N * N * 4);
const set = (x, y, r, g, b, a = 255) => { const i = (y * N + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
const inRound = (x, y, x0, y0, x1, y1, rad) => {
  const cx = Math.min(Math.max(x, x0 + rad), x1 - rad), cy = Math.min(Math.max(y, y0 + rad), y1 - rad);
  return (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad;
};
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  if (!inRound(x, y, 0, 0, N - 1, N - 1, 220)) continue;
  const t = (x + y) / (2 * N);
  set(x, y, 20 + 14 * t | 0, 22 + 14 * t | 0, 34 + 30 * t | 0);
  // mouse body
  if (inRound(x, y, 342, 232, 682, 792, 170)) set(x, y, 139, 155, 255);
  // button split + wheel (cut-outs in tile color)
  if (y >= 480 && y <= 492 && x > 342 && x < 682 && inRound(x, y, 342, 232, 682, 792, 170)) set(x, y, 30, 33, 56);
  if (y < 486 && x >= 508 && x <= 516 && y > 232) set(x, y, 30, 33, 56);
  if (inRound(x, y, 488, 330, 536, 420, 24)) set(x, y, 30, 33, 56);
}
const crc = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return (b) => { let c = ~0; for (const v of b) c = t[(c ^ v) & 255] ^ (c >>> 8); return ~c >>> 0; }; })();
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; px.copy(raw, y * (N * 4 + 1) + 1, y * N * 4, (y + 1) * N * 4); }
writeFileSync(process.argv[2] ?? "app-icon.png", Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]));
