---
trigger: glob
globs: remotion/**, lib/motion/**, app/motion/**, app/api/motion/**, scripts/render-motion.mjs, components/motion/**
description: Rules for the Motion Graphics engine (Remotion compositions, spec, render worker).
---

# Motion Graphics rules

Read `docs/ai/video-pipelines.md` §1 first.

- `lib/motion/spec.ts` is shared by the browser, Remotion and the worker. Keep it free of Node and Next imports.
- Compositions are pure functions of `useCurrentFrame()` and props. Use `random(seed)`, never `Math.random()`, timers or fetch.
- No CSS `filter: blur` or huge shadows: they make renders very slow. Use gradients, transforms and opacity.
- Scene timing comes from `sceneFrames()`. Compute start frames up front; never mutate a counter while mapping JSX.
- Bundle `outDir` must be in the OS temp folder, never inside the job folder (it copies itself forever).
- Urdu: Noto Nastaliq Urdu, RTL, Urdu script only. The AI writer must keep the hard rules: no invented numbers, no quotes, the voice matches the screen.
- All `remotion` and `@remotion/*` packages stay on the same exact version (4.0.543).
- A new scene kind follows the `new-scene-kind` skill. Any visual change is checked with `verify-render`.
