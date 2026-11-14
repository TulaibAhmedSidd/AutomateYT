# Video pipelines

Every format follows the same 6 steps: **idea → script → voice → visuals → MP4 → upload**. This guide explains each format and the rules its code must keep.

## 1. Motion Graphics (live) — `/motion`
Files:
- `lib/motion/spec.ts`: types, themes, voices, presets, `sanitizeSpec`, timing helpers.
- `remotion/MotionShort.tsx`: the composition.
- `components/motion/PlayerPanel.tsx`: the live preview.
- `app/motion/page.tsx`: the studio page.
- `lib/motion/jobs.ts` + `scripts/render-motion.mjs`: rendering.
- `lib/motion/series.ts` + `app/api/motion/series` + `components/motion/MotionSeriesPanel.tsx`: ready-written series from `content/motion/series/<id>.json`.

**Spec.** `MotionSpec` = `{ title, description?, tags?, language: 'en'|'ur', theme, voice, captions, scenes[] }`.
- Each scene = `{ kind, voice, heading?, sub?, value?, items?, points? }`.
- `kind` is one of `hook | stat | list | compare | quote | statement | timeline | cta`.
- **`timeline` ("Then → Now")**: `points` = 2–6 `{ label, value }`, oldest first, one unit for all values ("3.37 کروڑ", "Rs 57"). The year flips, the number counts up from the last value, a bar grows per step. Steps share the scene evenly (at least 1.3 s each), so the voice must say the first step first and then each step in order.
- `voice` is an Edge voice id, or `eleven:<voiceId>` with optional `elevenModel` (ElevenLabs, costs credits). ElevenLabs lines are cached in `storage/motion/voice-cache/` by voice + model + text, so re-renders are free.
- `series` + `episode` mark a spec that came from a motion series; the series panel uses them to show which episodes are made.
- Wrap words in `*stars*` to colour them with the accent.
- The renderer adds `audio`, `words` (word timings) and `duration`.

**Timing.**
- Before render: a scene lasts `max(2.4 s, words / 2.6 + 0.35 s)`.
- After the voice is made: `max(2.2 s, audio length, last word end) + 0.35 s`.
- `FPS = 30` and the frame is 1080×1920.

**Render steps** (`scripts/render-motion.mjs <jobId>`):
1. **Voice.** For each scene, msedge-tts (`AUDIO_24KHZ_96KBITRATE_MONO_MP3`, rate +4%, `wordBoundaryEnabled`) writes `assets/scene-N.mp3`.
   - Word timings come in 100 ns ticks, so divide by 1e7.
   - Audio length = bytes × 8 / 96 000, because the bitrate is constant.
   - Retries 5 times with backoff.
2. **Bundle.** `bundle({ entryPoint: remotion/index.ts, publicDir: assets/, outDir: <os temp>/motion-bundle-* })`.
   - The bundle **must not** go inside the job folder, or it copies itself forever.
3. **Render.** `selectComposition` + `renderMedia` (h264, crf 20).
   - Concurrency is `min(4, cpus/3)`, with one retry at concurrency 1 after "Page crashed!".
   - The browser is `findBrowser()`: `REMOTION_BROWSER`, else Playwright's `chrome-headless-shell` under `%LOCALAPPDATA%\ms-playwright`, else Remotion downloads its own.

**Look rules.**
- The background is animated radial gradients. **No CSS `filter: blur`**, which made renders very slow.
- Urdu uses Noto Nastaliq Urdu, RTL, with bigger line height.
- Captions show 4 words at a time, with the current word highlighted.

**AI scene writer** (`/api/motion/script`): OpenAI (`gpt-4o-mini`, `gpt-4o`) or Gemini (`gemini-2.5-flash`). Its hard rules, keep them when you edit the prompt:
- The word count fits the chosen length (25/35/50 s at about 2.6 words/s).
- **Only real, well-known numbers.** Never invent statistics.
- **No quotes and no attributions.** Any `quote` scene from the AI is turned into a `statement`.
- The voice says what the screen shows. No template words like "Wrong way vs Right way".
- Hook first, CTA last, 5–8 scenes.
- Urdu: the voice and headings must be in **Urdu script**. `mostlyUrduScript()` triggers one retry, then an error.
- GPT-4o-mini still gets facts wrong now and then. Prefer GPT-4o or Gemini 2.5 Flash for facts channels.

## 2. Image + Voiceover (live, weak) — `/studio`
`lib/generator.ts` runs these steps:
1. `generateTopicAndScript` (`lib/ai.ts`) writes the title, description, tags and scenes.
2. ElevenLabs voice (`generateVoiceover`).
3. Leonardo image per scene (`generateImage`, models in `lib/generation-config.ts`).
4. `worker.js` (FFmpeg) makes the video: Ken Burns zoom, fades, Whisper `whisper-1` word captions as `.ass`, and a "Follow for more" overlay.
5. Thumbnail = the frame at 1 s.

It costs ElevenLabs + Leonardo + OpenAI credits. Retention is poor because there are too few, too slow pictures. Don't invest more here unless asked.

## 3. Animated 3D Cartoon (Phase 1 live) — `/cartoon`

**Screens:** `/cartoon` = series cards with progress bars → `/cartoon/<seriesId>` = every episode (done / to record / no script yet, with a Write script button and cost) → `/cartoon/studio?series=&episode=` = record each line in your own voice, preview, render.

**Content library** (`content/cartoon/`, committed): `series/<id>.json` = { series bible, group, why, model, topics (15 planned episodes), moreIdeas }; `episodes/<id>/<NN>.json` = a written script. `lib/cartoon/store.ts` imports both into `storage/cartoon` the first time it sees them (never overwrites). Library episode ids are `<seriesId>-eNN`. `node scripts/write-library.mjs [seriesId]` writes all missing scripts (costs credit; the app must be running).

**Script model:** gpt-6.1-sol by default (best Urdu and stories in a 4-model test on 2026-11-13; ~700 in + ~1,580 out tokens, about 1.7 cents per episode). Prices and estimates: `lib/cartoon/models.ts`. Reasoning models (gpt-5+, gpt-6+) get `reasoning_effort` instead of temperature (`lib/llm-json.ts`).

**Voices:** each series picks who speaks: `elevenlabs` (default for the library series, natural Urdu/English with [laughs]-style tags), `recorded` (the owner records each line) or `edge` (free Microsoft voice). A shot with a recording always uses it. When the series voice is ElevenLabs the writer adds about one audio tag every third line, and for Urdu series it writes natural spoken Urdu with everyday English words.

**Recording:** the browser records each line (MediaRecorder); `lib/cartoon/audio.ts` cleans it with FFmpeg: highpass 80 Hz, afftdn, loudnorm -16 LUFS, then silence trim at both ends (loudnorm must come before areverse or FFmpeg stalls on short clips).

Design: `docs/superpowers/specs/2026-11-12-cartoon-design.md`. Summary:
- **Series bible** (one per series): look and style prompt, characters (look text + one reference image), narrator voice, story rules, language.
- **Episode** = 8–12 shots of about 5 s each. Each shot = narration (≤ 12 words) + scene + action + camera + characters.
- **Engines:**
  - `stills` (office PC): shows each shot's keyframe with slow camera motion. Used to test the whole pipeline without a GPU.
  - `comfy` (home PC): ComfyUI makes a keyframe (Flux Kontext from the reference image), then a 5 s clip (Wan 2.2 TI2V 5B).
- **Assembly:** a Remotion composition plays the clips in order, timed to the Edge voice, with captions. Same job pattern as Motion: `storage/cartoon/<id>/`, resumable per shot.
- **Series rules** are in `AGENTS.md` §7 (kids safety; no depiction of holy figures).

## 4. AI Cinematic (not built)
Paid text- or image-to-video APIs (Kling, Veo, Seedance, through fal.ai or MuAPI). Use only for hooks or hero shots, and only with a budget the owner set.

## Checking a render
Use the `verify-render` skill:
1. Extract frames at fixed times with FFmpeg into a contact sheet.
2. Check the voice and caption sync, text that is cut off, and the language script.
3. Check the length and size with ffprobe.

## 5. Cartoon video modes and ComfyUI (Phase 2, built 2026-11-14)
- **Step 2 · Video type** in the studio has three tabs. The mode is sent with "Make the video" (`render-options.json` → `mode`):
  - `pictures`: a picture per line with camera moves. Works on any PC.
  - `key-shots`: pictures, plus the ticked lines (default: start, middle, end) become 2-second Wan clips.
  - `animated`: every line becomes a 2-second clip.
- **Worker** (`scripts/render-cartoon.mjs`):
  - When `comfy/workflows/keyframe.api.json` exists and ComfyUI is reachable, every line without a picture gets an AI picture. It is saved in `keyframes/` and recorded in episode.json.
  - Animated lines need a start picture: the line's own picture, else the first character's reference picture. Lines without one are skipped and stay still.
  - Clips are cached in `clips/<shotId>.mp4`. The composition plays a clip at 0.85× speed, then freezes its last frame with a slow push-in until the line ends.
- **ComfyUI client** (`scripts/lib/comfy.mjs`):
  - `ensureComfy()` starts ComfyUI from `COMFY_START` when it is not running and waits up to 4 minutes.
  - `runWorkflow(name, tokens, outFile)` fills `{{TOKENS}}` (a whole-value token becomes a number), posts `/prompt`, polls `/history`, and downloads via `/view`.
  - Settings: 480×832, 49 frames (2 s at 24 fps). Measured on the RTX 2070 Super: ~21 min per 2-second clip.
- **Live progress:** the worker writes `steps` (done/total for voice, character pictures, AI pictures, moving clips, MP4), `current` (the job running now) and `etaMin` into status.json. Minutes left start from the measured home-PC numbers and switch to this run's real timings. `components/cartoon/RenderProgress.tsx` shows it as a sticky panel at the top of the studio, with each picture appearing as soon as it is made.
- **Tools:**
  - `npm run comfy:check` reports the GPU, the workflows and any missing model files.
  - `node scripts/dev/fake-comfy.mjs 8199` is a fake ComfyUI for testing without a GPU (run the worker with `COMFY_URL=http://127.0.0.1:8199`). Set `FAKE_COMFY_SECONDS=8` to make each fake job slow enough to watch the progress panel.
- **Wan2GP is not used.** It has no stable API. Everything runs through ComfyUI.

## 6. Transition reels (series `format: "transition"`)
- 6–10 labelled pictures, 1.8 s each, with a white flash cut and a punch-in label. No voice: the owner adds a trending sound in the Instagram/YouTube app.
- The writer uses a separate prompt: the same subject and angle in every stage, labels of at most 5 words. The studio replaces Step 1 with a note.
- 5 series in `content/cartoon/series/` (group `transition`): then-and-now-pakistan, evolution-of, glow-up-nature, one-place-four-seasons, cities-of-the-future (10 reels each).
- They need the **keyframe (picture) workflow** on the GPU PC to look good. Without it they show placeholder cards.
- **Look and sound (2026-11-14, after the owner called the first Lahore reel unusable):**
  - each stage wipes in from the left with a bright line, then a soft flash; every picture slowly pushes in;
  - stages labelled with a year before 1990 get an old-film look (sepia, moving grain, vignette) — `isVintageLabel()`;
  - sound: `scripts/lib/sfx.mjs` makes a whoosh (every cut) and a deep impact (last stage) with FFmpeg into `storage/sfx/` (no downloads, no copyright). The owner still adds trending music in the Instagram/YouTube app;
  - prompts ask for a real photograph of the time (archival photo for old years), and the negative prompt bans painting, illustration, CGI, smudged faces and warped buildings;
  - for real archive photos, upload a picture on each line (Picture & scene): uploaded pictures are never replaced by AI.

## 7. Horror
`raat-ki-kahaniyan` (Urdu, 20 episodes): Bashir Chacha the night watchman tells fictional Pakistani urban legends. Spooky, not gory, no religious mockery, twist endings. Voice: ElevenLabs Brian with [whispers]/[gasps].

## 8. Picture workflows (updated 2026-11-14)
Two picture workflows on the GPU PC, both optional:
- **`comfy/workflows/picture.api.json`** (text → picture). Tokens: `{{PROMPT}} {{NEGATIVE}} {{SEED}} {{WIDTH}} {{HEIGHT}} {{PREFIX}}`. Used for:
  - character reference pictures, made automatically once per character and saved in the series;
  - the first stage of a transition reel;
  - lines with no character.
- **`comfy/workflows/keyframe.api.json`** (picture + text → edited picture, e.g. FLUX.1 Kontext). Same tokens plus `{{IMAGE}}`. Used for:
  - story lines, edited from the character's reference picture so the face stays the same;
  - transition stages 2+, each edited from the **first** stage's picture so the view stays the same. Never chain edits (each from the one before): quality drops with every pass and stage 7 comes out washed out (measured 2026-11-14).
- English horror: `midnight-watch` (20 episodes), the same tales as `raat-ki-kahaniyan` told in English with the ElevenLabs Brian voice.
