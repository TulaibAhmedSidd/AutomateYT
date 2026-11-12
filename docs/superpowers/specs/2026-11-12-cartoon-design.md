# Animated 3D Cartoon Shorts — design

- **Date:** 2026-11-12
- **Status:** draft, waiting for the owner's review.
- **Approach:** chosen by the owner on 2026-11-12 ("A"): everything runs on the home GPU PC; the office PC can write episodes and preview them with stills.

## 1. Goal
Make 45–75 second vertical cartoon episodes with recurring characters. They must look like a real animated series, not a slideshow.
- A series is set up once. After that, one click goes topic → episode script → keyframes → animated clips → voice → captions → MP4.
- It runs free on the owner's home PC (NVIDIA, 6–8 GB VRAM) and can render overnight in batches.

**Success =**
- one 60 s episode renders unattended at home;
- the same character is recognisable in every shot;
- the narration and captions are in sync;
- the owner would post it.

## 2. Constraints
- **Office PC:** Intel graphics only. It cannot run video models.
- **Home PC:** 6–8 GB VRAM. Only small or compressed models fit:
  - Wan 2.2 TI2V 5B (or its GGUF Q4) for clips;
  - FLUX.1 Kontext dev GGUF Q4 for keyframes.
  - Expect about 5–15 min per 5 s clip, so about 1–3 h per episode. Measure this in P2 (§10).
- **Free first.** No paid video API, and no new npm dependency without asking. ComfyUI is free software the owner installs.
- **Same patterns as Motion Graphics:** a JSON spec, a detached worker, `storage/<format>/<id>/`, status polling, and Remotion for assembly.

## 3. Content model
**Series bible** (`lib/cartoon/spec.ts` → `CartoonSeries`), stored in `storage/cartoon/series/<seriesId>/series.json` with `reference/<characterId>.png`:

```ts
type CartoonSeries = {
  id: string; name: string;
  language: 'en' | 'ur';
  audience: 'kids' | 'general';
  madeForKids: boolean;            // set on purpose; changes YouTube comments and ads
  style: string;                   // look prompt shared by every shot, e.g. "3D animated film, soft light, warm colours"
  negative: string;                // things to avoid in every shot
  characters: { id: string; name: string; look: string; reference?: string }[];  // look = fixed description
  voice: VoiceChoice;              // narrator (see §6)
  rules: string[];                 // story rules, e.g. Islamic: "never show prophets or companions"
  episodeSeconds: 45 | 60 | 75;
};
```

**Episode** (`CartoonEpisode`), stored in `storage/cartoon/<episodeId>/episode.json`:

```ts
type CartoonShot = {
  narration: string;               // ≤ 12 words (≈ 5 s)
  characters: string[];            // character ids in the shot
  scene: string;                   // where: "a small village bakery at sunrise"
  action: string;                  // ONE visible action: "Bilal lifts a tray of hot bread"
  camera: 'static' | 'push-in' | 'pull-out' | 'pan-left' | 'pan-right' | 'orbit' | 'low-angle';
  mood?: string;
  // filled by the worker:
  keyframe?: string; clip?: string; audio?: string; words?: Word[]; duration?: number;
};
type CartoonEpisode = { seriesId: string; title: string; description?: string; tags?: string[]; shots: CartoonShot[]; endHook: string };
```

Shot prompts never repeat the character description by hand. The code builds each prompt as `style + character looks (by id) + scene + action + camera + mood`, so the look can't drift through AI rewording.

**Starter series**, shipped as presets so the owner can pick any:
1. Kids moral stories (English).
2. Urdu kids stories (Pakistani setting).
3. Funny animal series.
4. Islamic stories, narrated over places, objects and light, **with no depiction of prophets or companions**.

## 4. Pipeline (worker `scripts/render-cartoon.mjs <episodeId>`)
Stages are written to `status.json` with per-shot progress (`shots: [{ keyframe, clip, voice }]`). Every stage **skips shots whose output file already exists**, so a crash or reboot resumes where it stopped. Single shots can be redone from the UI.

1. **Voice:** narration per shot through the voice layer (§6) → `assets/shot-N.mp3` + word timings.
2. **Keyframes:** one still per shot, `keyframes/shot-N.png`.
   - `stills` engine: the character reference image (or a generated title card) stands in.
   - `comfy` engine: FLUX.1 Kontext places the reference character into the shot's scene and action. The character must already have a reference image, made once per series in ComfyUI or uploaded.
3. **Clips:** a 5 s clip per shot from its keyframe, `clips/shot-N.mp4`.
   - `stills` engine: skipped; Remotion moves the still with the shot's camera move instead.
   - `comfy` engine: Wan 2.2 TI2V 5B image-to-video, about 480×832–704×1280 at 24 fps, 121 frames.
4. **Assemble:** Remotion composition `CartoonEpisode` (1080×1920, 30 fps) plays each shot for `duration = max(clip length, voice length + 0.3 s)`.
   - If the voice is longer than the clip, slow the clip down (down to 0.75× speed) and then hold the last frame.
   - Adds karaoke captions (shared with Motion), a title card in the first second, an end-hook card, and optional music from `public/music/` at low volume under the voice.
5. **Done:** `video.mp4`, plus `episode.final.json` with real timings.

The ComfyUI adapter (`scripts/lib/comfy.mjs`):
- uploads the image (`/upload/image`);
- loads `comfy/workflows/<name>.api.json` and fills `{{TOKENS}}`;
- calls `POST /prompt`, then polls `/history/<id>` every 3 s (timeout 30 min per clip);
- downloads the output via `/view`.

It retries once on a connection error and reports ComfyUI's own error text in `log.txt`. It runs one shot at a time; the GPU is the bottleneck.

## 5. Episode writer (`POST /api/cartoon/script`)
Same key handling and model choices as the Motion writer (GPT-4o-mini / GPT-4o / Gemini 2.5 Flash). It receives the series bible and a topic, and returns strict JSON (`CartoonEpisode`).

Hard rules in the prompt, checked in code with one retry:
- 8–14 shots summing to the series length;
- narration ≤ 12 words per shot;
- one visible action per shot;
- only character ids from the bible;
- no on-screen text in the images;
- shot 1 is a hook;
- the last shot sets up the next episode;
- Urdu narration in Urdu script;
- the series `rules[]`, verbatim.

## 6. Voice layer (shared by Motion and Cartoon)
The owner wants a voice that does **not** sound like AI, ideally their own. The voice step becomes a provider choice, kept in `scripts/lib/voice.mjs` and used by both workers:

| Provider | What it is | Realism | Cost | Urdu |
|---|---|---|---|---|
| `edge` | Free Microsoft neural voices (today's default) | Clearly AI | Free | Yes |
| `recorded` | **The owner records each shot's line** in the browser (or uploads one take per shot) | Real — it *is* the owner | Free | Yes |
| `elevenlabs-clone` | ElevenLabs voice clone made from 1–3 min of the owner's clean recording | Very close to real | Paid plan with cloning | Yes (multilingual model) |
| `local-clone` | Open-source clone on the home GPU (e.g. Chatterbox, F5-TTS) | Good in English | Free | Weak/untested |

`VoiceChoice = { provider, voiceId? }`. Word timings:
- `edge`: from its word boundaries.
- `elevenlabs-clone`: from its timestamps endpoint.
- `recorded` and `local-clone`: words spread over the clip by letter count. That is fine for ≤ 12-word lines. Optional OpenAI Whisper alignment (about $0.006 per minute) when the owner allows it.

Recording UI:
- shows one line at a time with a big Record button;
- trims silence and normalises loudness with FFmpeg;
- saves `assets/shot-N.mp3`.

Rule: only the owner's own voice may be cloned. Never clone someone else's voice.

## 7. UI: `/cartoon` (Cartoon Studio)
Same layout as Motion Studio.
1. **Series:** pick a preset or your own series. Edit the name, language, audience, style, characters (look text + reference image upload), voice provider and rules.
2. **Episode:**
   - topic → *Write episode* (AI) → a shot list editor (narration, characters, scene, action, camera; reorder, add, delete);
   - a live preview with `@remotion/player` using keyframes or stills.
3. **Render:**
   - an engine badge (`stills` / `comfy`, plus whether ComfyUI is reachable);
   - *Render episode* and *Redo shot N*;
   - a per-shot grid showing the keyframe thumbnail and the clip / voice state;
   - an overall progress bar, the final video, and a download link.

The sidebar gets "Cartoon Studio". `lib/video-formats.ts` changes the format status from `needs-gpu` to `live` once P2 passes.

## 8. Files (new)
- `lib/cartoon/spec.ts`: types, presets, `sanitizeEpisode`, `sanitizeSeries`, prompt builder, timing helpers.
- `lib/cartoon/jobs.ts`: create, list, read, delete episode jobs and series.
- `app/cartoon/page.tsx`, `components/cartoon/*`.
- API routes:
  - `app/api/cartoon/series/route.ts` (GET, POST) and `series/[id]/route.ts` (GET, PUT, DELETE, reference upload);
  - `app/api/cartoon/script/route.ts`;
  - `app/api/cartoon/jobs/route.ts`, `jobs/[id]/route.ts` (GET, DELETE, `POST redo`);
  - `app/api/cartoon/files/[id]/[...path]/route.ts`;
  - `app/api/cartoon/record/route.ts` (upload one recorded line).
- `remotion/CartoonEpisode.tsx` (registered in `remotion/Root.tsx`); shared captions moved to `remotion/shared/Captions.tsx`.
- `scripts/render-cartoon.mjs`, `scripts/lib/voice.mjs` (moved from `render-motion.mjs` and extended), `scripts/lib/browser.mjs`, `scripts/lib/comfy.mjs`, `scripts/comfy-check.mjs` (`npm run comfy:check`).
- `comfy/workflows/README.md`, `keyframe.api.json`, `clip.api.json` (made on the home PC in P2).

## 9. Errors and limits
- **ComfyUI not running:** the job fails at the first ComfyUI step with "ComfyUI is not reachable at COMFY_URL — start run_nvidia_gpu.bat". Already-made shots are kept.
- **Out of memory:** the error text names the fix: smaller size, then a smaller GGUF, then `--lowvram`.
- **A clip takes longer than 30 min:** that shot fails, and the others continue. The episode ends as `failed` with the list of failed shots, which can be redone.
- **The AI returns bad JSON or breaks the rules:** one retry with the error, then a plain-English error.
- **Character drift:** fixed by the reference image plus fixed look text. The owner can upload a better keyframe for any shot by hand.

## 10. Phases
- **P1 — office PC (no GPU), Claude Code:**
  - series presets + editor;
  - episode writer;
  - shot editor + preview;
  - voice layer (`edge` + `recorded`);
  - worker with the `stills` engine;
  - `CartoonEpisode` assembly;
  - per-shot resume and redo.
  - **Done =** a 3-shot and a 10-shot episode render here with stills, checked with `verify-render`.
- **P2 — home PC, Antigravity or Claude:**
  - install ComfyUI + models (`docs/ai/home-pc-setup.md`);
  - export the two workflows (`comfy-workflow` skill);
  - `scripts/lib/comfy.mjs` + `comfy:check`;
  - measure the time per clip and pick the size.
  - **Done =** a full 60 s episode renders unattended with real clips, and a consistent character.
- **P3 — voices (needs the owner's choice):** `elevenlabs-clone` and/or `local-clone`, and moving Motion Studio onto the same voice layer.
- **Later, separate specs:** YouTube/Instagram/Facebook upload for Motion + Cartoon; a scheduler that really posts.

## 11. Testing
- `npm run check` on every phase.
- `verify-render` on a real episode: shot order, caption sync, no cut-off text, Urdu in Urdu script, duration = sum of shots.
- P2 adds `npm run comfy:check`, plus a one-shot smoke render that must finish in under 20 min on the home PC.

## 12. Out of scope (for now)
Lip-sync, several voices per episode (character dialogue), background music generation, 16:9 long videos, and paid video APIs.
