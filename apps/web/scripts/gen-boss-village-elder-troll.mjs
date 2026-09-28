// Pixel-art sprite for the "Village Elder Troll" boss (World 1: The Forgotten Village -
// see packages/database/prisma/seed.ts, monster key "village-elder-troll"). Original,
// hand-designed via code (no copyrighted assets) - see ARCHITECTURE.md.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { encodePng, makeCanvas } from "./pixelPng.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "public", "monsters");
mkdirSync(outDir, { recursive: true });

const SKIN = [79, 107, 47, 255];
const SKIN_LT = [111, 154, 69, 255];
const SKIN_DK = [51, 74, 29, 255];
const BROWN = [107, 74, 43, 255];
const BROWN_DK = [74, 50, 26, 255];
const CLUB = [138, 98, 57, 255];
const CLUB_DK = [90, 63, 34, 255];
const HORN = [58, 42, 24, 255];
const TUSK = [234, 226, 200, 255];
const EYE = [240, 102, 58, 255];
const OUTLINE = [17, 10, 6, 255];

const W = 28;
const H = 34;
const c = makeCanvas(W, H);

// --- Torso (trapezoid: broad shoulders tapering to the waist) -------------------------
for (let y = 15; y <= 23; y++) {
  const t = (y - 15) / (23 - 15);
  const left = Math.round(4 + t * (9 - 4));
  const right = Math.round(23 - t * (23 - 18));
  c.rect(left, y, right, y, SKIN);
}
// loincloth
c.rect(7, 24, 20, 26, BROWN);
c.rect(7, 27, 20, 28, BROWN_DK);
// chest highlight + center shadow line for a bit of musculature
c.ellipse(12, 18, 3, 4, SKIN_LT);
for (let y = 16; y <= 23; y++) c.set(14, y, SKIN_DK);

// --- Neck -------------------------------------------------------------------------------
c.rect(12, 13, 15, 15, SKIN);

// --- Head ---------------------------------------------------------------------------------
c.ellipse(14, 9, 6, 5, SKIN);
c.ellipse(11, 7, 2, 2, SKIN_LT);
c.rect(10, 8, 11, 9, EYE);
c.rect(16, 8, 17, 9, EYE);
c.rect(10, 12, 10, 13, TUSK);
c.rect(17, 12, 17, 13, TUSK);

// --- Left horn (staircase silhouette, curving up and outward, flush against the head) ---
c.stairs(9, 6, 1, 0.6, HORN, -1);

// --- Left arm (relaxed, hanging) ---------------------------------------------------------
c.rect(2, 16, 5, 26, SKIN);
c.rect(2, 22, 3, 26, SKIN_DK);
c.ellipse(3, 27, 2, 2, SKIN);

// --- Right arm (raised, holding the club) -------------------------------------------------
c.rect(21, 8, 24, 17, SKIN);
c.ellipse(23, 7, 2, 2, SKIN);
c.rect(19, 1, 27, 7, CLUB);
c.rect(19, 1, 20, 7, CLUB_DK);
c.set(20, 0, HORN);
c.set(23, 0, HORN);
c.set(26, 0, HORN);

// Right horn peeks out just above the raised club/arm (mostly hidden behind them, which
// reads naturally for a forward-facing pose).
c.stairs(19, 4, 1, 0.6, HORN, 1);

// --- Legs ---------------------------------------------------------------------------------
c.rect(15, 29, 16, 32, SKIN_DK);
c.rect(17, 29, 19, 32, SKIN);
c.rect(9, 29, 13, 32, SKIN);
c.rect(7, 33, 13, 33, BROWN_DK);
c.rect(16, 33, 22, 33, BROWN_DK);

// --- Outline pass (1px dark border around the whole silhouette) -------------------------
c.outline(OUTLINE);

const png = encodePng(c.grid);
const outPath = join(outDir, "village-elder-troll.png");
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${W}x${H}px source, display it scaled up with image-rendering: pixelated)`);
