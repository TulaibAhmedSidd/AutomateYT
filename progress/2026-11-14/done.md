# Done — 2026-11-14

## 15:50 PKT — home PC (NVIDIA RTX 2070 Super, 8 GB VRAM)

**Wan 2.2 Benchmarks & ComfyUI Setup Finalized**
- Completed timing benchmarks for Wan 2.2 TI2V 5B GGUF Q4 on 8 GB VRAM:
  - **480×832 @ 49 frames (2.04 s):** **21.37 minutes**, peak VRAM 7,938 MB. Full UNet fit in VRAM (~28s/step). Video verified: `wan5b_480x832_49f_00001_.mp4` (960×1664 24 fps).
  - **480×832 @ 121 frames (5.04 s):** **41.86 minutes**, peak VRAM 7,185 MB. Partial offload to RAM (~119s/step). Video verified: `wan5b_480x832_121f_00001_.mp4` (960×1664 24 fps).
  - **704×1280 @ 121 frames (5.04 s):** Impractical for 8 GB VRAM. Caused 3.44 GB PCIe shared memory paging/thrashing (>1.5 hours per step, projected >25 hours). Halted with owner approval.
- Exported production workflow `comfy/workflows/clip.api.json` with token placeholders (`{{PROMPT}}`, `{{NEGATIVE}}`, `{{IMAGE}}`, `{{SEED}}`, `{{WIDTH}}`, `{{HEIGHT}}`, `{{FRAMES}}`, `{{PREFIX}}`) and `VAEDecodeTiled` to prevent VAE OOM.
- Documented everything in `comfy/workflows/README.md`.

**Note for Claude (Office PC)**
- Wrote comprehensive handoff note in `docs/ai/note-for-claude.md`:
  - Summarizes GPU benchmark results and confirmed model paths.
  - Explains how to make 2D character videos faster (Stills engine in ~20-30s vs AnimateDiff in 1-2m vs Wan 2.2 diffusion).
  - Provides step-by-step instructions for Claude to connect `CARTOON_ENGINE=comfy` in `scripts/render-cartoon.mjs` and `npm run comfy:check`.

## Office PC (Claude)
- **ComfyUI engine** (`fc2922c`):
  - `scripts/lib/comfy.mjs` (auto-start from COMFY_START, token filling, upload, polling, download);
  - `npm run comfy:check`;
  - the worker makes AI pictures (when a keyframe workflow exists) and 2-second Wan clips.
  - Tested end to end with `scripts/dev/fake-comfy.mjs`: picture → clip → render, clips play then hold the last frame, durations exact.
- **Step 2 · Video type tabs** in the studio: Pictures / Key moments animated / Fully animated, with time estimates (21 min per clip), tap-to-pick key lines, and ComfyUI status.
- **YouTube** (`bf428d2`):
  - Connections page with Connect YouTube (Google sign-in; token kept on this PC);
  - Upload to YouTube (private) under every finished video.
  - Checked: the sign-in link reaches Google correctly. **Not tested: the real sign-in and upload** (needs the owner's Google login, plus the redirect URI added in Google Cloud).
- **Horror** (`d58c856`): Raat Ki Kahaniyan, Urdu, 20 episodes, all scripts written.
- **Transition reels** (`3c17692`):
  - new no-voice format with flash cuts and labels;
  - 5 series × 10 reels, all written (then-and-now-pakistan, evolution-of, glow-up-nature, one-place-four-seasons, cities-of-the-future);
  - one test reel rendered (10.8 s).
- Scripts written today on the owner's TAS OpenAI key: 70 (about $0.80).
- Owner chose to focus on horror and Then & Now Pakistan; no Chacha Jee for now.
- Picture logic:
  - `picture` (text → picture) and `keyframe` (edit) workflows;
  - transition stages are edited from the previous stage;
  - character reference pictures are made automatically.
  - Tested with the fake ComfyUI: Then & Now made 6 chained pictures; horror made Bashir and Saad references, 12 pictures and 3 clips.
- English horror series **Midnight Watch** (20 episodes, ElevenLabs Brian), all scripts written. The Urdu horror stays.
- Voice samples: every voice (ElevenLabs free and paid, Microsoft) has a free Listen button in Step 1 and Edit series, plus "Hear all voices" list. 58 samples saved in `storage/voice-samples/` (7 MB). New "Try on line 1 only" button makes just the first line (shows credits) so the owner hears the voice on the real script before making all lines.

## 18:40 PKT — home PC (NVIDIA RTX 2070 Super, 8 GB VRAM)

**ComfyUI Picture & Keyframe Workflows Completed**
- **ComfyUI Environment:** Verified `COMFY_URL=http://127.0.0.1:8188` and `COMFY_START=D:\SOFT\Comfy\Comfy Desktop\Comfy Desktop.exe` in `.env.local`. Added `NODE_OPTIONS="--experimental-strip-types"` so Node child processes load `.ts` helper modules. `npm run comfy:check` passed 100%.
- **Picture Workflow (`picture.api.json`):**
  - Implemented Text → Picture using **FLUX.1 schnell (GGUF Q4_K_S)**, `DualCLIPLoaderGGUF`, `EmptySD3LatentImage`, Euler simple 4 steps, CFG 1.0, guidance 3.5.
  - Benchmark Test (a) on RTX 2070 Super (8 GB VRAM): **1.22 minutes (73.0 s)**, peak VRAM **7,451 MB** (well under the 3 min limit). Output: `lahore_fort_test_00001_.png`.
- **Keyframe Workflow (`keyframe.api.json`):**
  - Implemented Picture + Text → Edited Picture using **FLUX.1 Kontext dev (GGUF Q4_K_M)**, `ReferenceLatent`, `FluxKontextImageScale`, `ConditioningZeroOut`, Euler simple 20 steps, guidance 2.5.
  - Benchmark Test (b) on RTX 2070 Super: **2.30 minutes (137.8 s)** (subsequent runs ~105 s), peak VRAM **7,369 MB**.
  - Consistency test: Fed Lahore Fort image and asked for "same view in 1947". View, framing, archways, and background silhouette remained 100% locked with vintage historical aging.
- **Workflow Documentation:**
  - Updated `comfy/workflows/README.md` with model locations, download sources, tokens, and verified timing benchmarks for all three workflows (`picture`, `keyframe`, `clip`).

**Full Video Production — "Then & Now: Pakistan"**
- Rendered 3 complete episodes end-to-end (all AI pictures generated via ComfyUI + assembled into vertical 1080×1920 @ 30 fps MP4 via Remotion):
  - **Episode 1 ("Lahore Then & Now"):** 6 shots, rendered in **11 min 25 s**. Output: `storage/cartoon/episodes/then-and-now-pakistan-e01/video.mp4` (6.4 MB).
  - **Episode 2 ("Karachi’s Empress Market"):** 6 shots, rendered in **11 min 20 s**. Clock tower and facade preserved while foreground evolved from 1890s carriage to today's rickshaw. Output: `storage/cartoon/episodes/then-and-now-pakistan-e02/video.mp4` (7.5 MB).
  - **Episode 3 ("Islamabad: From Foothills to Faisal Mosque"):** 7 shots, rendered in **13 min 38 s**. Output: `storage/cartoon/episodes/then-and-now-pakistan-e03/video.mp4` (8.4 MB).
- **Technical Observation for Claude:** Chaining 6 consecutive lossy edits in Episode 3 caused latent saturation by Shot 7. For transition series, referencing Shot 1 as the anchor (`keyframeFile(shots[0])`) will keep all subsequent eras as clean as Episodes 1 and 2.

- **Owner Review & Quality Assessment:**
  - Owner reviewed the rendered video (`output of lahore video.mp4` / `episodes-then-and-now-pakistan-e01-video.mp4`) and marked the current transition reel quality as unusable for YouTube Shorts.
  - Wrote Section 4 in `docs/ai/note-for-claude.md` with a detailed failure analysis:
    1. AI hallucinated architecture and painterly/smudged textures look fake compared to real archival photos.
    2. Sequential chaining in `render-cartoon.mjs` degrades quality over multiple passes.
    3. Total silence (no music, no whooshes, no shutter sound) makes the video lifeless.
    4. Hard cuts need dynamic wipe/slider transitions, camera push-in zooms, and sound design.
  - Saved sample video in repo root as `output of lahore video.mp4`.
- **Live render progress (Claude, office PC):** the owner could not tell what the PC was doing during a 1.5-hour render. The studio now shows a sticky panel at the top: % done, minutes left, how long it has run, each step with done/total (voice, character pictures, AI pictures, moving clips, join into MP4), the line being worked on, and every picture as soon as it is made. Tested with the fake ComfyUI end to end.
- Transition stages are now edited from the first picture, not chained (Antigravity found chaining washed out stage 7).
- **Transition reels fixed after the owner's review:** wipe with a bright line between eras, slow push-in, old-film look for years before 1990, whoosh + impact sound effects (made with FFmpeg), stronger "real photograph" prompts and a negative prompt against painting/CGI looks. Tested with the fake ComfyUI: the MP4 has sound and the wipe.
- **Motion graphics, new direction (owner wants motion graphics, not AI-picture transitions):**
  - New scene kind `timeline` ("Then → Now"): the year flips, the number counts up, bars grow.
  - Motion Studio can use ElevenLabs voices (`eleven:<id>`, model picker, credit estimate); spoken lines are cached so re-renders are free. Listen plays the free demo clip.
  - Series library for Motion Studio (`content/motion/series/`), with a Series panel: cards with progress, episode list, Open, and a "check before posting" note for prices.
  - Series **Pakistan: Tab aur Ab (numbers)**: 7 Urdu episodes (population, dollar, gold, petrol, Karachi, Lahore, literacy). Census numbers are official; gold and petrol "today" values must be re-checked on the day of posting.
  - Test render of the gold episode with the free Asad voice: timeline, counting and bars look right.
  - AI writer and a new "Then → Now" template know the timeline scene.
- **Owner feedback round (late night):** Stop button for renders (kills worker + ComfyUI job, keeps finished work); crash message now shows the last lines of log.txt; Chrome launch retried 3 times (it failed now and then); Step 1 Voice shows on transition reels (optional voice, used in the video); one shared VoicePicker with Listen/Hear all in Cartoon Step 1, Edit series and Motion Studio (Motion showed only Microsoft voices before).
- The new ElevenLabs key put in the office .env.local is not a valid API key (it does not start with `sk_`; ElevenLabs answers 401). The old key is still there, commented out.
- **Motion Studio rebuilt like Cartoon Studio** (owner asked): `/motion` = series cards + Single video, `/motion/<series>` = episode list with made / scheduled / on YouTube and "what to do next", `/motion/studio` = Step 1 voice, Step 2 scenes, Step 3 make the video, Step 4 YouTube.
- **YouTube publishing done properly** in both studios: title, description with hashtags, tags, Made for kids = No, category, schedule at the next free slot or a picked time, upload from the app or by hand in YouTube Studio with copy buttons and "Mark as posted". Every post is logged; lists show what is on YouTube; "next video should go up" uses the posting plan (default 19:00 daily).
- YouTube rule found: an unaudited Google project's uploads are locked private (scheduled too). Until the free API audit passes, the app recommends uploading in Studio. Audit form link is in the panel.
