# Done — 2026-11-13

## 03:00 PKT — office PC (Intel graphics)

**Cartoon Studio Phase 1 (pushed earlier today: `dab64cf`…`5a55ed9`)**
- Shared voice, render and caption code. Motion render re-checked: same result, 25 s.
- Cartoon spec with 4 starter series, plus 15 unit tests (`npm test`).
- Storage and API routes.
- Own-voice recording: the browser records each line, and FFmpeg cleans it. Tested on the owner's real recording: 0.2–0.7 s to clean. Fixed an FFmpeg stall (loudnorm must come before areverse).
- AI episode writer.
- Render worker with the stills engine. A 3-shot test render was checked frame by frame: the owner's voice, the AI voice, a picture, a reference image and a placeholder card.
- Studio page. Checked at 1280 px and 390 px. The mic cannot be tested in the built-in browser (blocked); it shows the friendly message.

**Content library (this commit)**
- 10 series in `content/cartoon/series/`. Each has 15 planned episodes, except Chacha Jee aur Pappu with 18. Extra ideas are kept in `moreIdeas`.
  - Islamic (Urdu, child-friendly, peaceful, no holy figures shown): Tareekh ke Roshan Safhay, Musalman Sciencedan.
  - Kids: Mishi & Bruno (cat + dog, English), Mano aur Sheru (cat + dog, Urdu), Wild Superpowers, Tiny Time Traveler.
  - Grown-ups: Chacha Jee aur Pappu (Urdu desi comedy).
  - Trending: If Things Could Talk, What If? Lab.
  - Earning: Coin & Kash (money basics).
- 18 scripts written (Chacha Jee aur Pappu 1–18). The other 135 are not written yet; this waits for the owner's OK on which OpenAI account pays.
- Model test, same Urdu episode on 4 models: GPT-6.1 Sol was clearly best. GPT-4o mini used an English word and had a weak hook; GPT-4o misspelled a name. Sol is now the default. It costs about 1.7 cents per episode (measured 700 in + 1,580 out tokens).
- The OpenAI key in `.env.local` belongs to the **Volt On Solar Energy** account (voltonsolarenergy@gmail.com). About $0.45 was spent today.

**New screens**
- `/cartoon`: series cards grouped by type. Each card shows progress bars (scripts, recorded, videos) and the cost to write its missing scripts.
- `/cartoon/<series>`: every episode with its status (✅ video ready / 🎙 recording / 📝 script ready / no script yet). "Write script" (with cost) appears only on unwritten ones. Includes a model dropdown with the cost per episode.
- `/cartoon/studio?series=&episode=` opens the episode straight away.
- Checked in the browser: cards → Chacha series → episode 1 opens in the studio.

## 03:45 PKT — office PC
- **ElevenLabs voices** (the owner will not record his own voice):
  - each series now picks ElevenLabs, own recording or the free voice;
  - the 10 library series default to ElevenLabs eleven_v4 with premade voices (Liam, George, Jessica, Laura, Sarah, Callum, Charlie, Chris);
  - the writer adds [laughs]/[sighs] tags and natural Urdu with everyday English words;
  - captions use real word timings and skip the tags.
- Explored the ElevenLabs API: v4, v4 turbo and v3 speak Urdu; older models do not. The account is on the **Free plan**: Urdu library voices (Kamran M, Naqsh, Saira…) are blocked via the API (402), and output is non-commercial.
- Tested: 4 Urdu samples sent to the owner, plus a 2-shot Chacha episode rendered end to end with ElevenLabs. Fixed two caption bugs: the caption jumped to the last word in gaps between words, and the Roman Urdu end card was shown right-to-left.
- Library series updates now reach the app on the next load, unless the owner edited that series in the app.


## 19:40 PKT — home PC (NVIDIA RTX 2070 Super, 8 GB VRAM)

**System Health & Setup (home-pc-setup skill)**
- GPU: NVIDIA GeForce RTX 2070 SUPER (8,192 MiB VRAM). Driver 566.14, CUDA 12.7.
- System RAM: 15.91 GB total (~4.7 GB free initially).
- Disk: C: 23.3 GB free; D: ~160 GB free (after cleanup).
- Node: v22.11.0, Git user: `ahsidtullu@gmail.com`, git hooks path: `.githooks`.
- `.env.local`: verified required keys are present (names only, values never logged).
- Checked ComfyUI Desktop: installed at `D:\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI` using shared models at `D:\Comfy-Desktop\ComfyUI-Shared\models`.

**ComfyUI Cleanup & Wan 2.2 Model Setup**
- Investigated the ~40 GB background download: confirmed it was the MiniMax H3 template (`video_minimax_h3_t2v`), which requires 24+ GB VRAM and cannot run on an 8 GB card.
- User approved cleanup: removed ~42 GB of MiniMax files, freeing disk space on D:.
- Cloned and installed `ComfyUI-GGUF` custom node into ComfyUI's `custom_nodes/`. Installed `gguf` and `protobuf` into ComfyUI python venv.
- Downloaded and verified all 3 Wan 2.2 TI2V 5B components:
  - `Wan2.2-TI2V-5B-Q4_K_M.gguf` (3.19 GB) in `models/unet/` and `models/diffusion_models/`
  - `umt5-xxl-encoder-Q4_K_M.gguf` (3.40 GB) in `models/text_encoders/` and `models/clip/`
  - `Wan2.2_VAE.safetensors` (1.31 GB) in `models/vae/`
- Created `D:\Comfy-Desktop\run_nvidia_gpu.bat` and started ComfyUI as background server on port 8188.

**Wan 2.2 TI2V 5B Timing Benchmarks (8 GB VRAM)**
- **Test A (480×832, 49 frames / 2.04 s @ 24 fps):**
  - Time taken: **21.37 minutes** (sampling: 9.3 min @ ~28s/step; tiled VAE decode + MP4 save: ~12 min).
  - Peak VRAM: **7,938 MB**.
  - UNet fit completely in VRAM during sampling.
  - Video verified: `wan5b_480x832_49f_00001_.mp4` (960×1664, 24 fps, 2.04 s, 49 frames). Clean render, 0 errors.
- **Test B (480×832, 121 frames / 5.04 s @ 24 fps):**
  - Time taken: **41.86 minutes** (sampling: 38.3 min @ ~119s/step; tiled VAE decode + MP4 save: 3.5 min).
  - Peak VRAM: **7,185 MB**.
  - ComfyUI partially loaded UNet (992 MB in VRAM, 2,364 MB offloaded to system RAM) to fit larger latent volume.
  - Video verified: `wan5b_480x832_121f_00001_.mp4` (960×1664, 24 fps, 5.04 s, 121 frames). Clean render, 0 errors.
- **Test C (704×1280, 121 frames / 5.04 s @ 24 fps):**
  - Result: Impractical for 8 GB VRAM. ComfyUI reserved 0 MB in VRAM for UNet (100% offloaded) and the 2.25× larger video latent caused the NVIDIA driver to page 3.44 GB into shared system RAM. Step 1 alone took >1.5 hours (~25–30 hours projected for 20 steps). Halted with owner's approval.
  - Conclusion: 480×832 is the definitive resolution for 8 GB VRAM (upscales automatically to 960×1664 via VAE, perfect for Remotion vertical 1080×1920).

**Workflow Export & Documentation (comfy-workflow skill)**
- Created `comfy/workflows/clip.api.json` with token placeholders (`{{PROMPT}}`, `{{NEGATIVE}}`, `{{IMAGE}}`, `{{SEED}}`, `{{WIDTH}}`, `{{HEIGHT}}`, `{{FRAMES}}`, `{{PREFIX}}`).
- Uses `UnetLoaderGGUF` and `CLIPLoaderGGUF` with `VAEDecodeTiled` (tile size 512, temporal size 64) to prevent VAE OOM on video latents.
- Wrote `comfy/workflows/README.md` detailing models, folders, custom nodes, token schema, benchmark timings, and recommended settings (480×832 at 49 or 121 frames).
