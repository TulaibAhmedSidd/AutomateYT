# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` — Next.js dev server on port 3000
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint (flat config, `eslint-config-next`)
- `node worker.js <config.json>` — standalone CLI renderer (see "worker.js" below). There is **no** `npm run worker` / `npm run scheduler` script despite what `README.md` claims.

No test runner is configured.

Path alias: `@/*` → repo root (see `tsconfig.json`).

## High-level architecture

This is a Next.js 16 (App Router) + React 19 + Tailwind v4 app that orchestrates an AI video pipeline:
**topic → script → per-scene image + voice → FFmpeg render → thumbnail → YouTube upload**.

### Runtime topology

- **Web / API**: Next.js App Router under `app/`. UI lives in `app/dashboard`, `app/studio`, `app/videos/[id]`, `app/scheduler`, `app/settings`. API routes under `app/api/*` (`generate-script`, `generate-scene-{script,image,voice}`, `upload-scene-{image,audio}`, `generate-video`, `bulk-generate`, `upload-youtube`, `videos`, `jobs`, `voices`, `schedule`, `settings`, `media/[id]`).
- **"Queue"**: `lib/queue.ts` exports `addVideoJob` / `addUploadJob`, which are **in-process fire-and-forget `async` calls** — not BullMQ. The `bullmq`/`ioredis` deps exist but nothing currently brokers jobs through Redis. Treat these as background tasks that run inside the Next.js server process.
- **`worker.js`**: a standalone Node CLI (`require('fluent-ffmpeg')`, no TS, no Next imports). It owns its own ffmpeg pipeline including OpenAI Whisper word-level transcription → ASS subtitle generation with per-word animations. It is **separate from `lib/ffmpeg.ts`** and is invoked manually with a JSON config file. Don't assume changes in `lib/ffmpeg.ts` propagate here, or vice versa.

### Vercel-aware filesystem

Several modules branch on `process.env.VERCEL === '1' || NODE_ENV === 'production'`:
- Locally, generated media lives under `public/{audio,images,videos}` and is served by Next's static handler.
- On Vercel, the workspace root is `/tmp` (read-only deployment FS), so files are written under `/tmp/public/...`. Anything that needs to be durable in that mode must go through GridFS (`lib/storage.ts`).

This switch is repeated in `lib/generator.ts`, `lib/queue.ts`, and `lib/video-runtime.ts`. Keep them in sync.

### Storage modes

`Settings.storage.mode` is either `'local'` or `'cloud'`. Cloud mode uploads each rendered asset to MongoDB GridFS (`bucketName: videoauto_media`) via `lib/storage.ts` and stores refs on `Video.mediaRefs.{audio,video,thumbnail,images[]}`. Stored assets are served back through `app/api/media/[id]/route.ts` — references look like `/api/media/<fileId>`, not filesystem paths. `lib/video-runtime.ts` (`hydrateVideoRuntime`) resolves a `Video` document into runtime paths, choosing between disk and GridFS.

### Data model

- `Video` (`models/Video.ts`) — owns the whole project: `script`, `projectManifest` (rich scene/overlay/asset state from `lib/video-project.ts`), `modelSelections`, `mediaRefs`, plus per-step status (`scriptStatus`, `voiceStatus`, `imageStatus`, `videoRenderStatus`) and overall `status` / `uploadStatus`. Failed steps record `failedStep` / `failedTool` / `errorSummary` / `errorDetails` for UI display.
- `Settings` (`models/Settings.ts`) — single-document config: API keys (OpenAI/Gemini/ElevenLabs/Leonardo/YouTube), `generationDefaults`, `voiceover.selectedVoiceId`, `storage.mode`, `scheduleTimes[]`, `uploadEnabled`. The UI Settings page is the primary way users supply keys; env vars are the fallback.
- `Job` (`models/Job.ts`) — legacy job log shape.
- Mongoose connection is cached on `globalThis.mongoose` to survive HMR (`lib/mongodb.ts`).

### Model abstraction

`lib/generation-config.ts` is the canonical place for model identifiers. `StepModelSelections` has four slots (`script`, `voice`, `image`, `video`) each backed by an options list (OpenAI/Gemini, ElevenLabs variants, Leonardo SDXL/Kino/Vision, FFmpeg vertical/landscape). `getImageModelConfig` / `getVideoRenderConfig` translate selections into concrete Leonardo model IDs and FFmpeg output dimensions. Adding a new model means updating the options list **and** the corresponding config map.

### Generation flow entry point

`lib/generator.ts → executeVideoGeneration(videoId, content?, promptType?, aiModel?, options?)` is the orchestrator called by `addVideoJob`. It loads `Video` + `Settings`, normalizes model selections (per-video overrides defaults), then walks: `generateTopicAndScript` (`lib/ai.ts`) → per-scene `generateImage` + `generateVoiceover` → `concatenateAudioTracks` → `renderVideo` → `generateThumbnail` (`lib/ffmpeg.ts`), persisting status transitions and (in cloud mode) GridFS uploads after each step.

### YouTube upload

`lib/youtube.ts` uses `googleapis` with OAuth2 refresh-token flow. Uploads default to `privacyStatus: 'private'` and category `27` (Education). Credentials come from `Settings.apiKeys.youtube*` first, then env (`YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN`).

## Environment

Minimum: `MONGODB_URI` (no fallback — `lib/mongodb.ts` throws on boot). `REDIS_URL` is documented but unused by the current queue implementation. All AI/YouTube keys are optional at boot since they can be supplied via the Settings UI; they're only required when the corresponding step runs.

## Conventions

- Server-side code reads from `Settings` first and falls back to env. New integrations should follow that pattern so the Settings UI keeps working as the source of truth.
- When touching the generation pipeline, update both the on-disk path (local mode) and the GridFS ref (cloud mode) — `mediaRefs` and the `videoPath` / `thumbnail` string fields are both consumed downstream.
- Status enums on `Video` are load-bearing for the dashboard UI; don't introduce new values without updating the schema enum.
