---
name: home-pc-setup
description: Use when setting up, checking or repairing AutomateYT on the owner's home GPU PC (Node, git identity, hooks, .env.local, ComfyUI, models), or when the owner says "I'm on my home PC".
---

# Home PC setup and health check

Full baby-step guide: `docs/ai/home-pc-setup.md`. Walk the owner through it **one step at a time**, and confirm each check before the next step. Ask before installing anything.

## Quick health check (run these, report the results plainly)
1. `nvidia-smi`: GPU name and memory. If it is missing, the driver needs installing (the owner does this).
2. `node -v` (v22 expected) and `git --version`.
3. In the repo:
   - `git config user.email` must print `ahsidtullu@gmail.com`;
   - `git config core.hooksPath` must print `.githooks` (fix: `npm run hooks:install`);
   - run `git status`, then `git pull`.
4. `.env.local` exists. List the key **names** that are set (never values). For cartoon work it needs `CARTOON_ENGINE=comfy` and `COMFY_URL`.
5. ComfyUI is reachable: `curl http://127.0.0.1:8188/system_stats`, or `npm run comfy:check` once it exists.
6. Free disk on the models drive is above 20 GB.

## Rules
- Don't download models or install software without the owner's OK. Say the size first.
- Never put model files inside the repo.
- If VRAM is the problem, follow `comfy-workflow` → "When it fails".
