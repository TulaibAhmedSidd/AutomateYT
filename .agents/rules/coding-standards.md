---
trigger: always_on
description: AutomateYT coding standard — apply to every code change.
---

# Coding standard (always)

Full guide: `docs/ai/coding-standards.md`. Project rules: `AGENTS.md`.

- TypeScript strict: no `any`, no `@ts-ignore`. Use `catch (error: unknown)` and `error instanceof Error ? error.message : String(error)`.
- React 19: no synchronous `setState` inside `useEffect` (use `.then`, timers, events), and no reassigning variables during render.
- Long work (voice, render, ComfyUI) runs in a detached `scripts/*.mjs` worker that writes `storage/<format>/<id>/status.json`. Never inside an API request.
- Specs and pure helpers in `lib/<format>/spec.ts`, with no Node or Next imports. Sanitize input from the browser or AI before rendering.
- Job ids match `^[\w-]{3,64}$`; serve files through a resolver that blocks `..`.
- Keep each file's style and line endings. One plain-English comment line per export.
- Done = `npm run check` passes, and video changes are checked with the `verify-render` skill.
