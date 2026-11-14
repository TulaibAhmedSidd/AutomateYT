# Next — 2026-11-14

## 15:50 PKT
1. `Cartoon P2 — office PC` (Claude):
   - Read `docs/ai/note-for-claude.md`.
   - Implement `scripts/lib/comfy.mjs` (HTTP client for ComfyUI API on port 8188).
   - Connect ComfyUI rendering into `scripts/render-cartoon.mjs` when `CARTOON_ENGINE=comfy`.
   - Add `npm run comfy:check` to `package.json`.
2. `Cartoon P2 — home PC` (Antigravity):
   - Set up FLUX.1 Kontext dev (GGUF Q4) for keyframe generation as described in `docs/ai/home-pc-setup.md` step 8.2, and export `comfy/workflows/keyframe.api.json`.
3. `Content Library — office PC`:
   - Owner decides OpenAI billing account (Volt On Solar vs personal), then generate remaining 135 scripts via `/cartoon/<series>` or `scripts/write-library.mjs`.
4. `YouTube Upload`:
   - Refresh OAuth credentials and enable uploads for Motion and Cartoon videos.
