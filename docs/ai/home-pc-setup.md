# Home PC (GPU) setup — baby steps

The home PC has an NVIDIA GPU with 6–8 GB of video memory (VRAM). It runs the same AutomateYT app plus **ComfyUI**, which makes the cartoon pictures and clips. Follow the steps in order. Each step says how to check that it worked.

## What you need
- An NVIDIA graphics card. Check in Task Manager → Performance → GPU → "Dedicated GPU memory".
- **16 GB RAM minimum, 32 GB better.** With only 6–8 GB VRAM, the models spill into normal RAM.
- **About 60 GB free disk** (models are big), ideally on an SSD.
- Internet for the first downloads.

## Step 1 — NVIDIA driver
Update the driver from nvidia.com or the NVIDIA App (Game Ready or Studio, either is fine).
- Check: open PowerShell and run `nvidia-smi`. It shows your card name and memory.

## Step 2 — Git and Node.js
1. Install **Git for Windows** (git-scm.com) with the default options.
2. Install **Node.js 22 LTS** (nodejs.org).
- Check: `git --version` and `node -v` (v22.x).

## Step 3 — Get the app
```powershell
cd D:\
git clone https://github.com/TulaibAhmedSidd/AutomateYT.git
cd AutomateYT
git config user.name "tulaibahmedsidd"
git config user.email "ahsidtullu@gmail.com"
npm install
```
- `npm install` also turns on the git hooks.
- Check: `git config core.hooksPath` prints `.githooks`.

## Step 4 — Settings file
1. Copy `.env.example` to `.env.local` and fill in the values. Never commit this file.
2. For the cartoon work set `CARTOON_ENGINE=comfy` and `COMFY_URL=http://127.0.0.1:8188`.
3. Add your script key (`OPENAI_API_KEY` or `GEMINI_API_KEY`).
4. `MONGODB_URI` is only needed for the old Image Studio. If you use it, add the home PC's IP in MongoDB Atlas → Network Access.

## Step 5 — Start the app once
```powershell
npm run dev -- -p 3300
```
1. Open http://localhost:3300/motion and render the "Why most Shorts fail" template.
2. The first render downloads Remotion's own headless Chrome (about 100 MB), so it is slower.
- Check: the video plays in the Renders list.

## Step 6 — Install ComfyUI
1. Download **ComfyUI Windows Portable (NVIDIA)** from the ComfyUI GitHub releases page (github.com/comfyanonymous/ComfyUI → Releases). It is a `.7z` file.
2. Extract it to `D:\ComfyUI` with 7-Zip.
3. Double-click `run_nvidia_gpu.bat`. A black window opens and the browser opens http://127.0.0.1:8188.
- Check: the ComfyUI canvas loads, and the black window shows your GPU name.
- If you get an out-of-memory error later, edit `run_nvidia_gpu.bat` and add ` --lowvram` at the end of the python line.

## Step 7 — Add the GGUF node
Small-memory GPUs use compressed "GGUF" models.
1. In ComfyUI open **Manager → Custom Nodes Manager**, search **ComfyUI-GGUF** (by city96), install it, then restart ComfyUI.
2. If the Manager button is missing, install "ComfyUI-Manager" first, following its GitHub page.

## Step 8 — Download the models
The easiest way is ComfyUI's own templates. They list the exact files and download links.
1. **Video model.** Workflow → Browse Templates → Video → **"Wan 2.2 5B (text/image to video)"**. ComfyUI shows the missing files with download buttons:
   - the Wan 2.2 TI2V 5B model;
   - `umt5_xxl_fp8_e4m3fn_scaled` (text encoder);
   - `wan2.2_vae` (VAE).
   Download them; each goes into its folder under `D:\ComfyUI\ComfyUI\models\`.
   - If 5B is too slow or runs out of memory on your card, use a **GGUF Q4_K_M** version of Wan 2.2 TI2V 5B (Hugging Face, "QuantStack Wan2.2-TI2V-5B-GGUF") in `models\unet`, and load it with the "Unet Loader (GGUF)" node.
2. **Keyframe model.** Templates → Image → **"Flux.1 Kontext Dev"**. Download its files the same way. On 6–8 GB use a **GGUF Q4** version of FLUX.1 Kontext dev, loaded with the GGUF loader.
- Check: run each template once by hand. The video template should make a 5-second clip. **Write down how many minutes it took**; we use that to plan episode length.

## Step 9 — Save the workflows for the app
Follow the `comfy-workflow` skill:
1. Open the working template.
2. Use **Workflow → Export (API)** and save into `D:\AutomateYT\comfy\workflows\` as `clip.api.json` and `keyframe.api.json`.
3. Replace the prompt, image, seed and size with `{{TOKENS}}`.

## Step 10 — Connect the app
1. With ComfyUI running, run `npm run comfy:check` in the app folder. It prints your GPU, its free VRAM, and which model files ComfyUI can see. This command comes in Phase 2 of the cartoon plan.
2. Open http://localhost:3300/cartoon, pick a series, write an episode and render it.

## Step 11 — Use Antigravity here
1. Open the `D:\AutomateYT` folder in Antigravity.
2. Your first message: *"Read AGENTS.md, docs/ai/home-pc-setup.md and the newest progress folder. Then continue the cartoon plan from where it stopped."*
3. Antigravity reads `AGENTS.md`. The rules in `.agents/rules/` and skills in `.agents/skills/` are listed there.

## Speed tips for 6–8 GB
- Render clips at **480×832 or 704×1280** and let the app scale them to 1080×1920.
- Close games and browsers with many tabs while rendering. Leave the PC on overnight for a batch.
- Don't run ComfyUI and a local voice-clone model at the same time.

## Step 12 — One-click videos (auto-start ComfyUI)
1. In `.env.local` set `COMFY_URL`. ComfyUI **Desktop** listens on `http://127.0.0.1:8000`; the portable version on `http://127.0.0.1:8188`.
2. Set `COMFY_START` to the full path of the ComfyUI launcher (.exe or .bat). When you press **Make the video** in a moving mode, the app starts ComfyUI by itself if it is not running.
3. Run `npm run comfy:check`. It should show your GPU, `clip.api.json` ✅, and every model file ✅.
4. If the worker fails with an error about a `.ts` file, add `NODE_OPTIONS="--experimental-strip-types"` to `.env.local` (Node 22 before 22.18 needs it; Node 24 does not).
5. Wan2GP is not needed by the app. Keep it only for testing by hand, or delete it to free disk space.
