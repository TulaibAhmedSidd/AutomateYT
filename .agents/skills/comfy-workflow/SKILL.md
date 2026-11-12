---
name: comfy-workflow
description: Use on the home GPU PC when adding or changing a ComfyUI workflow that AutomateYT calls (cartoon keyframe or clip), or when a ComfyUI render fails because of a node, model or memory problem.
---

# Add or change a ComfyUI workflow

The app never builds ComfyUI graphs in code. It loads an **API-format** workflow JSON from `comfy/workflows/`, replaces tokens, and posts it to `COMFY_URL/prompt`.

## Steps
1. **Make it work by hand first** in the ComfyUI page (http://127.0.0.1:8188). Use a template (Workflow → Browse Templates) and swap in GGUF loaders if VRAM is short. Note the time per run and the peak VRAM (`nvidia-smi`).
2. **Export:** Workflow → **Export (API)**. Save as `comfy/workflows/<name>.api.json`. The names the worker expects are `keyframe.api.json` and `clip.api.json`.
3. **Put tokens in**: replace the literal values in the JSON with these strings (keep the quotes):

   | Token | Meaning |
   |---|---|
   | `{{PROMPT}}` | positive prompt text |
   | `{{NEGATIVE}}` | negative prompt text |
   | `{{IMAGE}}` | uploaded image filename (LoadImage node `image`) |
   | `{{SEED}}` | seed (the worker writes a number, not a string) |
   | `{{WIDTH}}`, `{{HEIGHT}}` | size (numbers) |
   | `{{FRAMES}}` | frame count for video (number, e.g. 121 = 5 s at 24 fps) |
   | `{{PREFIX}}` | output filename prefix (SaveImage / SaveVideo node) |

4. **Describe it** in `comfy/workflows/README.md`:
   - the model files used (exact names and folders);
   - the custom nodes needed;
   - the recommended size and frames for 6–8 GB;
   - the measured time per run.
5. **Test through the app:**
   - run `npm run comfy:check`. It lists the GPU, the models, and whether every file a workflow needs is present;
   - then render one shot from `/cartoon` with `CARTOON_ENGINE=comfy`.
6. **Commit** the JSON and README only. Never commit model files or outputs.

## When it fails
- **"Out of memory":**
  - Lower the size to 480×832 first, then lower the frames.
  - Use a smaller GGUF (Q4 → Q3).
  - Start ComfyUI with `--lowvram`.
- **"Node not found":** install the custom node with Manager and restart ComfyUI, then list it in the README.
- **"Value not in list" for a model name:** the file is missing or in the wrong `models/` subfolder.
- Check the ComfyUI black window for the real error. The worker copies it into `log.txt`.
