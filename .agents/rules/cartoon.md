---
trigger: glob
globs: lib/cartoon/**, app/cartoon/**, app/api/cartoon/**, scripts/render-cartoon.mjs, scripts/lib/**, comfy/**, remotion/Cartoon*.tsx
description: Rules for the Animated 3D Cartoon pipeline (series bible, episodes, ComfyUI engine, assembly).
---

# Cartoon pipeline rules

Read `docs/superpowers/specs/2026-11-12-cartoon-design.md` and `docs/ai/home-pc-setup.md` first.

- The series bible is the single source for a character's look. Shot prompts reference characters by id, and the code injects the look text and reference image, so the character never drifts.
- One job folder per episode: `storage/cartoon/<id>/`. Every shot step (keyframe, clip, voice) is resumable and can be redone alone.
- Engines: `stills` works on any PC (keyframe plus camera motion); `comfy` needs the home GPU. Code paths must work with both. Pick with `CARTOON_ENGINE`.
- ComfyUI is called only from the worker over HTTP (`COMFY_URL`). Workflows are API-format JSON in `comfy/workflows/` with `{{TOKENS}}` (see the `comfy-workflow` skill).
- 6–8 GB VRAM: clips about 5 s at 480×832 or 704×1280, scaled to 1080×1920 at assembly. Run one GPU job at a time.
- Narration ≤ 12 words per shot (about 5 s). If the voice is longer than the clip, slow the clip to at least 0.75× speed, then hold the last frame.
- Kids series: nothing scary or violent. Islamic series: never show prophets, companions or holy figures; use places, objects, light and narration.
