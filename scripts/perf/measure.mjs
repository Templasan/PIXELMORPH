#!/usr/bin/env node
/**
 * Repeatable before/after performance numbers for the foundation refactor
 * (docs/foundation-plan.md §7).
 *
 * Drives the app on a connected device/emulator with adb and, per scenario, reads
 * `dumpsys gfxinfo` (frames rendered, janky %, frame-time percentiles) around the action.
 * Cold start uses `am start -W` TotalTime. Each scenario runs RUNS times; the median is reported.
 *
 * Run it against a RELEASE build — debug JS is unoptimized and shows the dev overlay, so its
 * numbers don't mean anything:
 *   cd android && gradlew assembleRelease -PreactNativeArchitectures=x86_64
 *   adb install -r app/build/outputs/apk/release/app-release.apk
 *   node scripts/perf/measure.mjs --label baseline [--serial emulator-5554]
 *
 * Needs at least one photo project and one video project on the device. Elements are found by
 * their on-screen text / accessibility label (Portuguese UI), never by fixed coordinates.
 * Writes scripts/perf/results/<date>-<label>.json and prints a markdown table.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PKG = 'com.anonymous.pixelmorph';
const RUNS = 3;
const RESULTS_DIR = 'scripts/perf/results';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const LABEL = opt('label', 'run');
const SERIAL = opt('serial', process.env.ANDROID_SERIAL);
const SDK = process.env.ANDROID_HOME ?? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk');
const ADB = join(SDK, 'platform-tools', process.platform === 'win32' ? 'adb.exe' : 'adb');

// ---------- adb ----------

function adb(...a) {
  return execFileSync(ADB, [...(SERIAL ? ['-s', SERIAL] : []), ...a], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}
const shell = (cmd) => adb('shell', cmd);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- UI lookup ----------

/** Current view hierarchy as [{text, desc, clickable, x1, y1, x2, y2, cx, cy}]. */
function dumpUi() {
  shell('uiautomator dump /sdcard/pm-ui.xml');
  const xml = adb('exec-out', 'cat', '/sdcard/pm-ui.xml');
  const nodes = [];
  for (const m of xml.matchAll(/<node ([^>]*?)\/?>/g)) {
    const attr = (k) => (m[1].match(new RegExp(`${k}="([^"]*)"`)) ?? [])[1] ?? '';
    const b = attr('bounds').match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!b) continue;
    const [x1, y1, x2, y2] = b.slice(1).map(Number);
    nodes.push({
      text: attr('text'),
      desc: attr('content-desc'),
      clickable: attr('clickable') === 'true',
      x1,
      y1,
      x2,
      y2,
      cx: (x1 + x2) >> 1,
      cy: (y1 + y2) >> 1,
    });
  }
  return nodes;
}

const matches = (n, re) => re.test(n.text) || re.test(n.desc);

async function waitFor(re, timeoutMs = 8000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const hit = dumpUi().find((n) => matches(n, re));
    if (hit) return hit;
    await sleep(300);
  }
  throw new Error(`timeout waiting for ${re}`);
}

const tap = (n) => shell(`input tap ${n.cx} ${n.cy}`);
const swipe = (x1, y1, x2, y2, ms) => shell(`input swipe ${x1} ${y1} ${x2} ${y2} ${ms}`);

// ---------- gfxinfo ----------

function gfxReset() {
  shell(`dumpsys gfxinfo ${PKG} reset`);
}

/** Parses the aggregate block at the top of `dumpsys gfxinfo` (not the GPU or legacy lines). */
function gfxRead() {
  const out = shell(`dumpsys gfxinfo ${PKG}`);
  const num = (re) => Number((out.match(re) ?? [])[1] ?? NaN);
  return {
    frames: num(/^\s*Total frames rendered:\s*(\d+)/m),
    jankyPct: num(/^\s*Janky frames:\s*\d+\s*\(([\d.]+)%\)/m),
    p50: num(/^\s*50th percentile:\s*(\d+)ms/m),
    p90: num(/^\s*90th percentile:\s*(\d+)ms/m),
    p99: num(/^\s*99th percentile:\s*(\d+)ms/m),
  };
}

// ---------- navigation (labels as shown by the app) ----------

const PROJECTS_TITLE = /^Projetos$/;
const PHOTO_CARD = /· JPEG/; // project card accessibility label: "<name>, <date> · JPEG"
const VIDEO_CARD = /· MP4/;
const PHOTO_EDITOR_READY = /^Ajustes$/; // photo editor tool bar
const ADJUST_TOOL = /^Ajustes$/;
const SLIDER_LABEL = /^Saturação$/; // "Básico" tab of the Ajustes drawer
const VIDEO_EDITOR_READY = /^V1$/; // timeline track label
const TIMELINE_RULER = /^00:00$/; // first ruler tick; dragging the ruler scrubs without editing clips

async function launchToProjects() {
  shell(`am force-stop ${PKG}`);
  shell(`monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`);
  await waitFor(PROJECTS_TITLE, 15000);
  await sleep(1000);
}

async function openProject(tab, card, ready) {
  await launchToProjects();
  tap(await waitFor(tab));
  await sleep(800);
  const target = await waitFor(card);
  gfxReset();
  tap(target);
  await waitFor(ready, 15000);
  await sleep(1500); // let the editor settle so its first frames are in the sample
}

// ---------- scenarios ----------

async function coldStart() {
  shell(`am force-stop ${PKG}`);
  await sleep(800);
  const activity = shell(`cmd package resolve-activity --brief ${PKG}`).trim().split('\n').pop();
  const out = shell(`am start -W -n ${activity}`);
  const ms = Number((out.match(/TotalTime:\s*(\d+)/) ?? [])[1] ?? NaN);
  await sleep(1500);
  return { coldStartMs: ms };
}

async function openPhotoEditor() {
  await openProject(/^FOTOS$/, PHOTO_CARD, PHOTO_EDITOR_READY);
  return gfxRead();
}

async function photoDrawer() {
  await openProject(/^FOTOS$/, PHOTO_CARD, PHOTO_EDITOR_READY);
  const tool =
    dumpUi().find((n) => matches(n, ADJUST_TOOL) && n.clickable) ?? (await waitFor(ADJUST_TOOL));
  gfxReset();
  for (let i = 0; i < 5; i++) {
    tap(tool); // open
    await sleep(700);
    tap(tool); // close (tool buttons toggle)
    await sleep(700);
  }
  return gfxRead();
}

async function photoSlider() {
  await openProject(/^FOTOS$/, PHOTO_CARD, PHOTO_EDITOR_READY);
  tap(await waitFor(ADJUST_TOOL));
  const label = await waitFor(SLIDER_LABEL);
  // Track spans from the label column to the value column (see core/ui/Slider: 8px gaps).
  const value = dumpUi().find(
    (n) => n.text && n.x1 > label.x2 + 300 && Math.abs(n.cy - label.cy) < 10
  );
  const x1 = label.x2 + 120; // a drag starting on the track edge is not picked up
  const x2 = (value ? value.x1 : 1080 - 120) - 12;
  const mid = (x1 + x2) >> 1;
  gfxReset();
  for (let i = 0; i < 5; i++) {
    swipe(x1, label.cy, x2, label.cy, 800);
    swipe(x2, label.cy, mid, label.cy, 600); // end near the bipolar 0 so the test photo stays usable
  }
  await sleep(500);
  return gfxRead();
}

async function openVideoEditor() {
  await openProject(/^VÍDEOS$/, VIDEO_CARD, VIDEO_EDITOR_READY);
  return gfxRead();
}

async function videoTimeline() {
  await openProject(/^VÍDEOS$/, VIDEO_CARD, VIDEO_EDITOR_READY);
  const ruler = await waitFor(TIMELINE_RULER);
  const y = ruler.cy;
  const x1 = ruler.x1 + 10;
  const x2 = 1080 - 40;
  gfxReset();
  for (let i = 0; i < 5; i++) {
    swipe(x1, y, x2, y, 800);
    swipe(x2, y, x1, y, 800);
  }
  await sleep(500);
  return gfxRead();
}

async function sideMenu() {
  await launchToProjects();
  // Hamburger: the clickable icon left of the "Projetos" title (it has no label).
  const title = await waitFor(PROJECTS_TITLE);
  const burger = dumpUi().find(
    (n) => n.clickable && n.x2 <= title.x1 && n.y1 < title.y2 && n.y2 > title.y1
  );
  if (!burger) throw new Error('hamburger not found');
  gfxReset();
  for (let i = 0; i < 5; i++) {
    tap(burger);
    await sleep(900);
    shell('input keyevent KEYCODE_BACK'); // closes the drawer overlay
    await sleep(700);
    if (!dumpUi().some((n) => matches(n, PROJECTS_TITLE))) await launchToProjects();
  }
  return gfxRead();
}

const SCENARIOS = [
  ['cold-start', coldStart],
  ['open-photo-editor', openPhotoEditor],
  ['photo-drawer', photoDrawer],
  ['photo-slider', photoSlider],
  ['open-video-editor', openVideoEditor],
  ['video-timeline', videoTimeline],
  ['side-menu', sideMenu],
];

// ---------- run ----------

const median = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  return v.length ? v[(v.length - 1) >> 1] : NaN;
};

const results = {};
for (const [name, fn] of SCENARIOS) {
  const runs = [];
  let error;
  for (let r = 0; r < RUNS; r++) {
    try {
      runs.push(await fn());
    } catch (e) {
      error = String(e.message ?? e);
      break;
    }
  }
  const keys = runs.length ? Object.keys(runs[0]) : [];
  const med = Object.fromEntries(keys.map((k) => [k, median(runs.map((x) => x[k]))]));
  results[name] = { runs, median: med, ...(error && { skipped: error }) };
  console.error(`${name}: ${error ? `skipped (${error})` : JSON.stringify(med)}`);
}

mkdirSync(RESULTS_DIR, { recursive: true });
const date = new Date().toISOString().slice(0, 10);
const file = join(RESULTS_DIR, `${date}-${LABEL}.json`);
const device = shell('getprop ro.product.model').trim();
writeFileSync(file, JSON.stringify({ label: LABEL, date, device, runs: RUNS, results }, null, 2));

const f = (x) => (Number.isFinite(x) ? x : '—');
console.log(`\n${LABEL} · ${device} · median of ${RUNS} · ${file}\n`);
console.log('| Scenario | Cold start ms | Frames | Janky % | p50 ms | p90 ms | p99 ms | Note |');
console.log('|---|---|---|---|---|---|---|---|');
for (const [name, r] of Object.entries(results)) {
  const m = r.median;
  console.log(
    `| ${name} | ${f(m.coldStartMs)} | ${f(m.frames)} | ${f(m.jankyPct)} | ${f(m.p50)} | ${f(m.p90)} | ${f(m.p99)} | ${r.skipped ?? ''} |`
  );
}
