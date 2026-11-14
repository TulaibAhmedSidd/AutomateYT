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

## Office PC update
1. **Home PC (Antigravity):** set up the picture step (FLUX.1 Kontext GGUF or SDXL), export `comfy/workflows/keyframe.api.json`, measure minutes per picture. Transition reels and moving clips need it.
2. **Home PC:** set COMFY_URL (Desktop = port 8000) and COMFY_START in .env.local, run `npm run comfy:check`, then make one episode in "Key moments animated" mode.
3. **Owner:** add the redirect URI `http://localhost:3300/api/youtube/callback` to the Google OAuth client and publish the consent screen, then press Connect YouTube on /connections.
4. **Owner:** Instagram needs a Professional account, a Cloudinary account and a Meta app before the Connect button can be built.
