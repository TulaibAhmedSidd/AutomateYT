# Note for Claude (Office PC) from Antigravity (Home GPU PC)

*Date: 2026-11-14 | Author: Antigravity | Machine: Home PC (Intel i7, 16 GB RAM, NVIDIA RTX 2070 SUPER 8 GB VRAM)*

---

## 1. What was Achieved & What Passed

### ComfyUI Setup & Cleanup
- ComfyUI Desktop is set up and tested at `D:\Comfy-Desktop\ComfyUI-Installs\ComfyUI\ComfyUI` using shared models at `D:\Comfy-Desktop\ComfyUI-Shared\models`.
- A background ~40 GB download of the MiniMax H3 template was identified as incompatible with 8 GB VRAM (requires 24+ GB) and deleted with owner approval, freeing ~42 GB disk space.
- Cloned and installed custom node **`ComfyUI-GGUF`** ([city96/ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF)) and installed python dependencies (`gguf`, `protobuf`).
- Downloaded and verified Wan 2.2 TI2V 5B GGUF models:
  - `Wan2.2-TI2V-5B-Q4_K_M.gguf` (3.19 GB) in `models/unet/` and `models/diffusion_models/`
  - `umt5-xxl-encoder-Q4_K_M.gguf` (3.40 GB) in `models/text_encoders/` and `models/clip/`
  - `Wan2.2_VAE.safetensors` (1.31 GB) in `models/vae/`

### Timing Benchmarks on 8 GB VRAM (RTX 2070 Super)
All tests run with Wan 2.2 TI2V 5B GGUF Q4, 20 steps, `uni_pc` sampler, `simple` scheduler, CFG 6.0:

| Test | Resolution | Frames (Duration @ 24 fps) | Time Taken | Peak VRAM | Offload Behavior | Result |
|---|---|---|---|---|---|---|
| **Test A** | 480×832 | 49 f (2.04 s) | **21.37 min** | 7,938 MB | Fits inside VRAM (~28s/step) | ✅ Passed (`wan5b_480x832_49f_00001_.mp4`) |
| **Test B** | 480×832 | 121 f (5.04 s) | **41.86 min** | 7,185 MB | 2.36 GB offloaded to RAM (~119s/step) | ✅ Passed (`wan5b_480x832_121f_00001_.mp4`) |
| **Test C** | 704×1280 | 121 f (5.04 s) | **>25 hours (impractical)** | 7,844 MB | 100% offloaded + 3.44 GB shared RAM thrashing | ❌ Stopped with owner OK (1 step took >1.5 hrs due to PCIe memory paging) |

- **Verification:** Both outputs in `D:\Comfy-Desktop\ComfyUI-Shared\output\` were verified with `ffprobe` as valid 960×1664 24 fps videos.
- **VAE Note:** Always use `VAEDecodeTiled` (`tile_size: 512, temporal_size: 64, temporal_overlap: 8`). Standard `VAEDecode` runs out of memory on video latents.

### Exported Workflows
- **`comfy/workflows/clip.api.json`**: Production API workflow using `UnetLoaderGGUF`, `CLIPLoaderGGUF`, and `VAEDecodeTiled`. Replaced literal values with tokens (`{{PROMPT}}`, `{{NEGATIVE}}`, `{{IMAGE}}`, `{{SEED}}`, `{{WIDTH}}`, `{{HEIGHT}}`, `{{FRAMES}}`, `{{PREFIX}}`).
- **`comfy/workflows/README.md`**: Complete documentation of model paths, node dependencies, token reference, and benchmark numbers.

---

## 2. Making 2D Character Videos Faster vs 3D

The owner asked if 2D character videos can be made instead of 3D to make generation faster:

1. **In Wan 2.2 Video Diffusion (5B):**
   - 2D prompts vs 3D prompts take the exact same compute time (~21 min for 2s, ~42 min for 5s) because neural tensor math depends on pixel dimensions and frame count, not visual style.
2. **How to make 2D character videos MUCH faster:**
   - **Option 1: Stills Engine (Phase 1 — Built & Live Now):**
     - Generates 2D character still art (flat cartoon, anime, or comic strip style) via 2D image models.
     - Remotion animates them with camera pans, zooms, dynamic cuts, voiceover, and karaoke captions.
     - **Render time:** Renders a full 60-second video in **20 to 30 seconds** on any PC!
   - **Option 2: 2D Talking Head / Lip-Sync (LivePortrait / SadTalker):**
     - Generates 2D face motion/lip-sync from a single 2D character image in **15 to 30 seconds** per shot.
   - **Option 3: SD1.5-based AnimateDiff (2D Anime / Cartoon):**
     - 512×512 2D cartoon clips take **1 to 2 minutes** per shot instead of 40 minutes because SD1.5 is ~1B parameters compared to Wan 2.2's 5B.

---

## 3. What to Do Next (Handoff to Office PC)

### A. Cartoon Studio Phase 2 Engine (`CARTOON_ENGINE=comfy`)
Claude can implement the app integration on the office PC:
1. **ComfyUI Client Helper:**
   - Create `scripts/lib/comfy.mjs` to communicate with ComfyUI over HTTP (`http://127.0.0.1:8188`).
   - Functions needed:
     - `checkComfyHealth()`: hits `/system_stats`.
     - `uploadInputImage(filePath)`: POST to `/upload/image`.
     - `queueClip(spec, tokens)`: loads `comfy/workflows/clip.api.json`, substitutes tokens, POST to `/prompt`.
     - `pollPrompt(promptId)`: polls `/history/{promptId}` until complete.
     - `downloadOutput(filename)`: retrieves the generated MP4.
2. **Wire into `scripts/render-cartoon.mjs`:**
   - Replace the error at line 103 (`if (engine === 'comfy') throw...`) with the actual ComfyUI clip generation call for each shot.
3. **`npm run comfy:check`:**
   - Add the check script to `package.json` that reports GPU VRAM, connection status, and model presence.

### B. Series & Episode Generation
1. 10 series are already planned in `content/cartoon/series/*.json` (153 total episodes).
2. 18 scripts are written for *Chacha Jee aur Pappu*. The remaining 135 scripts can be generated once the owner approves the OpenAI account (Volt On Solar vs personal account).
3. Episodes can be rendered via:
   - Stills mode (`CARTOON_ENGINE=stills`): instant generation (seconds).
   - Comfy mode (`CARTOON_ENGINE=comfy`): 480×832 @ 49 frames (~21 min/shot) or 121 frames (~42 min/shot) on the Home GPU PC.
