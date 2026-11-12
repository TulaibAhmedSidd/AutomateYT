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
