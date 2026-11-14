# ComfyUI Workflows for AutomateYT (Cartoon Studio Phase 2)

This directory contains the API-format workflow JSON files used by AutomateYT to generate AI keyframes and animated cartoon clips on the home GPU PC (NVIDIA 6–8 GB VRAM).

The app never builds ComfyUI graphs in code. It loads these API workflow JSONs, replaces `{{TOKENS}}`, and posts them to `http://127.0.0.1:8188/prompt`.

---

## 1. Clip Workflow (`clip.api.json`)
Generates an animated video clip from a starting keyframe image and text prompt using **Wan 2.2 TI2V 5B (GGUF Q4)**.

### Model Files & Folders
All model files live in ComfyUI's shared models directory (`models/`):

| Model Component | Filename | Subfolder | Size | Source |
|---|---|---|---|---|
| **Diffusion UNet** | `Wan2.2-TI2V-5B-Q4_K_M.gguf` | `models/unet/` (or `models/diffusion_models/`) | 3.19 GB | Hugging Face (QuantStack / city96) |
| **Text Encoder (CLIP)** | `umt5-xxl-encoder-Q4_K_M.gguf` | `models/text_encoders/` (or `models/clip/`) | 3.40 GB | Hugging Face (city96) |
| **VAE** | `Wan2.2_VAE.safetensors` | `models/vae/` | 1.31 GB | Official Wan 2.2 Hugging Face repo |

### Required Custom Nodes
- **`ComfyUI-GGUF`**: [https://github.com/city96/ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF)
  - Installed in `custom_nodes/ComfyUI-GGUF`.
  - Python requirements: `pip install gguf protobuf`.
  - Nodes used: `UnetLoaderGGUF` (node 1) and `CLIPLoaderGGUF` (node 2, type `wan`).

### VAE Decode Recommendation
- Always use `VAEDecodeTiled` (tile size 512, overlap 64, temporal size 64, temporal overlap 8) instead of standard `VAEDecode`.
- Regular VAE decoding runs out of VRAM when decoding video latents (>40 frames) on 8 GB cards.

---

## 2. Benchmark & Timing Results (NVIDIA RTX 2070 Super 8 GB VRAM)

Measured on local PC (Intel i7, 16 GB RAM, NVIDIA RTX 2070 SUPER 8 GB VRAM, Windows 11):

| Test | Resolution | Frames (Duration @ 24 fps) | Minutes Taken | Peak VRAM | Offload Behavior | Status |
|---|---|---|---|---|---|---|
| **Test A** | 480×832 | 49 f (2.04 s) | **21.37 min** | 7,938 MB | Fits in VRAM (~28s/step) | ✅ Clean run |
| **Test B** | 480×832 | 121 f (5.04 s) | **41.86 min** | 7,185 MB | 2.36 GB offloaded to RAM (~119s/step) | ✅ Clean run |
| **Test C** | 704×1280 | 121 f (5.04 s) | **>25 hours (impractical)** | 7,844 MB | 100% offloaded + 3.44 GB shared RAM thrashing | ❌ Halted (1 step took >1.5 hrs due to PCIe paging) |

### Recommended Production Settings for 6–8 GB GPUs
- **Best Resolution**: **480×832** (vertical 9:16).
  - Wan 2.2 VAE automatically decodes this to **960×1664**, which Remotion/FFmpeg easily fits into vertical 1080×1920 with crisp sharpness.
  - 704×1280 has 2.25× more latent area and causes the NVIDIA driver to page into shared system RAM, reducing speed by ~50×. Avoid 704×1280 on 8 GB cards.
- **Best Frame Count**:
  - **49 frames (2 seconds)**: ~21 minutes per shot. Great for quick actions, cuts, and character reactions.
  - **121 frames (5 seconds)**: ~42 minutes per shot. Great for longer continuous dialogue or scenic shots.
- **Sampler**: `uni_pc`, `simple` scheduler, 20 steps, CFG 6.0.

---

## 3. Workflow Tokens Reference

When `clip.api.json` is loaded by the worker, it replaces these tokens:

| Token | Type | Description |
|---|---|---|
| `{{PROMPT}}` | string | Positive prompt description of the animated scene |
| `{{NEGATIVE}}` | string | Negative prompt (removes artifacts, blur, watermark) |
| `{{IMAGE}}` | string | Filename of the input keyframe image inside `input/` |
| `{{SEED}}` | number | Random seed for generation reproducibility |
| `{{WIDTH}}` | number | Latent width (e.g. 480) |
| `{{HEIGHT}}` | number | Latent height (e.g. 832) |
| `{{FRAMES}}` | number | Number of video frames to generate (e.g. 49 or 121) |
| `{{PREFIX}}` | string | Output filename prefix (saved to `output/`) |
