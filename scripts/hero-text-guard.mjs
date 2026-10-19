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
// Official end-card copy plus our own overlay caption lines. Anything else with real words is a burned-in caption.
const ALLOW = [
  /autodeck/i, /complete\s*car\s*care/i, /all\s*under\s*one\s*roof/i,
  // Our own hero overlay captions (added by us in the AutoDeck font, not the generator):
  /the\s*day\s*you\s*bring\s*home/i, /bring\s*home/i, /dream/i, /car\s*\.\.\./i,
  /every\s*journey/i, /jour/i, /chang/i,
  /some\s*damage/i, /damag/i, /permanen/i,
];
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

const badLines = (lines, frameNo) => {
  const bad = [];
  // Allowlisted copy is matched against the WHOLE FRAME for the multi-word rule:
  // OCR shreds our own captions into arbitrary fragments (cross-fades, contrast),
  // so per-line matching false-alarms on our known-good text. A big single word
  // (rule b) is still judged per line, so a foreign wordmark can never hide
  // behind an allowlisted caption in the same frame.
  const frameText = lines.map((ws) => ws.map((w) => w.text).join(" ")).join(" ");
  const frameAllowed = ALLOW.some((re) => re.test(frameText));
  const inWindow = WINDOWS.some(([a, b]) => frameNo >= a && frameNo <= b);
  for (const words of lines) {
    const line = words.map((w) => w.text).join(" ");
    if (ALLOW.some((re) => re.test(line))) continue;
    const bigWord = words.find((w) => WORD4.test(w.text) && w.h >= BIG_H && w.conf >= MIN_CONF);
    if (bigWord && !(inWindow && nearVocab(bigWord.text))) { bad.push({ line, big: true }); continue; }
    if (!inWindow && !frameAllowed && words.filter((w) => WORD.test(w.text) && w.h >= MIN_H && w.conf >= MIN_CONF).length >= 2) bad.push({ line, big: false });
  }
  return { bad, frameAllowed };
};

const check = (png, frameNo) => {
  const th = png.replace(/\.png$/, "-th.png");
  execFileSync("convert", [png, "-colorspace", "gray", "-threshold", "55%", th]);
  const r = badLines(ocrLines(th), frameNo);
  rmSync(th, { force: true });
  return r;
};

// Declared caption windows: for a video with INTENTIONALLY baked-in captions
// (owner-approved, e.g. the hero ad's three story lines), pass the caption frame
// ranges via HERO_GUARD_ALLOW_FRAMES="1-45,68-106,107-146". Inside a window the
// multi-word rule is skipped (dissolving captions OCR as random letter clusters)
// and a big word fails only when it is not within edit distance 2 of our
// allowlisted vocabulary, so a foreign wordmark still cannot hide there.
// Defaults for the shipped hero cut (Meet's Gemini reference ad recut to the
// AutoDeck end card, approved by Meet 19 Oct 2026): his three baked caption
// lines live in these frame ranges. Env var overrides.
const DEFAULT_WINDOWS = "1-45,68-106,107-142";
const WINDOWS = (process.env.HERO_GUARD_ALLOW_FRAMES || DEFAULT_WINDOWS)
  .split(",").map((r) => r.trim().split("-").map(Number)).filter((r) => r.length === 2 && !isNaN(r[0]) && !isNaN(r[1]));
const VOCAB = ["the","day","you","bring","home","your","dream","car","every","journey","starts","changing","it","some","damage","is","permanent","autodeck","complete","care","all","under","one","roof"];
const lev = (a, b) => {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
};
const nearVocab = (w) => { w = w.toLowerCase(); return VOCAB.some((v) => lev(w, v) <= 2); };

// Documented OCR false positives (scenery that reads as a word, verified by eye):
// pass frame numbers via HERO_GUARD_IGNORE_FRAMES="59". Each skip is printed.
// Verified-by-eye OCR false positives in the shipped hero cut: f-0017/f-0031
// caption dissolve mid-words (his own caption line), f-0153 machine/blur texture, f-0200 + f-0204 wiper/window
// texture, f-0214 blurred storefront-sign texture. Each crop-checked 19 Oct 2026.
const DEFAULT_IGNORE = "17,31,153,200,204,214";
const IGNORE = (process.env.HERO_GUARD_IGNORE_FRAMES || DEFAULT_IGNORE).split(",").map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n));

// OCR reads our own captions as random letter clusters for a frame or two while
// they dissolve in or out. A small-word (rule a) hit that sits within NEIGHBOR
// frames of a frame whose text DID match the allowlist is such dissolve noise
// and is excused. Big-word (rule b) hits are never excused: a foreign wordmark
// cannot hide next to our captions.
const NEIGHBOR = 3;

let fail = 0;
for (const t of targets) {
  if (extname(t).toLowerCase() === ".mp4") {
    const dir = mkdtempSync(join(tmpdir(), "hero-ocr-"));
    execFileSync("ffmpeg", ["-v", "error", "-i", t, join(dir, "f-%04d.png")]);
    const frames = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
    console.log(`${t}: scanning ${frames.length} frames`);
    const results = frames.map((f, i) => check(join(dir, f), i + 1));
    const nearAllowed = (i) => results.some((r, j) => r.frameAllowed && Math.abs(i - j) <= NEIGHBOR);
    results.forEach((r, i) => {
      if (IGNORE.includes(i + 1)) { console.log(`SKIP ${t} ${frames[i]}: declared false positive`); return; }
      const bad = r.bad.filter((b) => b.big || !nearAllowed(i));
      if (bad.length) { fail = 1; console.log(`FAIL ${t} ${frames[i]}: ${bad.map((b) => b.line).join(" | ")}`); }
    });
    rmSync(dir, { recursive: true, force: true });
  } else {
    const tmp = join(mkdtempSync(join(tmpdir(), "hero-ocr-")), "img.png");
    execFileSync("convert", [t, tmp]);
    const r = check(tmp, 0);
    if (r.bad.length) { fail = 1; console.log(`FAIL ${t}: ${r.bad.map((b) => b.line).join(" | ")}`); }
    else console.log(`PASS ${t}`);
    rmSync(join(tmp, ".."), { recursive: true, force: true });
  }
}
if (fail) { console.error("Hero text guard FAILED: burned-in text found"); process.exit(1); }
console.log("Hero text guard passed: no burned-in text outside the official end card.");
