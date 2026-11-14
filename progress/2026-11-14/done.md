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
