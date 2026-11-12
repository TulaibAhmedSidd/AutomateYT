<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AutomateYT — rules for AI agents

These rules apply to **every** AI tool (Claude Code, Google Antigravity, Codex, Cursor…). This file is the single source of truth; `CLAUDE.md` only imports it. Detailed guides live in `docs/ai/`. Read the guide for the area you touch **before** you edit.

## 1. What this project is
AutomateYT ("AutoVid Studio") is a local web app that makes faceless YouTube Shorts and later posts them. The owner is one person who builds with Claude Code at the office and Google Antigravity at home.
- **Video formats** (`lib/video-formats.ts`):
  - Motion Graphics (live, `/motion`)
  - Image + Voiceover (live, `/studio`)
  - Animated 3D Cartoon (Phase 1 live with pictures at `/cartoon`; animated clips need the home GPU, Phase 2)
  - AI Cinematic (paid, not built)
- **Two computers:**
  - Office PC has Intel graphics only. It runs everything except AI video.
  - Home PC has an NVIDIA GPU with 6–8 GB VRAM. It runs ComfyUI for the cartoon clips. Setup: `docs/ai/home-pc-setup.md`.
- **Design specs:** `docs/superpowers/specs/`. **Plans:** `docs/superpowers/plans/`. **Progress:** newest folder in `progress/`.

- **Cartoon content library:** 10 series in `content/cartoon/series/*.json` (bible + 15 episode ideas + `moreIdeas`), written scripts in `content/cartoon/episodes/<series>/<NN>.json`. Scripts are written only when the owner asks (they cost OpenAI credit on the Volt On Solar account, about 1.7 cents each with gpt-6.1-sol).

## 2. Read before you edit
| You are touching | Read first |
|---|---|
| Any Next.js API (routes, pages, layouts, params, caching) | `node_modules/next/dist/docs/` (version-matched) |
| Folders, data flow, API routes, storage, Mongo models | `docs/ai/architecture.md` |
| How a video is made (motion, slideshow, cartoon), Remotion, voices, FFmpeg | `docs/ai/video-pipelines.md` |
| OpenAI, Gemini, ElevenLabs, Leonardo, Edge TTS, YouTube, ComfyUI, Instagram/Facebook/X | `docs/ai/integrations.md` |
| Pages, components, Tailwind, colours | `docs/ai/ui.md` |
| Code style, errors, performance | `docs/ai/coding-standards.md` |
| How to work, test, commit, log progress, git identity | `docs/ai/workflow.md` |
| The GPU PC, ComfyUI, models | `docs/ai/home-pc-setup.md` |

## 3. Session start and end
- **Start:** read this file, then the newest `progress/<date>/next.md` and `remaining.md`. Run `git pull` first if you are on the other computer.
- **End:** run the `daily-progress` skill. It writes `progress/<today>/` (Pakistan date) and commits it.

## 4. Stack
- Next.js 16.2 (App Router, Turbopack, `@/*` = repo root), React 19.2, TypeScript strict, Tailwind v4.
- MongoDB + Mongoose 9 (only for the Image Studio's videos and settings).
- Remotion 4.0.543 (**pinned exact**, every `remotion`/`@remotion/*` package on the same version).
- msedge-tts 2.1.1 (free voice), FFmpeg via `ffmpeg-static`, googleapis (YouTube).
- `params`/`searchParams` are Promises: await them. `next lint` is gone: use `npm run lint`.

## 5. Money and free-tier rules
- **Free first.** Default to free tools: Edge voices, Remotion, local ComfyUI. Paid APIs (ElevenLabs, Leonardo, OpenAI image or video, X API) only when the owner says so.
- **Never trigger paid generation or uploads without asking.** This covers AI images, ElevenLabs voice, posting to YouTube/Instagram/Facebook/X, and deleting records in the remote database. Script writing with GPT-4o-mini/Gemini Flash (under 1 cent) is fine while testing.
- **No new npm dependency, paid service or software install without asking.** Declare missing types in `types/untyped-modules.d.ts` rather than adding `@types/*` silently.

## 6. Architecture rules
- **Renders never run inside a request.** Long work (voice, render, ComfyUI) runs in a detached Node script under `scripts/`. It writes `status.json` in its job folder, and the UI polls it. Pattern: `lib/motion/jobs.ts` + `scripts/render-motion.mjs`.
- **Job folders** live in `storage/<format>/<jobId>/` (gitignored). They hold `spec.json` (input), `status.json`, `spec.final.json` (with real timings), `assets/`, `video.mp4` and `log.txt`. A job must be **resumable**: skip finished steps whose files exist.
- **One JSON spec drives both the live preview** (`@remotion/player`) **and the final render.** Spec types and pure helpers live in `lib/<format>/spec.ts`, with no Node or Next imports, because they are bundled into the browser and Remotion.
- **Sanitize everything that comes from the browser or an AI model** before it reaches a renderer (`sanitizeSpec`). Clamp lengths and counts.
- **Path safety:** job ids match `^[\w-]{3,64}$`. Serve job files only through a resolver that refuses paths outside the job folder (`jobFile`).
- **Vercel cannot render.** Render routes return a clear error when `process.env.VERCEL` is set. `IS_VERCEL` means `VERCEL === '1'` only, never `NODE_ENV`.
- **API keys:** read Mongo `Settings.apiKeys.*` first, then fall back to `process.env.*`. Never send a key to the browser.
- **The AI model is an untrusted writer.** Ask for strict JSON, validate it, and retry once with the error. Hard rules from the prompts are listed in `docs/ai/video-pipelines.md`:
  - no invented numbers or quotes;
  - the voice reads what is on screen;
  - Urdu output must be in Urdu script.

## 7. Video content rules
- **Vertical 1080×1920, 30 fps** for Shorts. The hook comes in the first 2 seconds, something changes on screen every 1–3 seconds, and the CTA comes last.
- **Captions** are karaoke-style from real word timings (Edge `WordBoundary`). If there are no timings, spread them evenly.
- **Urdu** content is in Urdu (Nastaliq) script, right-to-left, font Noto Nastaliq Urdu. Titles may be Roman Urdu.
- **No mass-produced, repetitive videos:** YouTube demonetizes them. Vary scene kinds and stories, and never swap words in a template.
- **Cartoon series rules:**
  - Kids series: no scary or violent shots, and set the "made for kids" flag on purpose.
  - Islamic series: **never show the face or body of a prophet, a companion or a holy figure**. Use narration over places, objects and light, and stay accurate and respectful.

## 8. Coding standard
Full guide: `docs/ai/coding-standards.md`. Always-on rule: `.agents/rules/coding-standards.md`.
- TypeScript strict: no `any`, no `@ts-ignore`. Use `catch (error: unknown)` with `error instanceof Error ? error.message : String(error)`.
- React 19 lint rules are on. Never call `setState` synchronously inside `useEffect`; call it from callbacks (fetch `.then`, timers, events). Never reassign variables during render.
- Match each file's style and line endings: older files are CRLF with semicolons, new files LF with semicolons. Don't reformat lines you didn't change.
- Every export gets one plain-English comment line (what + why). No commented-out code.
- Users see plain-English errors, and logs never contain API keys or tokens.

## 9. Testing and "done"
- `npm run check` = lint + typecheck + AI-setup check. It must pass before you say a phase is done.
- **A video change is done only when a real render was checked frame by frame** (skill `verify-render`): the voice in sync, the captions correct, nothing cut off, and Urdu in Urdu script.
- UI changes: open the page in a browser and check it at 390 px and 1280 px.

## 10. Git and commits
- **Conventional commits:** `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`, `perf:`. Scope is optional, e.g. `feat(cartoon): …`. The `commit-msg` hook enforces it.
- **Author must be `tulaibahmedsidd <ahsidtullu@gmail.com>`** (repo-local git config). The `pre-commit` hook refuses any other email.
- Hooks live in `.githooks/` and are installed by `npm install` (`prepare` script). **Never use `--no-verify`.**
- Commit or push only when the owner asks. Branch `main`, remote `https://github.com/TulaibAhmedSidd/AutomateYT.git`.

## 11. Skills (in `.agents/skills/`, copied to `.claude/skills/` by `npm run ai:sync`)
| Skill | Use it when |
|---|---|
| `daily-progress` | at the end of every session |
| `verify-render` | after any change to how a video looks or sounds |
| `new-scene-kind` | adding a Motion Graphics scene template |
| `comfy-workflow` | adding or changing a ComfyUI workflow on the home PC |
| `home-pc-setup` | setting up or repairing the GPU PC |

## 12. Never
- Hindi or Devanagari script, anywhere: replies, code comments, video text. Reply to the owner in simple English; short Roman Urdu phrases are fine.
- Print `.env*` values or keys. Show key **names** and whether they are set, only.
- Commit `.env*`, `storage/`, rendered media, model files (`*.safetensors`, `*.gguf`) or tokens.
- Edit `.claude/skills/**` directly. Edit `.agents/skills/**`, then run `npm run ai:sync`.
- Run renders, ComfyUI or long jobs inside an API request.
- Upgrade one Remotion package alone, or run `npm audit fix --force`.
- `--no-verify`, force-push to `main`, or rewriting published history.
