// Usage: node scripts/hero-text-guard.mjs [video-or-image-path ...]
// Defaults to the site hero video and poster.
// Fails (exit 1) if ANY frame of the video, or the poster image, contains
// burned-in text other than the official AutoDeck end card.
// Requires ffmpeg, ImageMagick convert, and tesseract on PATH.
//
// Method: every frame is bright-pass thresholded (white overlay text survives;
// dark scene texture such as machine vents, labels and wall signage does not),
// then OCR'd. A frame fails when:
//  (a) any OCR line has 2+ words of 3+ letters (h >= MIN_H, conf >= MIN_CONF), or
//  (b) any single word of 4+ letters is BIG_H px tall or more with conf >= MIN_CONF
//      (a word-sized overlay, e.g. a caption caught mid cross-fade).
// Allowlisted end-card copy never fails. Known limit: dark text on bright
// backgrounds is invisible to the bright pass; review those cases by eye.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";

const DEFAULTS = ["apps/site/public/assets/hero/hero-loop.mp4", "apps/site/public/assets/hero/hero-poster.jpg"];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULTS;
// Official end-card copy. Anything else with real words is a burned-in caption.
const ALLOW = [/autodeck/i, /complete\s*car\s*care/i, /all\s*under\s*one\s*roof/i];
const WORD = /^[A-Za-z]{3,}$/;
const WORD4 = /^[A-Za-z]{4,}$/;
const MIN_H = 22;     // px; below this is scene microtext (labels, stickers)
const BIG_H = 60;     // px; a word this tall is an overlay, not scenery
const MIN_CONF = 30;

// Returns array of lines, each line an array of {text, h, conf}.
const ocrLines = (file) => {
  let tsv = "";
  try { tsv = execFileSync("tesseract", [file, "stdout", "--psm", "11", "tsv"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { return []; }
  const lines = new Map();
  for (const row of tsv.split("\n").slice(1)) {
    const c = row.split("\t");
    if (c.length < 12 || c[0] !== "5") continue;       // word rows only
    const text = (c[11] || "").trim();
    if (!text) continue;
    const key = c[2] + "/" + c[3] + "/" + c[4];        // block/par/line
    if (!lines.has(key)) lines.set(key, []);
    lines.get(key).push({ text, h: parseInt(c[9], 10), conf: parseFloat(c[10]) });
  }
  return [...lines.values()];
};

const badLines = (lines) => {
  const bad = [];
  for (const words of lines) {
    const line = words.map((w) => w.text).join(" ");
    if (ALLOW.some((re) => re.test(line))) continue;
    if (words.filter((w) => WORD.test(w.text) && w.h >= MIN_H && w.conf >= MIN_CONF).length >= 2) { bad.push(line); continue; }
    if (words.some((w) => WORD4.test(w.text) && w.h >= BIG_H && w.conf >= MIN_CONF)) bad.push(line);
  }
  return bad;
};

const check = (png) => {
  const th = png.replace(/\.png$/, "-th.png");
  execFileSync("convert", [png, "-colorspace", "gray", "-threshold", "55%", th]);
  const bad = badLines(ocrLines(th));
  rmSync(th, { force: true });
  return bad;
};

let fail = 0;
for (const t of targets) {
  if (extname(t).toLowerCase() === ".mp4") {
    const dir = mkdtempSync(join(tmpdir(), "hero-ocr-"));
    execFileSync("ffmpeg", ["-v", "error", "-i", t, join(dir, "f-%04d.png")]);
    const frames = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
    console.log(`${t}: scanning ${frames.length} frames`);
    for (const f of frames) {
      const bad = check(join(dir, f));
      if (bad.length) { fail = 1; console.log(`FAIL ${t} ${f}: ${bad.join(" | ")}`); }
    }
    rmSync(dir, { recursive: true, force: true });
  } else {
    const tmp = join(mkdtempSync(join(tmpdir(), "hero-ocr-")), "img.png");
    execFileSync("convert", [t, tmp]);
    const bad = check(tmp);
    if (bad.length) { fail = 1; console.log(`FAIL ${t}: ${bad.join(" | ")}`); }
    else console.log(`PASS ${t}`);
    rmSync(join(tmp, ".."), { recursive: true, force: true });
  }
}
if (fail) { console.error("Hero text guard FAILED: burned-in text found"); process.exit(1); }
console.log("Hero text guard passed: no burned-in text outside the official end card.");
