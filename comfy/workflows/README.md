# ComfyUI Workflows for AutomateYT (Cartoon Studio Phase 2)

This directory contains the API-format workflow JSON files used by AutomateYT to generate AI keyframes and animated cartoon clips on the home GPU PC (NVIDIA 6–8 GB VRAM).

The app never builds ComfyUI graphs in code. It loads these API workflow JSONs, replaces `{{TOKENS}}`, and posts them to `http://127.0.0.1:8188/prompt`.

---

## 1. Workflows Overview

| Workflow | File | Task | Model | Steps | Sampler |
|---|---|---|---|---|---|
| **Picture** | `picture.api.json` | Text → Picture (First shot / Character ref) | **FLUX.1 schnell (GGUF Q4_K_S)** | 4 | euler / simple |
| **Keyframe** | `keyframe.api.json` | Picture + Text → Edited Picture (Transition stages / Same view) | **FLUX.1 Kontext dev (GGUF Q4_K_M)** | 20 | euler / simple |
| **Clip** | `clip.api.json` | Picture + Text → Animated Clip (2s or 5s video) | **Wan 2.2 TI2V 5B (GGUF Q4_K_M)** | 20 | uni_pc / simple |

---

## 2. Models & Shared Files

All model files live in ComfyUI's shared models directory (`D:\Comfy-Desktop\ComfyUI-Shared\models\`):

| Model Component | Filename | Subfolder | Size | Source | Used By |
|---|---|---|---|---|---|
| **FLUX.1 schnell UNet** | `flux1-schnell-Q4_K_S.gguf` | `models/unet/` | 6.31 GiB (6.78 GB) | Hugging Face (`city96/FLUX.1-schnell-gguf`) | `picture.api.json` |
| **FLUX.1 Kontext dev UNet** | `flux1-kontext-dev-Q4_K_M.gguf` | `models/unet/` | 6.45 GiB (6.93 GB) | Hugging Face (`QuantStack/FLUX.1-Kontext-dev-GGUF`) | `keyframe.api.json` |
| **Wan 2.2 TI2V 5B UNet** | `Wan2.2-TI2V-5B-Q4_K_M.gguf` | `models/unet/` | 3.19 GB | Hugging Face (`QuantStack / city96`) | `clip.api.json` |
| **CLIP (FLUX & Wan)** | `clip_l.safetensors` | `models/clip/` | 246 MB | Hugging Face (`comfyanonymous/flux_text_encoders`) | `picture`, `keyframe` |
| **T5 XXL (FLUX)** | `t5-v1_1-xxl-encoder-Q4_K_M.gguf` | `models/clip/` | 2.89 GB | Hugging Face (`city96/t5-v1_1-xxl-encoder-gguf`) | `picture`, `keyframe` |
| **UMT5 XXL (Wan)** | `umt5-xxl-encoder-Q4_K_M.gguf` | `models/clip/` | 3.40 GB | Hugging Face (`city96`) | `clip` |
| **FLUX VAE** | `ae.safetensors` | `models/vae/` | 335 MB | Hugging Face (`camenduru/FLUX.1-dev-ungated`) | `picture`, `keyframe` |
| **Wan VAE** | `Wan2.2_VAE.safetensors` | `models/vae/` | 1.31 GB | Official Wan 2.2 Hugging Face repo | `clip` |

### Required Custom Nodes
- **`ComfyUI-GGUF`**: [https://github.com/city96/ComfyUI-GGUF](https://github.com/city96/ComfyUI-GGUF)
  - Installed in `custom_nodes/ComfyUI-GGUF`.
  - Python requirements: `pip install gguf protobuf`.
  - Nodes used: `UnetLoaderGGUF`, `DualCLIPLoaderGGUF` (FLUX), `CLIPLoaderGGUF` (Wan).

---

## 3. Benchmark & Timing Results (NVIDIA RTX 2070 Super 8 GB VRAM)

Measured on local PC (Intel i7, 16 GB RAM, NVIDIA GeForce RTX 2070 SUPER 8 GB VRAM, Windows 11):

| Workflow | Task / Subject | Resolution | Steps | Time Taken | Peak VRAM | Status |
|---|---|---|---|---|---|---|
| **`picture.api.json`** | Text → Picture (Lahore Fort Alamgiri Gate) | 480×832 | 4 | **1.22 min (73 s)** | 7,451 MB | ✅ Clean run (fits in 8 GB VRAM) |
| **`keyframe.api.json`** | Lahore Fort → "Same view in 1947" | 480×832 | 20 | **2.30 min (138 s)** | 7,369 MB | ✅ Clean run (framing & view 100% consistent) |
| **`clip.api.json`** (Test A) | Animated Video Clip (49 frames, 2.04 s) | 480×832 | 20 | **21.37 min** | 7,938 MB | ✅ Clean run (~28s/step) |
| **`clip.api.json`** (Test B) | Animated Video Clip (121 frames, 5.04 s) | 480×832 | 20 | **41.86 min** | 7,185 MB | ✅ Clean run (~119s/step) |

### Visual Consistency Test (Keyframe Workflow)
When given a starting photo of Lahore Fort Alamgiri Gate and prompted to show the "same view in 1947":
- **Perspective & Camera Angle:** 100% preserved. The gateway arch, corner minarets, parapet moldings, and distance to the background monument through the archway remained identical in position and scale.
- **Visual Changes:** The stonework surfaces accumulated vintage weathering with warm aged lighting suitable for 1947, without altering the architectural framing.

---

## 4. Workflow Tokens Reference

### `picture.api.json` (Text → Picture)
| Token | Type | Description |
|---|---|---|
| `{{PROMPT}}` | string | Positive prompt description |
| `{{NEGATIVE}}` | string | Negative prompt |
| `{{SEED}}` | number | Random seed |
| `{{WIDTH}}` | number | Latent width (e.g. 480) |
| `{{HEIGHT}}` | number | Latent height (e.g. 832) |
| `{{PREFIX}}` | string | Output image prefix (saved to `output/`) |

### `keyframe.api.json` (Picture + Text → Edited Picture)
| Token | Type | Description |
|---|---|---|
| `{{PROMPT}}` | string | Transformation / preservation prompt |
| `{{NEGATIVE}}` | string | Negative prompt |
| `{{IMAGE}}` | string | Filename of input image inside ComfyUI `input/` |
| `{{SEED}}` | number | Random seed |
| `{{WIDTH}}` | number | Output width (e.g. 480) |
| `{{HEIGHT}}` | number | Output height (e.g. 832) |
| `{{PREFIX}}` | string | Output image prefix (saved to `output/`) |

### `clip.api.json` (Picture + Text → Animated Clip)
| Token | Type | Description |
|---|---|---|
| `{{PROMPT}}` | string | Positive prompt description |
| `{{NEGATIVE}}` | string | Negative prompt |
| `{{IMAGE}}` | string | Input image filename inside ComfyUI `input/` |
| `{{SEED}}` | number | Random seed |
| `{{WIDTH}}` | number | Latent width (e.g. 480) |
| `{{HEIGHT}}` | number | Latent height (e.g. 832) |
| `{{FRAMES}}` | number | Number of video frames (e.g. 49 or 121) |
| `{{PREFIX}}` | string | Output filename prefix |
