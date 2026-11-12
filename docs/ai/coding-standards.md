# Coding standard

## TypeScript
- Strict mode: no `any`, no `@ts-ignore`, no `as unknown as X` to silence real errors.
- Catch errors as `catch (error: unknown)`, then use `error instanceof Error ? error.message : String(error)`.
- If a package has no types, add one line to `types/untyped-modules.d.ts`. Don't install `@types/*` without asking.
- Shared types for a format live in `lib/<format>/spec.ts`. API routes and workers import them; don't redeclare shapes.

## React 19 / Next 16
- Never call `setState` synchronously inside `useEffect` (the lint rule `react-hooks/set-state-in-effect`). Set state from fetch `.then`, timers, or event handlers.
- Never reassign a variable during render (`react-hooks/immutability`). Compute arrays first (`reduce`), then render.
- `params` and `searchParams` are Promises. Route handlers export `dynamic = 'force-dynamic'` and `runtime = 'nodejs'` when they touch the disk or child processes.
- Remotion components must be pure functions of `useCurrentFrame()` and props. No `Math.random()`: use `random(seed)` from `remotion`. No timers, no fetch inside a composition.

## Workers (`scripts/*.mjs`)
- Plain ESM JavaScript (`.mjs`), with Node built-ins via `node:` imports.
- Take the job id as `argv[2]` and validate it with `^[\w-]+$`.
- Write `status.json` at every stage. On failure set `stage: 'failed'` with a short `error` (≤ 800 characters) and exit with code 1.
- Make steps resumable: if a step's output file exists and is not empty, skip it.
- Retry network steps (voice, ComfyUI) with backoff. Clean up temp folders.

## API routes
- Validate and sanitize the input (clamp lengths, whitelist enums). Return `{ error: 'plain words' }` with a 4xx/5xx status.
- Long work → spawn a worker (`lib/<format>/jobs.ts`). Never `await` a render inside a request.
- Serve files with `Content-Type`, Range support for media, and `Cache-Control: no-store` for status.

## Style
- Two-space indent, single quotes, semicolons. Keep each file's line endings: older files are CRLF, new files LF.
- File names: kebab-case for libs and scripts, PascalCase for components.
- One plain-English comment line on every export: what it does and why. Comment the *why* of tricky code (a bug it avoids, a limit it respects).
- No commented-out code, no `console.log` left in UI code. Workers may log progress to `log.txt`.

## Performance
- Mongo reads: `.lean()`, `.select()`, `.limit()`. No query inside a loop.
- Poll only while something is running (2 s for renders). Stop polling when every job is `done` or `failed`.
- Remotion: avoid `filter: blur` and huge shadows. Prefer gradients, transforms and opacity. Keep assets small.
