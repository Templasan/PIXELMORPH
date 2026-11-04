# Sprint 2: plan from a code audit (2026-10-22)

Each acceptance criterion of US-01, 10, 12, 16, 17, 30 and 33 was traced from the UI to the effect
(store → persistence/render/export → Kotlin), read-only. Status: **DONE**, **PARTIAL**, **FAKE**
(UI without real effect, forbidden by agent-rules), **MISSING**. Effort: S ≤ ½ day, M ≤ 2 days,
L > 2 days. Nothing was run on a device for this audit; "unverified" items are marked.

`backlog/SPRINT_2_STATUS.md` overstates several stories (e.g. US-16 "complete"); fix it as part of this plan.

## Closing status (2026-10-28)

Both editors are web apps hosted in a WebView (`video-editor-web/`, `photo-editor-web/`), merged
into `sprint-2` (local); the old React Native editors are deleted. Checked: 129 + video-editor-web
vitest suites, app jest 537 tests, tsc, eslint (0 errors); acceptance walked on the emulator by
criterion (two passes, 2026-10-28) and the photo editor measured on the Poco (50 MP: slider 120
fps, open ~0.5-1 s, full-size export ~3.4-5.5 s). Criteria marked "device" need the phone.

| Story | Done | Missing / partial |
| --- | --- | --- |
| US-01 Projects | grid with thumbnail/date/type (RF-001); info panel with size, bitrate, real edit history (RF-037); reminders with due date + priority UI (RF-070); 480x800-1440x3120 layouts (RNF-015); cold start ~0.5 s (RNF-007); APK 62 MB (RNF-014) | "Codificação" shows the MIME type, not the codec; reminder notification (needs `expo-notifications`); login/2FA/sync (RNF-001/002, owner: last); the editors' texts are Portuguese only (RNF-016: the app's language setting translates the rest; the old editors were not translated either) |
| US-10 Composition | collage layouts with spacing, borders, colours, shadow (RF-011); shapes/arrows with colour and width (RF-044); text with fonts, colours, shadow, outline (RF-008); meme and stickers (RF-046) | custom collage layout and moving a photo inside its cell; text in/out animations are a video feature (photo text has none) |
| US-12 Compare/guides/shortcuts | compare divider (RF-019), magnetic guides to centre and other layers (RF-067), 2/3-finger taps + Ctrl+Z (RF-076) — browser-checked | not walked on the emulator (multi-touch cannot be driven by adb); "distribute evenly" |
| US-16 Transitions | slide/fade/zoom/wipe per junction with duration and live preview, exported as previewed (RF-032, slide checked: 18.03 s file = timeline) | reorder by dragging a clip past its neighbour (the free timeline only moves into gaps; RF-058); more than two clips not walked |
| US-17 Speed | constant speed per clip, followers pushed (RF-049, 0.5x checked) | speed ramps at points (domain `speedRamp.ts`, no UI); time-lapse from a photo sequence with seconds per photo (RF-023) |
| US-30 Export | photo JPEG/PNG/WebP/HEIC (Android 9+), quality, target size, DPI, watermark, social crops (RF-057); video MP4 720p/1080p and GIF with fps/colours (RF-061) | video social presets (RF-017); scene-adaptive compression (RNF-013); 1 min Full HD in ≤ 2 min not measured on the phone (RNF-011, device) |
| US-33 Audio | background music with volume and fade in/out (RF-036, in the clip panel; not walked) | mic gain and separate audio track (RF-018, owner: TODO); device test of music sync |

Pending owner answers: which test projects to delete on the Poco; pushing `sprint-2`; which
missing items enter this sprint and which move to Sprint 3.

**Note 2026-11-02 (done after the status above):** drag reorder with ripple, speed ramp, time-lapse, social presets, codec in the info panel, reminder notifications, mic gain with a separate audio track, editors translated, optional login (e-mail, Google, verification e-mail). HTTPS sync code exists (stage 2, see ADR-006: the project list in Supabase, files on the owner's media server); the device test is still pending. The table above is not rewritten.

Later improvement for the verification e-mail: opening the link on another device leaves a blank page and the app waiting. Options: a 6-digit code in the e-mail (works on any device, no redirect), or the waiting screen retrying sign-in; a websocket does not fit because the account has no session until it is confirmed.

### Pending tests (parked by the owner, 2026-11-02)

**Owner, real accounts (emulator `Pixel_7`, build `C:/apks/PixelMorph-sync4-x86_64.apk`):** two accounts stay separate (a second account's rows and the other emulator do not receive them); forgot password link opens "Nova senha"; Google login, then "Criar senha", then e-mail + password; terms line under the Google button.

**Phone (Poco, build `PixelMorph-sync4-arm64.apk`, `adb install -r` only):** RNF-011 one minute of Full HD exported in 2 minutes or less; reminder notification time (read 06:00 on the emulator); mic gain with real AAC; video social presets; background music across cuts; heavy photo bake, to see whether the emulator's "GPU hang" happens on a phone; smart compression on a real clip; drag a photo inside a collage cell; 2 and 3 finger shortcuts (owner, by hand). Sync on the phone only if the owner decides, since it sends real projects.

**Also not done:** distribute evenly with spread-out layers on a device (layers created at one spot do not move, as expected); the 14 emulator projects with missing files are believed to predate sync, not proven.

## Where each story stands

| Story | Done | Partial | Fake | Missing | Main gaps |
|---|---|---|---|---|---|
| US-01 Projects | grid + thumbnails | info panel, reminders, Android 9/size/layout/i18n checks | login + 2FA, account data | HTTPS sync | backend-dependent RNFs |
| US-10 Composition | collage layouts, borders, meme, fonts | shapes colors, stickers (emoji unverified), text color/shadow/stroke controls | text in/out animation | collage shadows, custom layout, move photo in cell, image layer, text on video | text on video is L |
| US-12 Compare/guides/shortcuts | — | compare divider (likely gesture bug), guides (no distribute), gesture shortcuts | — | — | small |
| US-16 Transitions | reorder, per-junction transition | 4 transitions (preview ≠ export), merge (only 1st video track) | — | — | live two-clip transition needs native GPU |
| US-17 Speed | constant speed per clip | speed ramp (steps, not smooth), time-lapse (preview only) | — | — | time-lapse missing from the mp4 |
| US-30 Export | JPEG/PNG/WebP, GIF, photo social presets | target size, video presets | "PRO" panel (DPI, color space, PSD/TIFF, watermark) | HEIC | RNF-011 unmeasured |
| US-33 Audio | — | capture audio (embedded), meter (before recording only), volume/fades, mix | — | mic gain, sync with cuts, hearing A1 while editing | import duration bug |

## P0: bugs that change the result (do first)

| # | Bug | Evidence | Effort |
|---|---|---|---|
| 1 | Export ignores the image track: time-lapse, its speed and transitions are missing from the mp4; a photo-only project exports nothing and fails silently | `exportPlan.ts:65-66`, `VideoExportSheet.tsx:106`, Kotlin `:362` | M |
| 2 | Changing a clip's speed does not ripple: the clip overlaps the next one; preview and export disagree | `ClipPanel.tsx:81,243`, `videoEditorStore.ts:154-158` | S |
| 3 | Imported background audio always gets 30 s, the file is never probed | `AddClipSheet.tsx:61` | S |
| 4 | Fade-out clamped to the source length, not the trimmed length → audio starts attenuated; the test pins the wrong value | `exportPlan.ts:125`, `video-export-plan.test.ts:146-168` | S |
| 5 | Preview ≠ export: gaps show black in preview but close in export; wipe "pops" vs pushes; slide/zoom directions inverted; duration clamp differs | `timeline.ts:279-285`, `exportPlan.ts:68-98`, `PreviewDerived.tsx:42` | M (via the shared frame plan below) |
| 6 | Text layers: possible loss when created before `loadLayers` finishes (`hydrateLayers` replaces the list; the editor lock does not wait for it). Also default white text with no shadow/stroke is invisible on light photos | `PhotoEditorScreen.tsx:509-515,1136`, `photoEditorStore.ts:81-89` | S (verify on emulator first) |
| 7 | Compare divider uses `e.x` (relative to the moving divider) instead of `absoluteX` | `PhotoEditorScreen.tsx:189-205` | S |

## P1: shared frame plan (foundation for US-16/17 and the fixes above)

One pure TypeScript function "what is on screen at time t" (clip, source time, speed, transition,
layers) used by both the preview (`PreviewDerived`) and the export plan (`exportPlan.ts`), with tests.
Fixes #5 by construction and makes #1/#2 testable. Lesson from the Concat study (foundation-plan.md).
Effort: M.

## P2: fakes (agent-rules forbid UI without effect): implement or hide

| Item | Evidence | Proposal |
|---|---|---|
| Text in/out animation sliders store values nobody reads | `ElementsDrawer.tsx:190-203`, `Layer.ts:67-68` | hide until text on video exists |
| Projects: share, send, search, sort do nothing | `ProjectsScreen.tsx:243-256` | search + sort (S), share via RN `Share` (S) |
| Account: hard-coded name, e-mail, "3 ativos"; login/2FA fake; app opens straight into Projects | `AccountScreen.tsx:38-51`, `LoginScreen.tsx`, `RootNavigator.tsx:98` | **team/professor decision** (see below) |
| Export "PRO" panel: DPI, color space, PSD/TIFF, watermark without effect | `ExportSheet.tsx:379,442` | hide, or implement watermark (S-M) |
| Help screen lists gestures that do not exist | `HelpScreen.tsx:25-31` | rewrite from the real gestures (S) |

## P3: missing/partial criteria that fit the current stack

| Story | Item | Effort |
|---|---|---|
| US-33 | Hear the A1 (music) track while editing (expo-audio is installed) | M |
| US-33 | Audio follows cuts/ripple of the video | M |
| US-33 | Overlapping audio clips are mixed, not cut | M |
| US-33 | Level meter also during recording | S |
| US-17 | Smooth speed ramp with free start/target | S-M |
| US-17 | Time-lapse: seconds per photo control | S |
| US-10 | Collage cell shadows; free color picker for text/shapes; text shadow/stroke controls | S each |
| US-10 | Image layer over the photo; move/scale photo inside a collage cell; custom collage layout | M each |
| US-12 | Distribute objects evenly; "save" shortcut actually saves | M / S |
| US-30 | Smart compression rejects PNG; encode once per iteration; video "auto" preset | S each |
| US-01 | Codec name in the info panel; reminders by priority (+ system notification: new dep `expo-notifications`) | S / M |
| US-01 | Hard-coded PT strings to i18n; layout check at 480×800 and 1440×3120 | S |
| fix | `SPRINT_2_STATUS.md` brought in line with this audit; false code comments (`VideoExportSheet.tsx:67-71`, Kotlin `:259-263`, `exportPlan.ts:171`) | S |

## Needs a decision (L effort, or outside the current stack)

| Item | Why it is big | Options |
|---|---|---|
| Login + 2FA (RNF-001), HTTPS sync (RNF-002) | needs a backend and auth provider | out of the app scope for this sprint / minimal backend / mark as future |
| Live transition with both clips moving (RF-032) | needs native GPU preview (two decoders composited) | keep the still-frame approximation (but fix #5) / native spike later |
| Text over video + in/out animations (RF-008) | text in the video pipeline: Media3 overlay in export + RN overlay in preview | M-L; next sprint |
| Mic input gain, separate audio track at capture (RF-018) | native capture module | descope / next sprint |
| HEIC export (RF-057) | native encoder | descope |
| Video "Original" capped at 1080p | encoder time vs quality | keep cap / add explicit 4K |
| Android 9 (minSdk 26 today) and RNF-011 (1 min Full HD in ≤ 2 min) | must be measured on the phone | measure when the phone is available |

## Suggested order

1. P0 #6, #7, #2, #3, #4 (small, user-visible), then P1 (shared frame plan) which closes #5 and carries #1.
2. P2 (remove/implement fakes).
3. P3 by story, audio first (US-33 has the most gaps).
4. Decisions above with the team; measure on the phone (Android 9, RNF-011, startup, memory).

Every item: one commit per story/fix, tests for the pure logic, live check on the emulator,
measurement only on release builds (see agent-briefing.md §3).

## Progress and what is left (2026-10-22)

Owner decisions: every item stays in the sprint (login + 2FA + sync, HEIC, mic gain, text over
video included). Gaps behave like Sony Vegas (real black gaps in preview and export; later they
accept dropped media). Speed changes ripple. Each transition has a mode: **Saida** (default, all
4 types: the new clip plays underneath, the old frame leaves on top) or **Entrada** (slide and
wipe: the new clip pushes the old one out). Nothing goes into `sprint-2` before the owner sees it.

### Done, on branches not yet merged into `sprint-2`

- `worktree-agent-a34516139c6cd9d3a` (part 1, on top of `f4918d6`):
  `21abfb3` speed ripple (P0 #2) · `e974cce` shared frame plan `domain/framePlan.ts` used by
  preview and export, gaps as black frames, image track exported, fade clamp, real error on an
  empty plan (P0 #1, #4, #5, P1) · `20b254c` timeline rolled back after a tap on a clip
  (pans now use onStart/onFinalize; `commit()` drops a stale gesture snapshot) · `8b2039d`
  unique file names (duplicate time-lapse photos) · `4453de5` export sheet clip count ignores
  gaps · `14e672a` photo-only projects open as an image sequence.
- `transitions-in-out` (`bd74a9d`, on top of part 1): Saida/Entrada mode, selector in ClipPanel,
  Kotlin MatrixTransformation for Entrada. 474 tests. Emulator APK:
  `C:\apks\PixelMorph-transitions-x86_64.apk`.

Emulator result: **export correct in all 6 combinations**; the preview still glitches.

### Next (in order)

1. Transition preview fixes, on a branch from `transitions-in-out`:
   - flash of a stale frame for 1-3 frames at each transition start: the outgoing frame is
     extracted when the transition starts. Prefetch the outgoing last frame and the incoming
     in-point frame per transition when the timeline changes, keyed by transition, and never
     render a frame whose key does not match;
   - dark / one black frame: the incoming player is not ready (seek to the in-point). Show the
     prefetched in-point frame under the live player until it is ready;
   - extra fade "ghost" in slide and wipe Saida: find the extra opacity/layer in
     `VideoEditorScreen.tsx`;
   - split frame when stopping exactly on a cut (seen at 7.733 s);
   - UX: the Transicao tab hides the timeline; the duration slider stops at about half the clip.
2. Re-test on the emulator, send the preview/export comparison to the owner, and after the owner
   approves merge part 1 + transitions into `sprint-2` and push.
3. Then one part at a time, asking the owner's decisions first:
   - photo editor: P0 #6 (text layers lost / invisible), #7 (compare divider), US-10 and US-12 P3 items;
   - projects / help / i18n (P2 fakes: search, sort, share, help gestures);
   - photo export US-30: PRO panel, smart compression, HEIC (needs the minSdk 28 decision);
   - audio US-33 (P0 #3 import duration, hear A1 while editing, follow cuts, mix);
   - native capture with mic gain;
   - text over video + in/out animations;
   - login / 2FA / HTTPS sync with Supabase (the owner creates the account);
   - drop media into a gap; zoom Entrada;
   - bring `backlog/SPRINT_2_STATUS.md` in line with this audit.
4. Later: phone measurements (Android 9, RNF-011, startup, memory) when the owner allows.

### Done on `video-engine` (2026-10-22, night; emulator-checked, owner review pending)

- Photo editor: compare divider follows the finger (P0 #7, `c6347e3`); editor waits for saved
  layers and new text has a dark outline (P0 #6, `7b9f6fb`, `0f5733e`); fake text animation
  sliders removed (`fdd1750`); outline colour control (`2b3ad85`). No free colour picker (no
  component in the app; would need a new dependency).
- Projects: search + sort (`513e8a3`); dead share/upload icons removed (`f8687bc`; real file
  share needs `expo-sharing`, owner decision); selection deletes projects (`12e30f6`).
- Help: real gestures and answers, dead support rows removed (`135a6a0`).
- Photo export: real watermark and DPI (JPEG JFIF, PNG pHYs), PSD/TIFF/ICC/colour space removed
  (`232340f`). Watermark settings reset when the sheet closes; the light grey text is faint on
  light photos.

### Owner decisions (2026-10-23)

- New dependencies approved: `expo-sharing` (share a project's file), a colour picker library
  (`reanimated-color-picker` or similar, MIT) for free text/shape colours.
- `expo-keep-awake` NOT approved yet: background video export stays a TODO (briefing §6 #16).
- Photo export sheet remembers its options while the photo is open; the watermark is white with
  a dark shadow.
- HEIC export only on Android 9+ (minSdk stays 26; the option is hidden below API 28).
- Removed in fd7fa5d: the "Motor web (teste)" link and the engine spike screen.
- RF-018 separate audio track + mic gain: TODO (camera records video with embedded audio and
  shows a level meter; no gain, no separate track yet).
- Login / 2FA / sync: last, after the rest of the sprint.
- Merge `video-engine` into `sprint-2` and push after the test on the owner's Poco passes.

### TODO: photo editor (owner test, 2026-10-23)

Still has performance problems and problems with some imported formats. Owner asked to leave
it for later; details to collect when it is picked up (which formats, which actions are slow).

### TODO: feasibility research, lighter preview copies (owner, 2026-10-23)

Measure on the Poco before changing defaults (fps, seek time, `dumpsys meminfo`, file size,
proxy creation time), one variable at a time, current proxy side by side:

Video proxies (`previewProxy.ts` + the native exporter):
1. Cap proxies at 30 fps: they keep the source rate today, so a 4K60 source makes a 60 fps
   proxy and the decoder does twice the work for a 30 fps preview.
2. Tone-map HDR (10-bit) sources to 8-bit SDR in the proxy, if the Poco records HDR.
3. Lower the bitrate: 720p at ~3 Mbps instead of 5 (540p and 1080p in proportion).
4. Decode-friendly encoding, like desktop editing proxies (ProRes/DNxHR are not decodable by
   Android hardware): all-intra or very short GOP + H.264 Baseline (no B-frames). Expected:
   near-instant seeks/scrubbing, fewer reference frames; cost: 3-5x larger files.
5. Light denoise before encoding (smaller file at the same look; little decode effect).
Expectation to verify: these mostly cut decode work, seek time and storage; RAM depends on
resolution and how many decoded frames are queued (see the memory items: smaller decoder
queues, release frames right after drawing, canvas at the on-screen size).

Photo light copies (`photoProxy.ts`, `.proxy2048.jpg`):
6. Same question for photos: JPEG quality / WebP of the light copy, and whether a smaller long
   edge (e.g. 1600) is enough on screen; measure editor load time, memory and slider
   responsiveness. Export always uses the full-resolution original.

Stopped agents' worktrees with no commits, not reviewed: `agent-a035d0c451c1ad4a7` (photo
editor), `agent-a8e35341c622da6aa` (photo export / HEIC). Delete or reuse when those parts start.

## Owner decisions, 2026-11-03

- Everything that depends on the Poco waits (see "Pending tests" above). Testing continues on the emulator.
- The 6-digit e-mail verification code waits; the link flow stays for now.
- Sprint 3 stories are brought into this sprint to get ahead. The owner intends to publish on Google Play after the college work, so no choice may block that (see `docs/melhorias/08-produto-e-lancamento.md`).

Sprint 3 stories brought in, in order: US-20 (window border added; window move and resize came with the layers). Next candidates: US-22, US-02, US-32.

US-22 brought in: timer length (3, 5, 10 s) with cancel, stop-motion plays at the picked rate. Frames show in a strip, not the grid the story words it as.

US-02 brought in: the Presets screen now lists the real saved presets, with delete; batch apply shows progress. The final size is now a setting of the photo (RF-015, as the owner proposed): shown in the top bar, applied by the export, undoable and carried by a batch.

US-32 brought in: QR code layers checked as readable before saving, and text or logo watermarks kept for other photos. The older export-only watermark stays.

US-06 brought in: masks as layers (painted, by colour, linear, radial, selective focus), each changing brightness, contrast, saturation and blur of what is under it.

US-07 brought in: clone brush and liquify (push, pull, twirl), each a layer drawn in the scene path.

US-26 partly brought in: palette and harmonies (RF-010), crop suggestions by thirds and golden section with a non-destructive crop (RF-042), 34 ms in the browser (RNF-012). Open: scene recognition (RF-034) needs a model; converging lines are not analysed.

US-27 brought in with shader filters, not a trained model: watercolour, oil and charcoal, with intensity and the compare divider. They are honest filters, so they should not be presented as AI.

US-28 brought in: automatic alignment by matching the shared area (22 ms for a pair, right overlap and shift on real crops), keeping manual correction per photo.

US-24 partly brought in: remove a painted or circled object, filled from nearby texture, as a layer (RF-055). Open: automatic subject cutout (RF-004) needs a model.

US-29 partly brought in: an animated thumbnail of the best moments, chosen by detail and scene change (RF-030). Open: captions from speech (RF-069) need a model.

US-31 brought in: PSD with separate rasterized layers (checked with psd-tools; not opened in Photoshop itself), DPI, a simulated CMYK print proof, and sRGB, Display P3 and Adobe RGB output. In a PSD, adjustments and masks are baked into the bottom layer, and crop and social frames are left out. Adobe RGB needs JPEG or PNG.

US-13 brought in: a viewer for side-by-side and over-under photos, following the device tilt (or moving by itself), with pause and exit. Detection is by file name and shape, so it is offered, never forced; MPO files are not read. Tilt checked with simulated events.

US-36 brought in: the Tutorials screen now opens a sample photo (drawn by a script, nothing licensed from others) in the editor, with steps that move on when each is done and can be left at any time. Photo editor only, three tutorials. Replaces the fake screen.

US-19 brought in: a clip can be marked 360 and turned, or cut flat to one angle (preview and export). Open: the exported file has the 360 picture but not the metadata that tells players it is 360. Tested with a synthetic 2:1 clip, not a real 360 camera file.

US-21 partly: the filter chosen in the camera now becomes the captured photo first edit, which it was not before. The live preview is still a colour tint, not the real filter: a true live pipeline needs a native camera change (architecture decision). US-23: the AR layer is not real surface tracking; real anchoring needs ARCore (architecture decision).

### Sprint 3 status after this round (2026-11-03)

Left out because each needs a decision: US-34 and US-35 (server design for collaboration and community), US-23 and the live filter of US-21 (native camera pipeline, ARCore), US-25, RF-004, RF-034 and RF-069 (which AI model, its licence and download), US-18 (needs a phone's sensors; the Poco is deferred).

Checked on the emulator: all photo layer kinds together in one export, Adobe RGB tag on a JPEG, QR block, object removal, watermark storage, palette and crops (40 ms), tutorial start, camera filter on the photo with undo, the PSD share sheet. Browser only: stereo viewer, batch resize, panorama alignment, GIF thumbnail, window border. The 360 clip exported on the emulator without errors, but that scene was too cluttered to judge the picture; it was judged in the browser.

US-24 complete: automatic background cutout (RF-004) with ML Kit, as a layer, with a transparent, colour or image background. Runs on the device; the model comes through Google Play services on first use (6.5 s on the emulator), and the API is still beta. Checked on the emulator with a drawn picture only, so quality on real photos of people is unmeasured. To publish: ML Kit sends usage metrics to Google, which the Data Safety form and the privacy policy must disclose, and phones without Play services get an error message instead.

US-26 complete except converging-line detection: scene recognition (RF-034) with ML Kit labels, in Suggestions. A photo gets one of five kinds (landscape, portrait, food, animals, urban) and a one-step, undoable set of suggested adjustments; a clear answer or none, never a weak guess. On the emulator: 12 s the first time, while Play services fetches the model, then 200 ms with face detection included (RNF-012 asks 500 ms).

US-25 partly done: "Retocar rostos" makes one layer per face with its own skin smoothing, eye brightening, tone, red eye and blemish settings (RF-016, RF-025); detection and correction run on the device (RNF-004). "Efeito retrato" (RF-012) blurs the background around the subject mask: it is a subject mask, not measured depth, so nearer and farther background blur the same. Not covered: faces in video (RF-016 says photos and videos). Checked on the emulator with drawn positions: the layer draws in the right place, the panel, undo and export work, and a photo with no face gets a clear message. On a public-domain portrait with three people, ML Kit found all three in 150 ms with eyes and mouth in place. Red eye stayed off on the untouched picture and switched on by itself, then corrected, on a copy with red painted on the pupils; a real flash photo is still untried.

US-29 complete: captions from speech (RF-069) with whisper.cpp. A video or audio clip's "Legendas" tool asks once before downloading the 75 MB multilingual tiny model (hash checked, kept outside the APK), hears the clip on the device and adds ordinary, editable text clips on a new layer, undone in one step. The APK grows about 3 MB per architecture. Checked on the emulator with a synthetic Portuguese voice: language detected by itself, correct text and times, shown in the preview and burned into the export; cancel takes 0.2 s; a clip with no sound says so; a clip with only noise gives no captions. 16.5 s of speech took 1.6 s there, on a desktop CPU with AVX2. **Not measured on a phone**: arm64 builds for the baseline every phone has, so it will be slower; real voices, noise and accents are also untried. Before release: the model comes straight from Hugging Face, so it may need our own host, and the Play data form must mention this download and ML Kit's usage metrics.

US-19 complete: a 360 clip gets a "360°" export, 1920x960, carrying Google's Spherical Video V1 box. ffprobe reads it as equirectangular and the turned picture wraps at the seam. Checked with a synthetic 2:1 clip on the emulator, not in a real 360 player or with a real 360 camera file; 4K needs a higher H.264 level.

US-26 complete: converging lines (RF-042) find where a picture's slanted lines meet and suggest a crop with that point on a third. Checked on the emulator with a drawn corridor (about 100 ms for the whole analysis); a portrait gives no such crop; real architecture and road photos are untried.

US-31, PSD layers and masks (RF-040): each local adjustment is now its own layer with a real, editable layer mask, and a plain subject cut-out is a mask on the picture under it. Steps with no mask to hold (liquify, art, a face retouch, a filled background) are a layer of their own, so they can be switched off in Photoshop. Up to six such steps stay apart; earlier ones merge. Checked with psd-tools in the browser: masks read back and the layers redraw the stored picture to within 0.05 of 255. **Not opened in Photoshop itself.** The colour adjustments are a layer over the original photo, so they can be switched off, but as pixels: they do not map onto Photoshop's own adjustment layers, whose values could not be edited there. Fixed on the way: a cut-out or a face layer was missing from the PSD's layers.

US-25, faces in video (RF-016): a video clip's "Rostos" tool samples frames (every 0.5 s, at most 240), follows each face between samples and gives it its own smoothing, eyes and tone, drawn on every frame in preview and export. Red eye and blemishes stay photo-only, since flash is a stills problem and spots would flicker from frame to frame. Faces in a 360 clip are not retouched. A face moving fast between samples is followed less tightly.

US-18 written, **not validated**: the camera records the gyroscope and accelerometer with each video, beside its file, and a clip's "Estabilizar" tool turns the correction on or off at any time, in preview and export, without touching the file. The picture is enlarged 10% and moved inside that margin, so the edge never shows but the edges of the picture are cropped. Only videos recorded with the app's camera have this data. The maths is unit-tested. On the emulator, a synthetic shaky clip with matching motion data went from 8.5 and 5.7 px of movement to 1.6 and 1.6 px, about what the measurement itself reads on that clip; a recording from the app's camera saved its motion file and could be switched on, with the emulator's sensors sending only 5 samples a second. **The signs of the axes, the sensor and video sync (`SENSOR_LEAD_MS`) and the focal length (`FOCAL_OVER_LONG_SIDE`) need a real phone**: until then this cannot be called working on a real recording.

Measured on a real low-end phone, a Samsung A11 (SM-A115M, Android 10, 32-bit only, 2.9 GB of memory), while hot and at low battery. It has **no gyroscope**, so stabilization cannot work or be calibrated on it, and such a phone records no motion data; US-18 still needs a phone with one. Captions work: a 24.5 s clip in Portuguese takes about 24 s after the model download (23.5 s), about the clip's length, right text at the right time, app memory peaking at 534 MB, no crash. It first took 3 min 35 s; the 32-bit build now uses vfpv4 and checks that the processor has it. A low-end phone (3 GB or less) now previews at 540 with the lightest copy; it then plays at real speed with no late frames; that first 0.9 was the wait after pressing play. That wait went from 0.65 to 1.3 s down to about 0.4 s (1.2 s the first time after opening), and jumps take 0.15 to 0.35 s. Whether the shorter audio buffer causes crackling has to be heard on the phone. An export of 734 frames at 540x960 took about 80 s.
