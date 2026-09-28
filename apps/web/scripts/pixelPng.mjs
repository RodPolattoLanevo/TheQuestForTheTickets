// Minimal from-scratch PNG encoder (no external image library) so pixel-art sprites can be
// authored as plain JS pixel grids and committed as real, tiny .png files. Used by the
// gen-*-art.mjs scripts in this folder - see ARCHITECTURE.md "Character/monster art".
import { deflateSync } from "node:zlib";

function crc32(buf) {
  const table =
    crc32.table ??
    (crc32.table = (() => {
      const t = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
      }
      return t;
    })());
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Encodes a pixel grid (array of rows, each row an array of [r,g,b,a] 0-255, or null/
 * undefined for fully transparent) into a real RGBA PNG buffer. No dependencies.
 */
export function encodePng(grid) {
  const height = grid.length;
  const width = grid[0].length;

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowBytes = width * 4;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (rowBytes + 1);
    raw[rowStart] = 0; // filter type: none
    for (let x = 0; x < width; x++) {
      const px = rowStart + 1 + x * 4;
      const c = grid[y][x];
      if (c) {
        raw[px] = c[0];
        raw[px + 1] = c[1];
        raw[px + 2] = c[2];
        raw[px + 3] = c[3] ?? 255;
      } else {
        raw[px] = raw[px + 1] = raw[px + 2] = raw[px + 3] = 0;
      }
    }
  }

  const idat = deflateSync(raw, { level: 9 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

/** Tiny drawing helpers used by the sprite-generation scripts. */
export function makeCanvas(width, height) {
  const grid = Array.from({ length: height }, () => new Array(width).fill(null));

  function set(x, y, color) {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    grid[y][x] = color;
  }

  function rect(x0, y0, x1, y1, color) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, color);
  }

  function ellipse(cx, cy, rx, ry, color) {
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) set(cx + x, cy + y, color);
      }
    }
  }

  /** Right triangle staircase, growing `width` px wider each row as y goes from y0 toward y1. */
  function stairs(x0, y0, y1, growPerRow, color, direction = 1) {
    const rows = Math.abs(y1 - y0) + 1;
    for (let i = 0; i < rows; i++) {
      const y = y0 + i * Math.sign(y1 - y0 || 1);
      const w = Math.max(1, Math.round(i * growPerRow));
      for (let dx = 0; dx < w; dx++) set(x0 + dx * direction, y, color);
    }
  }

  /** Adds a 1px outline color around the current silhouette (any painted pixel), without touching interior pixels. */
  function outline(color) {
    const additions = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (grid[y][x]) continue;
        const neighbors = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];
        if (neighbors.some(([nx, ny]) => ny >= 0 && ny < height && nx >= 0 && nx < width && grid[ny][nx])) {
          additions.push([x, y]);
        }
      }
    }
    for (const [x, y] of additions) grid[y][x] = color;
  }

  return { grid, set, rect, ellipse, stairs, outline, width, height };
}
