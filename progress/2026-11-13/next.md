# Next

## 03:00 PKT
1. **Owner decides:** which OpenAI account pays for scripts. Today's key is Volt On Solar Energy's. Writing the 135 missing scripts costs about $2.30 with GPT-6.1 Sol, or about $0.15 with GPT-4o mini. Options: the "Write script" button per episode, or `node scripts/write-library.mjs`.
2. **Owner, on any PC with Chrome:** open `/cartoon` → Chacha Jee aur Pappu → Episode 1 → record the 9 lines → Render. This is the first real test of mic recording in Chrome.
3. `Cartoon P2 — home PC` (Antigravity):
   - install ComfyUI and the models (`docs/ai/home-pc-setup.md`);
   - measure the minutes per 5 s clip;
   - export the `keyframe` and `clip` workflows (`comfy-workflow` skill).
4. `Cartoon P2 — office/home`:
   - `scripts/lib/comfy.mjs` + `npm run comfy:check`;
   - the worker uses ComfyUI when `CARTOON_ENGINE=comfy`.
5. `YouTube`: publish the OAuth consent screen, make a new refresh token, then add upload for Motion and Cartoon videos.

## 03:45 PKT
1. **Owner:** listen to the 4 ElevenLabs samples and the test video, then pick voices. To use the native Urdu voices (Kamran, Saira…) and post on a monetised channel, upgrade ElevenLabs to a paid plan.
2. **Owner:** decide which OpenAI account pays for scripts (today: Volt On Solar Energy), then write the 135 missing scripts with the Write script buttons.
3. Home PC: ComfyUI Phase 2 (see the Antigravity prompt).


## 21:15 PKT — home PC
1. `Cartoon P2 — home PC`: Wan 2.2 TI2V 5B clip workflow benchmark complete (480×832 chosen).
2. `Cartoon P2 — home PC`: Set up FLUX.1 Kontext dev (GGUF Q4) for keyframe generation (`docs/ai/home-pc-setup.md`), test it, and export `comfy/workflows/keyframe.api.json`.
3. `Cartoon P2 — office PC`: Implement `CARTOON_ENGINE=comfy` in `scripts/render-cartoon.mjs` and `npm run comfy:check`.
