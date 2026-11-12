# Architecture

AutomateYT is one Next.js app in the repo root. Next.js serves the dashboard and the API routes. Heavy work runs in separate Node processes that the API routes start.

## Folders
| Folder | What lives there |
|---|---|
| `app/` | Pages and API routes (App Router). |
| `app/api/` | Route handlers. Motion routes are under `app/api/motion/`; the old Image Studio routes are at the top level. |
| `components/` | Shared UI: `Sidebar.tsx`, `format-ui.tsx` (cards, pills, page header), and `motion/PlayerPanel.tsx`. |
| `lib/` | Server helpers and shared data. `lib/motion/` holds the Motion Graphics spec and jobs. `lib/video-formats.ts` holds the strategy cards. |
| `models/` | Mongoose models: `Video`, `Job`, `Settings`. |
| `remotion/` | Remotion compositions: `Root.tsx` registers them, `MotionShort.tsx` is the Motion video. |
| `scripts/` | Detached workers (`render-motion.mjs`) and repo tools (AI sync and check, hooks). |
| `worker.js` | Old FFmpeg renderer for the Image Studio (Ken Burns, captions). |
| `storage/` | **Gitignored.** Render jobs: `storage/motion/<id>/` (and `storage/cartoon/…` later). |
| `public/audio,images,videos/` | **Gitignored** output of the Image Studio. |
| `types/` | `.d.ts` shims for packages without types. |
| `docs/ai/` | These guides. `docs/superpowers/specs|plans/` hold designs and plans. |
| `.agents/` | Shared AI rules and skills (canonical). `.claude/skills/` is a generated copy. |
| `.githooks/` | Git hooks (pre-commit, commit-msg). |
| `progress/` | Daily progress logs. |

## Pages
| Route | Purpose |
|---|---|
| `/dashboard` | Overview: format cards, recommended order, setup checklist. |
| `/formats`, `/formats/[id]` | Strategy card per video format (data in `lib/video-formats.ts`). |
| `/research` | Reel research notes (`lib/research.ts`). |
| `/motion` | **Motion Studio**: templates, AI scene writer, editor, live preview, render, renders list. |
| `/studio` (and `?tab=library`) | Image Studio: create image-slideshow videos, library. |
| `/videos/[id]` | One Image Studio video: steps, retry, YouTube upload button. |
| `/queue` | Old job table (polls `/api/jobs`). |
| `/scheduler` | Saves upload times and an on/off switch. **Nothing acts on them yet.** |
| `/settings` | API keys, default models, voice (stored in Mongo `Settings`). |

## API routes
- **Motion (file based, no DB):**
  - `GET/POST /api/motion/jobs`: list jobs, or create a render job from a spec.
  - `GET/DELETE /api/motion/jobs/[id]`: status + spec, or delete.
  - `GET /api/motion/files/[id]/[...path]`: stream `video.mp4` or `assets/*.mp3`, with Range support and `?download=1`.
  - `POST /api/motion/script`: AI scene writer.
  - `GET /api/motion/voice-sample`: MP3 sample of a voice.
- **Image Studio (Mongo):** `generate-script`, `generate-video`, `bulk-generate`, `videos`, `videos/[id]`, `videos/[id]/retry`, `videos/delete-all`, `upload-scene-image`, `media/[id]` (GridFS), `upload-youtube`, `jobs`, `schedule`, `settings`, `voices`.
- `GET /api/health`: database reachability (shown in the sidebar).

## Data flow: render jobs (the pattern to copy)
1. The browser `POST`s a spec. The route runs `sanitizeSpec`, then `createJob`. That writes `spec.json` + `status.json` and spawns `node scripts/render-<format>.mjs <id>` as a **detached**, hidden process with logs going to `log.txt`.
2. The worker updates `status.json`: `stage` (`queued → … → done|failed`), `progress` 0–1, `pid`, `error`.
3. The UI polls `GET /api/<format>/jobs` every 2 s while any job is running. `readStatus` reports a job as failed if its `pid` died without saying "done".
4. Files are served through `jobFile(id, parts)`, which rejects any path outside the job folder.

## Data flow: Image Studio (older code)
`/api/generate-video` → `addVideoJob` → `executeVideoGeneration` (`lib/generator.ts`). Steps:
1. script (`lib/ai.ts`)
2. ElevenLabs voice
3. Leonardo images (first 3 by AI, the rest uploaded)
4. `worker.js` FFmpeg render + Whisper captions
5. thumbnail

Each step's status is saved on the `Video` document. Known gap: this runs fire-and-forget inside the request, so it would die on Vercel. New formats must use the job pattern instead.

## Storage modes
- Motion and cartoon jobs always live on the local disk in `storage/`.
- Image Studio has `local` (files in `public/`) and `cloud` (MongoDB GridFS via `lib/storage.ts`, served by `/api/media/[id]`).

## Environments
- **Office PC:** `npm run dev` on port 3300. Claude Code's preview launcher sits outside the repo.
- **Home PC:** the same repo plus ComfyUI on `http://127.0.0.1:8188` (see `home-pc-setup.md`).
- **Vercel:** dashboard only. Render routes refuse with a clear message.
