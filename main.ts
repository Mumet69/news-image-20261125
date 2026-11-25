// news-image-20261125 — "The World in One Day"
// Draws a newspaper front page summing up Wednesday 25 November 2026:
// masthead with the date, a lead story (Shenzhou-24 / first Pakistani in
// orbit) and four more of the day's biggest stories, plus a ticker.
// Pure Node standard library: a tiny raster canvas, a 5x7 bitmap font and
// a hand-written PNG encoder. No network, no files read, no clock, no
// randomness, so two runs write identical bytes.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { join } from "node:path";

const W = 1024;
const H = 1024;

// ---- palette (flat newsprint colours) ----
const PAPER = [246, 241, 231];
const INK = [22, 26, 36];
const NAVY = [20, 33, 61];
const NAVY2 = [28, 48, 88];
const RED = [193, 18, 31];
const BLUE = [36, 90, 160];
const SKY1 = [126, 180, 220];
const SKY2 = [168, 208, 232];
const SKY3 = [205, 228, 242];
const GOLD = [212, 160, 32];
const ORANGE = [232, 120, 32];
const WHITE = [255, 255, 255];
const GREY = [96, 96, 92];
const LIGHT = [232, 226, 214];
const GREEN = [46, 125, 72];

// ---- raster canvas ----
const px = new Uint8Array(W * H * 3);
function fill(c: number[]) {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0]; px[i * 3 + 1] = c[1]; px[i * 3 + 2] = c[2];
  }
}
function dot(x: number, y: number, c: number[]) {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: number[]) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) dot(i, j, c);
}
function frame(x: number, y: number, w: number, h: number, c: number[], t: number) {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}
function hline(x0: number, x1: number, y: number, c: number[]) {
  for (let x = x0; x <= x1; x++) dot(x, y, c);
}
function vline(x: number, y0: number, y1: number, c: number[]) {
  for (let y = y0; y <= y1; y++) dot(x, y, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: number[]) {
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx - dy, x = x0, y = y0;
  for (;;) {
    dot(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * e;
    if (e2 > -dy) { e -= dy; x += sx; }
    if (e2 < dx) { e += dx; y += sy; }
  }
}
function disc(cx: number, cy: number, r: number, c: number[]) {
  for (let y = cy - r; y <= cy + r; y++)
    for (let x = cx - r; x <= cx + r; x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) dot(x, y, c);
}
function ring(cx: number, cy: number, r: number, c: number[], t: number) {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++)
      dot(Math.round(cx + (r + k) * Math.cos(rad)), Math.round(cy + (r + k) * Math.sin(rad)), c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: number[]) {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (x1 - x0) * (y2 - y0) - (y1 - y0) * (x2 - x0);
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const a = ((x1 - x) * (y2 - y) - (y1 - y) * (x2 - x)) / d;
    const b = ((x2 - x) * (y0 - y) - (y2 - y) * (x0 - x)) / d;
    const g = 1 - a - b;
    if (a >= 0 && b >= 0 && g >= 0) dot(x, y, c);
  }
}

// ---- 5x7 bitmap font: each glyph is 35 bits, row-major, 5 per row ----
const FONT: Record<string, string> = {
  A: "01110100011000111111100011000110001",
  B: "11110100011000111110100011000111110",
  C: "01110100011000010000100001000101110",
  D: "11110100011000110001100011000111110",
  E: "11111100001000011110100001000011111",
  F: "11111100001000011110100001000010000",
  G: "01110100011000010111100011000101111",
  H: "10001100011000111111100011000110001",
  I: "01110001000010000100001000010001110",
  J: "00111000100001000010000101001001100",
  K: "10001100101010011000101001001010001",
  L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001",
  N: "10001110011010110011100011000110001",
  O: "01110100011000110001100011000101110",
  P: "11110100011000111110100001000010000",
  Q: "01110100011000110001101011001001101",
  R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110",
  T: "11111001000010000100001000010000100",
  U: "10001100011000110001100011000101110",
  V: "10001100011000110001100010101000100",
  W: "10001100011000110101101011010101010",
  X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100",
  Z: "11111000010001000100010001000011111",
  "0": "01110100011001110101110011000101110",
  "1": "00100011000010000100001000010001110",
  "2": "01110100010000100110010001000011111",
  "3": "11111000100010000010000011000101110",
  "4": "00010001100101010010111110001000010",
  "5": "11111100001111000001000011000101110",
  "6": "00110010001000011110100011000101110",
  "7": "11111000010001000100010000100001000",
  "8": "01110100011000101110100011000101110",
  "9": "01110100011000101111000010001001100",
  " ": "00000000000000000000000000000000000",
  ".": "00000000000000000000000000110001100",
  ",": "00000000000000000000001100001000100",
  ":": "00000011000110000000011000110000000",
  ";": "00000011000110000000011000010001000",
  "'": "00100001000100000000000000000000000",
  "-": "00000000000000001110000000000000000",
  "—": "00000000000000011111000000000000000",
  "/": "00001000100001000100010001000010000",
  "(": "00010001000100001000010000010000010",
  ")": "01000001000001000010000100010001000",
  "&": "01100100101010001000101011001001101",
  "%": "11001110100001000100010000101110011",
  "!": "00100001000010000100001000000000100",
  "?": "01110100010000100110001000000000100",
  '"': "01010010100000000000000000000000000",
  "+": "00000001000010001110001000010000000",
  "=": "00000000001111100000111110000000000",
  "·": "00000000000110001100000000000000000",
  "•": "00000000000110001100000000000000000",
};
function glyph(ch: string): string {
  return FONT[ch] ?? FONT["?"];
}
function textW(s: string, sc: number): number {
  return s.length * 6 * sc - sc;
}
function drawText(s: string, x: number, y: number, sc: number, c: number[], bold = false) {
  const offs = bold ? [0, 1] : [0];
  for (const ox of offs) {
    let cx = x + ox;
    for (const ch of s) {
      const g = glyph(ch);
      for (let r = 0; r < 7; r++)
        for (let col = 0; col < 5; col++)
          if (g[r * 5 + col] === "1")
            for (let dy = 0; dy < sc; dy++)
              for (let dx = 0; dx < sc; dx++)
                dot(cx + col * sc + dx, y + r * sc + dy, c);
      cx += 6 * sc;
    }
  }
}
function wrap(s: string, maxW: number, sc: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? cur + " " + w : w;
    if (textW(t, sc) <= maxW) cur = t;
    else { if (cur) lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function center(s: string, y: number, sc: number, c: number[], bold = false) {
  drawText(s, Math.round((W - textW(s, sc)) / 2), y, sc, c, bold);
}

// ---- PNG encoder (deterministic: fixed filter 0, zlib level 9) ----
const CRC_T = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function png(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- icons (flat pictograms, drawn with primitives) ----
function rocketArt(x: number, y: number, w: number, h: number) {
  rect(x, y, w, Math.round(h * 0.62), SKY1);
  rect(x, y + Math.round(h * 0.62), w, h - Math.round(h * 0.62), SKY2);
  rect(x, y + Math.round(h * 0.82), w, h - Math.round(h * 0.82), SKY3);
  // stars
  const stars: [number, number][] = [[18, 22], [52, 48], [86, 16], [120, 60], [150, 26], [30, 90], [104, 96], [168, 78], [200, 30], [230, 110], [260, 44], [290, 84], [320, 24], [340, 120], [70, 130], [250, 140]];
  for (const [sx, sy] of stars) { dot(x + sx, y + sy, WHITE); dot(x + sx + 1, y + sy, WHITE); }
  // earth: flat horizon band at the bottom of the panel, with land blobs
  rect(x, y + h - 44, w, 44, BLUE);
  disc(x + 92, y + h - 28, 24, GREEN);
  disc(x + 272, y + h - 24, 24, GREEN);
  // rocket, centred, nose up
  const cx = x + Math.round(w / 2), top = y + 78, bw = 46, bh = 116;
  tri(cx - 12, top + 34, cx + 12, top + 34, cx, top, RED); // nose
  rect(cx - 23, top + 34, bw, bh, WHITE); // body
  rect(cx - 23, top + 34, 4, bh, LIGHT);
  tri(cx - 23, top + 60, cx - 46, top + 150, cx - 23, top + 150, RED); // left fin
  tri(cx + 23, top + 60, cx + 46, top + 150, cx + 23, top + 150, RED); // right fin
  disc(cx, top + 74, 11, SKY1); ring(cx, top + 74, 11, NAVY, 3); // window
  rect(cx - 23, top + 118, bw, 8, RED); // band
  // flame
  tri(cx - 14, top + bh + 34, cx + 14, top + bh + 34, cx, top + bh + 44, ORANGE);
  tri(cx - 7, top + bh + 34, cx + 7, top + bh + 34, cx, top + bh + 30, GOLD);
  // speed lines
  hline(x + 24, x + 74, top + 150, WHITE); hline(x + w - 74, x + w - 24, top + 180, WHITE);
  hline(x + 30, x + 90, top + 190, WHITE);
  frame(x, y, w, h, INK, 2);
}
function shipIcon(x: number, y: number, s: number) {
  // warship silhouette, scale s (drawn in a ~110x90 box)
  rect(x + 18 * s, y + 46 * s, 74 * s, 12 * s, NAVY);
  tri(x + 92 * s, y + 46 * s, x + 92 * s, y + 58 * s, x + 108 * s, y + 58 * s, NAVY);
  rect(x + 40 * s, y + 30 * s, 6 * s, 16 * s, NAVY);
  rect(x + 58 * s, y + 36 * s, 6 * s, 10 * s, NAVY);
  tri(x + 46 * s, y + 30 * s, x + 46 * s, y + 18 * s, x + 62 * s, y + 30 * s, RED);
  hline(x + 6 * s, x + 104 * s, y + 70 * s, BLUE);
  hline(x + 16 * s, x + 96 * s, y + 78 * s, BLUE);
  hline(x + 26 * s, x + 86 * s, y + 86 * s, BLUE);
  // drone above
  disc(x + 84 * s, y + 10 * s, 3 * s, INK);
  hline(x + 74 * s, x + 94 * s, y + 10 * s, INK);
}
function lockIcon(x: number, y: number, s: number) {
  ring(x + 55 * s, y + 26 * s, 18 * s, NAVY, 6 * s);
  rect(x + 31 * s, y + 44 * s, 48 * s, 40 * s, NAVY);
  disc(x + 55 * s, y + 58 * s, 7 * s, WHITE);
  rect(x + 52 * s, y + 58 * s, 6 * s, 16 * s, WHITE);
  line(x + 14 * s, y + 88 * s, x + 30 * s, y + 78 * s, RED);
  line(x + 96 * s, y + 88 * s, x + 80 * s, y + 78 * s, RED);
}
function chipIcon(x: number, y: number, s: number) {
  rect(x + 30 * s, y + 30 * s, 50 * s, 50 * s, INK);
  rect(x + 42 * s, y + 42 * s, 26 * s, 26 * s, GOLD);
  rect(x + 50 * s, y + 50 * s, 10 * s, 10 * s, INK);
  for (let i = 0; i < 3; i++) {
    rect(x + (36 + i * 16) * s, y + 18 * s, 6 * s, 12 * s, INK);
    rect(x + (36 + i * 16) * s, y + 80 * s, 6 * s, 12 * s, INK);
    rect(x + 18 * s, y + (36 + i * 16) * s, 12 * s, 6 * s, INK);
    rect(x + 80 * s, y + (36 + i * 16) * s, 12 * s, 6 * s, INK);
  }
}
function towerIcon(x: number, y: number, s: number) {
  rect(x + 44 * s, y + 14 * s, 22 * s, 74 * s, NAVY);
  rect(x + 38 * s, y + 8 * s, 34 * s, 8 * s, NAVY);
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 2; c++)
      rect(x + (48 + c * 9) * s, y + (22 + r * 11) * s, 5 * s, 6 * s, GOLD);
  // impact burst at the top
  for (let a = 0; a < 8; a++) {
    const rad = (a * Math.PI) / 4;
    line(x + 55 * s, y + 6 * s, Math.round(x + 55 * s + 20 * s * Math.cos(rad)), Math.round(y + 6 * s + 20 * s * Math.sin(rad)), RED);
  }
  disc(x + 55 * s, y + 6 * s, 5 * s, ORANGE);
}

// ---- page layout ----
function draw() {
  fill(PAPER);

  // masthead
  rect(0, 0, W, 104, NAVY);
  center("THE WORLD IN ONE DAY", 18, 3, WHITE);
  center("WEDNESDAY 25 NOVEMBER 2026", 50, 6, WHITE, true);
  rect(0, 104, W, 6, RED);

  // ---- lead story ----
  const LX = 16, LY = 122, LW = W - 32, LH = 306;
  rect(LX, LY, LW, LH, WHITE);
  frame(LX, LY, LW, LH, INK, 2);
  rocketArt(LX + 14, LY + 14, 360, LH - 28);
  const TX = LX + 398, TW = LW - 398 - 22;
  drawText("SPACE · CHINA · TIANGONG", TX, LY + 22, 3, RED, true);
  const head = ["FIRST", "PAKISTANI", "IN ORBIT"];
  head.forEach((ln, i) => drawText(ln, TX, LY + 56 + i * 52, 7, NAVY, true));
  const body = "SHENZHOU-24 LIFTS OFF FOR TIANGONG WITH ZEESHAN ALI, FIRST FOREIGN ASTRONAUT ABOARD.";
  wrap(body, TW, 3).forEach((ln, i) => drawText(ln, TX, LY + 222 + i * 24, 3, INK));

  // ---- four story bands ----
  const bands = [
    {
      kick: "WAR · UKRAINE", head: "KYIV HITS RUSSIAN SHIPS",
      body: "ZELENSKIY CONFIRMS KYIV'S DRONES HIT THE SHIPS. MOSCOW CALLS IT TERRORISM.",
      icon: shipIcon,
    },
    {
      kick: "CYBER · UNITED STATES", head: "CIA HIT BY HACK",
      body: "UNCLASSIFIED SYSTEMS BREACHED AT THE CIA AND THE SPY CHIEF'S OFFICE. SIGNS POINT TO CHINA.",
      icon: lockIcon,
    },
    {
      kick: "TECH · UNITED STATES", head: "HUAWEI FOUND GUILTY",
      body: "A US JURY CONVICTS THE CHINESE TELECOM GIANT OF STEALING TRADE SECRETS.",
      icon: chipIcon,
    },
    {
      kick: "MIDDLE EAST · SAUDI ARABIA", head: "STRIKE ON RIYADH TOWER",
      body: "A HOUTHI ATTACK HITS THE SAUDI CAPITAL'S TALLEST TOWER AND WOUNDS 11.",
      icon: towerIcon,
    },
  ];
  let by = 440;
  for (const b of bands) {
    const BH = 112;
    rect(LX, by, LW, BH, WHITE);
    frame(LX, by, LW, BH, INK, 2);
    b.icon(LX + 16, by + 8, 1);
    const bx = LX + 150, bw = LW - 150 - 18;
    drawText(b.kick, bx, by + 12, 2, RED, true);
    drawText(b.head, bx, by + 34, 4, NAVY, true);
    wrap(b.body, bw, 3).forEach((ln, i) => drawText(ln, bx, by + 68 + i * 22, 3, INK));
    by += BH + 10;
  }

  // ---- ticker ----
  const TY = by + 2;
  rect(LX, TY, LW, 84, NAVY);
  drawText("ALSO TODAY:", LX + 16, TY + 10, 2, GOLD, true);
  drawText("WHO EVACUATES STAFF FROM THE EBOLA ZONE IN CONGO.", LX + 16 + textW("ALSO TODAY: ", 2), TY + 10, 2, WHITE);
  drawText("US ARMY DETONATES 9,500 LB OF LEAD AZIDE IN IOWA.", LX + 16, TY + 34, 2, WHITE);
  drawText("FROM REPORTS BY REUTERS, CNN, XINHUA AND AP", LX + 16, TY + 58, 2, GREY);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
draw();
mkdirSync(outDir, { recursive: true });
const buf = png();
writeFileSync(join(outDir, "entry.png"), buf);
console.log(`wrote entry.png ${buf.length} bytes`);
