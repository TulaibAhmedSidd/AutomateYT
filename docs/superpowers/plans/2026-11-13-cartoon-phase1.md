# Cartoon Phase 1 (office PC, stills engine, own voice) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a full cartoon episode end to end on a PC without a GPU. The flow: pick a series → AI writes the episode → the owner records each line in their own voice → render an MP4 from stills, camera moves and captions. Phase 2 swaps stills for ComfyUI clips without changing anything else.

**Architecture:**
- Everything is file based in `storage/cartoon/` (series, episodes, recordings), like Motion.
- A pure spec module (`lib/cartoon/spec.ts`) is shared by the browser, Remotion and the worker.
- The browser records lines with MediaRecorder. The upload route cleans each take with FFmpeg into an MP3 straight away, so preview and render use the same audio.
- A detached worker (`scripts/render-cartoon.mjs`) prepares voice and visuals per shot (resumable), then renders the Remotion composition `CartoonEpisode`.

**Tech Stack:** Next.js 16.2 route handlers, React 19, Remotion 4.0.543 (`Player`, `bundle`, `renderMedia`, `Img`, `OffthreadVideo`), msedge-tts 2.1.1, ffmpeg-static, Node 24 built-in test runner (`node --test`, native TypeScript type stripping).

## Global Constraints
- No new npm dependency. Tests use `node --test` with Node 24's type stripping.
- `lib/cartoon/spec.ts` has **no runtime imports**; `import type` only. It must run in the browser, Remotion and `node --test`.
- Output is 1080×1920, 30 fps. Narration is ≤ 12 words per shot. 45 s → 9 shots, 60 s → 12, 75 s → 14 (the AI may vary by ±2).
- Voice providers in P1: `recorded` (the owner's voice, default) and `edge` (fallback). Render with missing recordings only when `allowAiVoice` is true.
- `CARTOON_ENGINE=comfy` makes the worker fail with "ComfyUI engine arrives in Phase 2" until P2.
- Islamic preset: the rules forbid depicting prophets, companions or holy figures. Kids presets: nothing scary.
- Ids: series and episode ids match `^[\w-]{3,64}$`; shot ids match `^[a-z0-9]{6}$`. All file serving goes through `resolveCartoonFile()`, which blocks paths outside `storage/cartoon`.
- `npm run check` and `npm test` pass after every task. Video tasks end with the `verify-render` skill.
- Commits: conventional, author tulaibahmedsidd. The pre-commit hook must pass (never `--no-verify`).

## File map
| File | Responsibility |
|---|---|
| `scripts/lib/voice.mjs` | `speakEdge(text, voice, outDir)` → `{ file, seconds, words }` (moved from render-motion) |
| `scripts/lib/remotion-render.mjs` | `findBrowser()`, `renderComposition({ entry, publicDir, id, inputProps, out, onProgress })` (bundle in OS temp, render with crash retry) |
| `scripts/render-motion.mjs` | Uses the two libs above (same behaviour) |
| `remotion/shared/fonts.ts` | Loads Inter, Space Grotesk, Noto Nastaliq Urdu once |
| `remotion/shared/Captions.tsx` | Karaoke captions from `Word[]` |
| `remotion/MotionShort.tsx` | Uses the shared fonts and Captions |
| `lib/cartoon/spec.ts` | Types, presets, sanitizers, prompt builder, timing, word spreading |
| `tests/cartoon-spec.test.ts` | Unit tests for spec helpers |
| `lib/cartoon/store.ts` | Disk layout, series and episode CRUD, preset seeding, uploads, render start, status, file resolver |
| `lib/cartoon/audio.ts` | `cleanRecording(input, output)`: FFmpeg high-pass + denoise + loudness + silence trim → CBR MP3; returns seconds |
| `lib/media-response.ts` | `fileResponse(req, file, downloadName?)`: Range streaming (shared by Motion and Cartoon file routes) |
| `app/api/cartoon/series/route.ts`, `series/[id]/route.ts`, `series/[id]/reference/route.ts` | Series list, save, get, delete, reference image upload |
| `app/api/cartoon/script/route.ts` | AI episode writer |
| `app/api/cartoon/episodes/route.ts`, `episodes/[id]/route.ts` | Episode list, create, get, save, delete |
| `app/api/cartoon/episodes/[id]/record/route.ts` | Upload or delete one shot's recording |
| `app/api/cartoon/episodes/[id]/keyframe/route.ts` | Upload or delete one shot's picture |
| `app/api/cartoon/episodes/[id]/render/route.ts` | Start a render |
| `app/api/cartoon/files/[...path]/route.ts` | Serve refs, keyframes, recordings, video |
| `remotion/CartoonEpisode.tsx` | The episode composition |
| `remotion/Root.tsx` | Registers `CartoonEpisode` |
| `scripts/render-cartoon.mjs` | The worker |
| `app/cartoon/page.tsx` + `components/cartoon/*` | Cartoon Studio UI |

---

### Task 1: Share voice, render and captions code (no behaviour change)

**Files:**
- Create: `scripts/lib/voice.mjs`, `scripts/lib/remotion-render.mjs`, `remotion/shared/fonts.ts`, `remotion/shared/Captions.tsx`
- Modify: `scripts/render-motion.mjs`, `remotion/MotionShort.tsx`

**Interfaces:**
- Produces:
  - `speakEdge(text: string, voice: string, outDir: string): Promise<{ file: string; seconds: number; words: Word[] }>` (5 tries with backoff, 96 kbps CBR MP3)
  - `findBrowser(): string | undefined`
  - `renderComposition({ entry, publicDir, id, inputProps, out, onProgress, onStage }): Promise<{ frames: number; fps: number }>`
  - `<Captions words={Word[]} urdu={boolean} accent={string} />`
  - `fonts` = `{ space, inter, nastaliq }` (each with `.fontFamily`)

- [ ] Move `speak()` and `findBrowser()` out of `render-motion.mjs` unchanged, renaming `speak` to `speakEdge`.
- [ ] Move bundle + `selectComposition` + `renderMedia` with the `[min(4, cpus/3), 1]` retry into `renderComposition`. The bundle `outDir` = `mkdtemp(os.tmpdir()/remotion-bundle-)`, deleted after.
- [ ] Move the font loads into `remotion/shared/fonts.ts`. Move the Captions JSX into `remotion/shared/Captions.tsx`, with words passed in. MotionShort calls `<Captions words={sceneWords(scene)} urdu={ctx.urdu} accent={ctx.theme.accent2} />`.
- [ ] Verify: `npm run check`. Render the preset "Why most Shorts fail" from `/motion`. Run `verify-render`; the result must match the earlier render (captions, length).
- [ ] Commit: `refactor(motion): share voice, render and caption code for the cartoon worker`

### Task 2: Cartoon spec, presets and unit tests

**Files:**
- Create: `lib/cartoon/spec.ts`, `tests/cartoon-spec.test.ts`
- Modify: `package.json` (`"test": "node --test tests/"`, and `check` also runs `npm test`), `tsconfig.json` (`"allowImportingTsExtensions": true`)

**Interfaces (produces):**
```ts
export type CartoonLang = 'en' | 'ur';
export type Camera = 'static' | 'push-in' | 'pull-out' | 'pan-left' | 'pan-right' | 'orbit' | 'low-angle';
export type VoiceProvider = 'recorded' | 'edge';
export type Word = { text: string; start: number; end: number };
export type Character = { id: string; name: string; look: string; reference?: string };   // reference = file name in series/<id>/refs/
export type CartoonSeries = {
  id: string; name: string; language: CartoonLang; audience: 'kids' | 'general'; madeForKids: boolean;
  style: string; negative: string; characters: Character[];
  voice: { provider: VoiceProvider; edgeVoice: string };
  rules: string[]; episodeSeconds: 45 | 60 | 75; palette: { bg: string; accent: string };
};
export type Recording = { file: string; seconds: number; at: string };                  // file in episodes/<id>/recordings/
export type CartoonShot = {
  id: string; narration: string; characters: string[]; scene: string; action: string; camera: Camera; mood?: string;
  recording?: Recording; keyframe?: string;                                              // keyframe file in episodes/<id>/keyframes/
  // set for rendering / preview:
  image?: string; clip?: string; audio?: string; words?: Word[]; duration?: number;
};
export type CartoonEpisode = { id: string; seriesId: string; title: string; description?: string; tags?: string[]; shots: CartoonShot[]; endHook: string; createdAt: string };
export type EpisodeRenderProps = { episode: CartoonEpisode; series: Pick<CartoonSeries, 'name' | 'language' | 'palette'>; assetBase?: string };
export const FPS = 30, WIDTH = 1080, HEIGHT = 1920;
export const CAMERAS: { id: Camera; label: string }[];
export const SERIES_PRESETS: CartoonSeries[];       // 4: little-lessons (en kids), ahmed-aur-billu (ur kids), gappu-the-goat (en general), stories-of-light (en, Islamic rules)
export function newShotId(): string;                // 6 chars [a-z0-9]
export function shotCountFor(seconds: number): number;   // round(seconds / 5)
export function shotSeconds(shot: CartoonShot): number;  // duration ?? (recording ? recording.seconds + 0.3 : max(2.4, words / 2.6 + 0.35))
export function shotFrames(shot: CartoonShot): number;
export function episodeFrames(ep: CartoonEpisode): number;  // ≥ FPS
export function spreadWords(text: string, seconds: number, offset?: number): Word[];  // weighted by letters, ends at seconds - 0.05
export function shotWords(shot: CartoonShot): Word[];      // shot.words ?? spreadWords(narration, shotSeconds - 0.3, 0.05)
export function buildShotPrompt(series: CartoonSeries, shot: CartoonShot): string;   // style + looks of shot.characters + scene + action + camera + mood
export function sanitizeSeries(input: unknown): CartoonSeries;
export function sanitizeEpisode(input: unknown, seriesId: string): CartoonEpisode;    // clamps: ≤ 20 shots, narration ≤ 240 chars, keeps valid shot ids or makes new ones, drops unknown cameras → 'static'
```

- [ ] Write the tests first (`tests/cartoon-spec.test.ts`), importing `../lib/cartoon/spec.ts`. They cover:
  - `shotCountFor(60) === 12`;
  - `spreadWords('a bb ccc', 3)` → 3 words, increasing, first start ≥ 0, last end ≤ 3;
  - `shotSeconds` uses the recording length + 0.3;
  - `sanitizeEpisode` drops an unknown camera to `'static'`, cuts at 20 shots, and keeps a valid id;
  - `buildShotPrompt` contains the character's look text and not other characters' text;
  - every preset passes `sanitizeSeries` unchanged.
- [ ] `npm test` → FAIL (module missing). Write `spec.ts`. `npm test` → PASS. `npm run check` → PASS.
- [ ] Commit: `feat(cartoon): series and episode spec with presets and tests`

### Task 3: Storage, recording clean-up and API routes

**Files:** create `lib/cartoon/store.ts`, `lib/cartoon/audio.ts`, `lib/media-response.ts`, all the `app/api/cartoon/**` routes in the file map. Modify the Motion files route to use `fileResponse`.

**Disk layout:**
```
storage/cartoon/series/<seriesId>/series.json, refs/<characterId>.<png|jpg|webp>
storage/cartoon/episodes/<episodeId>/episode.json, status.json, log.txt,
  recordings/<shotId>.webm + <shotId>.mp3, keyframes/<shotId>.<ext>, assets/ (render inputs), episode.final.json, video.mp4
```

**Interfaces (produces, server only):**
- `listSeries()`: seeds `SERIES_PRESETS` on first call.
- `getSeries(id)`, `saveSeries(s)`, `deleteSeries(id)`, `saveReference(seriesId, characterId, bytes, ext)`.
- `listEpisodes()` → `{ id, title, seriesId, createdAt, shots, recorded, status }[]`.
- `getEpisode(id)`, `createEpisode(seriesId, draft)`, `saveEpisode(ep)` (keeps existing `recording` and `keyframe` by shot id), `deleteEpisode(id)`.
- `saveRecording(epId, shotId, bytes)` → `Recording`: writes the webm, then `cleanRecording` to mp3, then sets `shot.recording`. `deleteRecording(epId, shotId)`.
- `saveKeyframe(epId, shotId, bytes, ext)`, `deleteKeyframe`.
- `startRender(epId, { allowAiVoice })` → pid (spawns `scripts/render-cartoon.mjs`, detached, hidden).
- `readEpisodeStatus(id)` (a dead pid counts as failed).
- `resolveCartoonFile(parts)` → `{ full, type, size } | null`.

**`cleanRecording` FFmpeg filter:** `highpass=f=80,afftdn=nf=-25,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,loudnorm=I=-16:TP=-1.5:LRA=11`, mono 44.1 kHz, `libmp3lame -b:a 128k` (CBR), so seconds = (bytes − 0) × 8 / 128000. That runs in under 1 s for a 5 s take, so it is allowed inside the request.

- [ ] Verify with curl:
  - list series (4 presets);
  - create an episode with 2 shots;
  - upload a recording (an edge MP3 converted to webm stands in for the mic) → JSON with seconds > 0;
  - GET the MP3 through `/api/cartoon/files/episodes/<id>/recordings/<shot>.mp3` → 200 audio/mpeg;
  - path traversal (`..%2F`) → 404.
- [ ] `npm run check`. Commit: `feat(cartoon): file storage, voice recording upload and API routes`

### Task 4: AI episode writer (`POST /api/cartoon/script`)
**Body:** `{ seriesId, topic, model }`. **Returns:** `{ episode: CartoonEpisode-shaped draft }` (not saved).

- Same key lookup and models as the Motion writer.
- The system prompt includes:
  - the series name, audience and style;
  - the characters (id, name, look);
  - the rules verbatim;
  - the target shot count;
  - the JSON shape.
- Hard rules: narration ≤ 12 words; one visible action; ids only from the list; no text in the images; shot 1 is a hook; the last shot sets up the next episode; Urdu narration in Urdu script (scene, action and camera in English).
- Validated with `sanitizeEpisode`. Retry once with the problem list if the shot count is off by more than 2, a narration exceeds 14 words, an id is unknown, or Urdu narration is not mostly Urdu script.
- [ ] Verify one real call with gpt-4o-mini (under 1 cent) for an English and an Urdu preset. Check the rules by eye.
- [ ] Commit: `feat(cartoon): AI episode writer that follows the series bible`

### Task 5: `CartoonEpisode` composition
- Props: `EpisodeRenderProps`. Each shot is a `Sequence` of `shotFrames(shot)`, with:
  - **Visual:** `OffthreadVideo` if `shot.clip`, else `Img` (`objectFit: cover`) with a camera move over the shot, else a placeholder card. The placeholder shows the series palette gradient, the scene and action text, and character name chips, so a stills test still shows what each shot is about.
  - **Camera moves:**
    - `static`: 1.0→1.04 zoom;
    - `push-in`: 1.0→1.18;
    - `pull-out`: 1.18→1.0;
    - `pan-left` / `pan-right`: translateX ±5% at scale 1.15;
    - `orbit`: rotate −1.5°→1.5° with 1.1 zoom;
    - `low-angle`: translateY 4%→0 at 1.12.
    Crossfade 8 frames between shots.
  - **Audio:** `Html5Audio` from `shot.audio` (assetBase or `staticFile`).
  - **Captions:** shared `Captions` with `shotWords(shot)`.
  - **Overlays:** a title card for the first 1.4 s (series name small, episode title big). An end-hook card over the last shot (`episode.endHook`). A thin progress bar.
- Register in `remotion/Root.tsx` with `calculateMetadata` → `episodeFrames`.
- [ ] Verified through Task 6's render.

### Task 6: Worker `scripts/render-cartoon.mjs <episodeId>`
Stages go into `status.json`: `voice → visuals → bundle → render → done|failed`, with `shots: { [id]: { voice: 'recorded'|'edge'|'missing', image: 'keyframe'|'reference'|'card' } }`.
1. Read `episode.json` + `series/<seriesId>/series.json`, and write a series snapshot.
2. If `CARTOON_ENGINE === 'comfy'`, fail with "ComfyUI engine arrives in Phase 2".
3. **Voice per shot:**
   - recording present → copy `recordings/<id>.mp3` to `assets/<id>.mp3`, words = spread, duration = seconds + 0.3;
   - else if `series.voice.provider === 'edge'` or `allowAiVoice` → `speakEdge` (cache `assets/<id>.voice.json`; reuse if the narration is unchanged);
   - else fail with "Record shot N first (or tick 'use AI voice for missing lines')".
4. **Visual per shot:** episode keyframe → `assets/kf-<id>.<ext>`; else the first listed character's reference → `assets/ref-<charId>.<ext>`; else no image (card).
5. Write `episode.final.json`, then `renderComposition({ id: 'CartoonEpisode', publicDir: assets })` → `video.mp4`.
- [ ] Verify:
  - a 3-shot episode: one shot recorded (the stand-in webm), one shot edge (allowAiVoice), one shot with an uploaded keyframe;
  - a 10-shot episode all edge;
  - run `verify-render` on both: duration = sum of shots ±0.2 s, captions match each shot's audio, camera moves visible, Urdu preset shows Urdu script.
- [ ] Commit: `feat(cartoon): episode render worker and composition (stills engine)`

### Task 7: Cartoon Studio (`/cartoon`)
- **`components/cartoon/SeriesPanel.tsx`:** series select (presets + saved), plus an edit form:
  - name, language, audience, made-for-kids, style, negative;
  - characters (name, look, reference upload with thumbnail);
  - voice provider (recorded / edge + voice select);
  - rules (one per line), length.
  Save → `POST /api/cartoon/series`.
- **`components/cartoon/ShotCard.tsx`:** narration (`dir="auto"`), characters (toggle chips), scene, action, camera select, and the **voice row**:
  - Record / Stop (MediaRecorder `audio/webm;codecs=opus`, 30 s cap, a red timer while recording);
  - an ✓ badge with seconds, Play, Re-record, Delete;
  - picture upload / remove with thumbnail;
  - move up / down, delete.
- **`components/cartoon/RecorderHint.tsx`:** one-time tips:
  - quiet room, phone mic close, read naturally;
  - asks for the mic once and shows a plain error if blocked.
- **`components/cartoon/EpisodePlayer.tsx`:** `@remotion/player` with `CartoonEpisode`; `ssr: false`. Preview audio uses `recordings/<id>.mp3` with `assetBase=/api/cartoon/files/episodes/<id>`.
- **`app/cartoon/page.tsx`:**
  - series panel;
  - topic + model + *Write episode* (creates and saves the episode);
  - the episodes list (open / delete);
  - the shot list with a "Recorded 7/12" counter;
  - a sticky preview;
  - *Render MP4* with a "use AI voice for missing lines" checkbox;
  - render status polling (2 s while running), the video and a download link.
- Sidebar: "Cartoon Studio" (icon `Clapperboard`) under Produce. `lib/video-formats.ts`: animated-cartoon gets `studioHref: '/cartoon'`, and its setup items are updated (P1 done items ticked; status stays `needs-gpu` until P2).
- [ ] Verify in the browser at 390 px and 1280 px:
  - write an episode;
  - edit a shot;
  - upload a picture;
  - check that the Record button asks for the mic (in automation, check the error message when there is no mic);
  - preview plays;
  - render finishes and plays.
- [ ] Commit: `feat(cartoon): Cartoon Studio page with own-voice recording`

### Task 8: Docs and progress
- Update `docs/ai/video-pipelines.md` §3 (what P1 does, the files, the recording filter), `docs/ai/architecture.md` (routes, storage), and `AGENTS.md` §1 (Cartoon Studio P1 live with stills).
- Run `daily-progress` (`progress/2026-11-13/`).
- `npm run check` + `npm test`.
- Commit: `docs(cartoon): phase 1 guides and progress`
