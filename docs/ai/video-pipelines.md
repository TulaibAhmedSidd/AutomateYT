# Video pipelines

Every format follows the same 6 steps: **idea → script → voice → visuals → MP4 → upload**. This guide explains each format and the rules its code must keep.

## 1. Motion Graphics (live) — `/motion`
Files:
- `lib/motion/spec.ts`: types, themes, voices, presets, `sanitizeSpec`, timing helpers.
- `remotion/MotionShort.tsx`: the composition.
- `components/motion/PlayerPanel.tsx`: the live preview.
- `app/motion/page.tsx`: the studio page.
- `lib/motion/jobs.ts` + `scripts/render-motion.mjs`: rendering.

**Spec.** `MotionSpec` = `{ title, description?, tags?, language: 'en'|'ur', theme, voice, captions, scenes[] }`.
- Each scene = `{ kind, voice, heading?, sub?, value?, items? }`.
- `kind` is one of `hook | stat | list | compare | quote | statement | cta`.
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
