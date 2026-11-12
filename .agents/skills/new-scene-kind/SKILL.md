---
name: new-scene-kind
description: Use when adding a new Motion Graphics scene template (e.g. map, timeline, chart, icon grid) to AutomateYT's Motion Studio.
---

# Add a Motion Graphics scene kind

A scene kind touches four places. Change them together.

1. **`lib/motion/spec.ts`**
   - Add the id to `SceneKind`.
   - Add `{ id, label, hint }` to `SCENE_KINDS`. The hint says when to use it, in one line.
   - If it needs new data, add an optional field to `MotionScene`, then clamp it in `sanitizeSpec` (length, count).
2. **`remotion/MotionShort.tsx`**
   - Write `function <Kind>Scene({ scene, ctx, frames })`. It is a pure function of `useCurrentFrame()`.
   - Something must move in the first 10 frames, and the main element must land by about frame 20.
   - Use `ctx.theme` colours and `ctx` fonts. Support Urdu with `ctx.urdu` (RTL, Nastaliq, bigger line height).
   - No `filter: blur`.
   - Add it to the `SceneBody` switch.
3. **`app/motion/page.tsx`:** show the right inputs for the kind in the scene editor (heading, value, items…).
4. **`app/api/motion/script/route.ts`:** describe the kind in the system prompt. Say when to use it and what fields it fills, and keep the hard rules (no invented numbers, no quotes).
5. **Presets:** put the new kind in at least one preset in `PRESETS` so it can be seen right away.
6. **Check:**
   - `npm run check`;
   - render the preset and run the `verify-render` skill;
   - check the editor at 390 px and 1280 px.
7. **Docs:** add the kind to `docs/ai/video-pipelines.md` §1 and the setup list in `lib/video-formats.ts`.
