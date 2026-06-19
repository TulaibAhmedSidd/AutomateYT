# Claude Progress

Snapshot of where the AutoVid project stands at the end of this session, what just changed, and what's still open before deployment.

## Second pass — fixes after first render attempt

User reported three more issues after the first round of changes:

- **Video was 15s when the audio was 45s.** `worker.js` was calling `fluent-ffmpeg`'s `ffprobe()` to measure the voiceover length, but the `ffmpeg-static` package doesn't ship an `ffprobe` binary, so it silently returned 0. The fallback chain ended up summing the manifest's 5s scene defaults (3 scenes × 5s = 15s), and `-shortest` then trimmed the output to 15s. Replaced `probeAudioDuration` with a direct `child_process.spawn(ffmpegStatic, ['-i', file])` that parses the `Duration: HH:MM:SS.SS` line out of stderr. Now the renderer knows the real audio length.
- **Images didn't change per scene.** Even with the right total length, every image showed for the same uniform slice. Refactored `buildVideoFilters`, `buildSceneTimings`, and `renderWithFfmpeg` in `worker.js` to accept a `perSceneDurations: number[]` instead of a single `sceneDuration`. The generator (`lib/generator.ts`) now probes each per-segment audio file (`audio/<id>_segments/<i>.mp3`) and passes the real per-scene durations to the worker, so image N stays on screen for exactly the length of scene N's narration. Crossfade overlap padding is split across adjacent scenes so the total visual length still equals the total audio length.
- **Caption was a tiny subtitle bar instead of the studio overlay.** The user's `fontSize: 34` was being interpreted as 34 raw pixels in a 1080×1920 frame (1.8% of height, basically invisible). It looks big in the studio because the preview canvas is only 600-900px tall. Two-sided fix:
  - `worker.js` now scales overlay fontSize and box padding by `videoHeight / 720` — so `fontSize: 34` becomes 91px (~4.7% of height) in a 1920-tall video, and box padding scales the same way.
  - `app/videos/[id]/page.tsx` preview now uses CSS container queries (`cqh`) so the studio overlay renders at the same *proportion of canvas height* the renderer will use, giving a faithful WYSIWYG preview.
- **Render button gave no feedback.** Studio editor didn't poll — clicking Render PATCH'd the server and then sat silently, with the Download button still saying "render first" even while the render was running. Added:
  - A `useEffect` polling loop that refetches the video doc every 3s while `video.status === 'generating'`.
  - The status bar at the top of the editor is now a live cyan banner during generation that names the current step (`writing script`, `generating narration audio`, `generating scene images`, `stitching the final video with ffmpeg`) instead of just printing the saveMessage.
  - The Render button switches to "Rendering…" with a spinner whenever `status === 'generating'` (not just during the user's click), so a reload mid-render still shows the right state.
  - The Download button shows "Building MP4…" with a spinner during render, instead of "Download (render first)" which read as an error.
  - Per-step status pills (`Script: done`, `Voice: pending`, `Images: failed`, etc.) get tone-coded — green for done, rose for failed, slate for pending.

## Done in this session

- **Studio download button is now persistent.**
  - Added a `Download Video` action to the top action bar in `app/videos/[id]/page.tsx` (between `Generate With AI` and `Reset Unsaved`). It uses an amber highlight so it's hard to miss, and shows a disabled "Download (render first)" state when no MP4 exists yet.
  - The sidebar copy of the download link was upgraded with the same URL helper and an explicit empty-state message.
  - New helper `buildDownloadUrl(videoPath, fallbackName)` in `app/videos/[id]/page.tsx` rewrites `/api/media/<id>` cloud URLs to `?download=1&filename=...` so the browser actually saves the file instead of opening it inline.
  - `app/api/media/[id]/route.ts` now honors `?download=1` and `?filename=` and sets `Content-Disposition: attachment` in that case (default stays `inline` so the studio preview still plays the file).

- **Stopped burning auto-generated captions into the video.**
  - The user's `overlayLayers` from `manifest.scriptSegments[].overlayLayers` are now the only on-screen text in the final MP4. `worker.js` no longer runs OpenAI Whisper or writes the per-word ASS subtitle file when overlays are in play, and the hardcoded "Follow for more" `drawtext` overlay is also gone in that path.
  - New `buildOverlayDrawtextFilters()` in `worker.js` converts each layer to an `ffmpeg drawtext` filter using the user's `fontFamily` (auto-resolved against `public/fonts/`), `fontSize`, `color`, `background`, and `x/y` percentages (mapped to pixels off the configured 9:16 / 16:9 frame). `fade-in` and `slide-up` animations are wired through `alpha=`/`y=` expressions; `zoom-in` and `typewriter` degrade to `fade-in` (ffmpeg `drawtext` can't natively express them).
  - Scene timing is built from per-scene `duration` in the manifest (with the existing `transitionDuration` overlap), so an overlay only appears during its scene window.
  - `lib/generator.ts` now passes `overlayScenes` + `sceneDurations` through `lib/ffmpeg.ts:renderVideo()` to `worker.js`, and dropped the `socialOverlayText: 'Follow for more'` option.
  - Audio duration is resolved via `ffmpeg.ffprobe` with fallbacks (sum of scene durations, then `N * 5s`) so the renderer no longer needs an OpenAI key just to render.
  - Legacy Whisper path is still present but is only taken when the caller does **not** pass an `overlayScenes` array — keeps backwards compatibility for any external callers of `createViralVideo`.

- **CLAUDE.md** initialized with an architecture brief covering the Next.js 16 + React 19 stack, Vercel-aware `/tmp` switch, GridFS storage mode, in-process "queue", and the standalone `worker.js` CLI.

## Verified by spot-check

- `node --check worker.js` parses cleanly.
- `npx tsc --noEmit` produces only pre-existing errors (missing `@types/fs-extra`, missing `@types/fluent-ffmpeg`, mongoose-lean narrowing in `app/queue/page.tsx`, zustand `ProjectScriptSegment` widening in `lib/video-project-store.ts`, settings page `[key,label,options]` array destructure typing). None are introduced by this session's edits.

## Punch list from the tab audit

- **Scheduler is UI-only.** `app/scheduler/page.tsx` writes `scheduleTimes` and `uploadEnabled` to the Settings document, but there is no cron worker reading them. README documents `npm run scheduler` but no such script exists in `package.json`. Saved times will never trigger uploads. (See deployment section below.)
- **Queue page will always be empty.** `lib/queue.ts:addVideoJob` / `addUploadJob` are fire-and-forget `async` calls that never write to the `Job` collection. `/queue` queries `Job.find()` and so renders an empty table forever. Either delete the page, retire the `Job` model, or have the queue write progress records.
- **Dashboard empty-state branch** returns the bare string `""` (cosmetic — renders nothing, but cleaner as `null`).
- **`docs/currentAppWorkflow.md`** that the user referenced doesn't exist in the repo. Worth creating one if it's expected to brief future sessions.

## Known limitations of the new caption pipeline

- `ffmpeg drawtext` does not auto-wrap text. Long overlay strings will overflow the right edge of the video. The studio preview has the same limitation visually (capped at `max-width: 84%`), so the two roughly agree, but it's still worth surfacing in the editor when text is too long.
- `zoom-in` and `typewriter` animations from the studio fall back to `fade-in` in the render. If you want them faithful, we'd need to switch from `drawtext` to compositing pre-rendered text bitmaps (Sharp or `canvas`) and use `overlay=` with `scale=`/timing expressions.
- Font resolution searches `public/fonts/` by basename match. If a user types a family name with no matching file, the renderer falls back to `The Bold Font.ttf` (the original default). Worth wiring a small dropdown in the studio overlay panel that only lists fonts actually present on disk.

## Open before deployment

- **Decide on storage mode for production.** Vercel's filesystem is ephemeral; `local` mode writes under `/tmp/public/...` and disappears between invocations. `cloud` (GridFS via `lib/storage.ts`) is the only durable option. Either default storage mode to `cloud` on Vercel automatically (already partially done in `lib/generator.ts`) and make the setting non-toggleable there, or gate the deploy on a real object store (S3 / R2).
- **Decide what to do with the "queue".** `lib/queue.ts` is in-process — on Vercel that means a single serverless invocation. Long video renders **will** be killed by Vercel's function timeout (10s on hobby, 60s pro, up to 15min on enterprise). Options:
  - Run the Next.js server on a long-running host (Fly.io, Railway, a VM) and keep the in-process queue.
  - Stand up a real BullMQ worker on a long-running host; the Vercel API just enqueues.
  - Replace the heavy FFmpeg render path with a managed service (Shotstack, Creatomate, Remotion Lambda).
- **Wire the scheduler.** Decide whether scheduled uploads are part of v1. If yes, need a cron worker (a Vercel Cron job hitting an internal route, or a node-cron process on the long-running host) that loops over scheduled videos and calls `addUploadJob`.
- **Captions toggle in the UI.** With the new behavior, "no overlays = no captions in the final MP4." Surface that explicitly in the studio so users don't get surprised by a clean video when they delete the default overlay.
- **Mobile QA pass.** The dashboard and studio are responsive, but the studio's 5-column action bar will collapse on small screens (`sm:grid-cols-2`). Worth eyeballing on a phone after the Download button addition.
- **Strip dead deps.** `bullmq`, `ioredis`, and `node-cron` are installed but nothing in the current code imports them. Either wire them up or remove them from `package.json` before shipping.
- **TypeScript hygiene.** Add `@types/fs-extra` and `@types/fluent-ffmpeg`, fix the `cached` non-null assertion in `lib/mongodb.ts`, and tighten the `[key, label, options]` destructure in `app/settings/page.tsx`. Currently `npm run build` may still succeed because Next swallows these, but `tsc --noEmit` is noisy.

## Quick deployment checklist (rough)

1. Set `MONGODB_URI`, OpenAI/Gemini/ElevenLabs/Leonardo/YouTube credentials in the host's env.
2. Force `Settings.storage.mode = 'cloud'` for the production environment.
3. Pick a host (recommend Fly.io or a small VM — not Vercel — given the FFmpeg + long-running render needs).
4. If FFmpeg isn't present on the host image, bundle it (`ffmpeg-static` already lands the binary under `node_modules/`).
5. Run a smoke render against the new overlay path: create a project, save with two overlay layers, hit Render, confirm the resulting MP4 has the user's text in the user's font and **no** word-by-word captions.
6. Optionally pre-load a few `.ttf` files into `public/fonts/` so the overlay font picker resolves to something visually distinct.
