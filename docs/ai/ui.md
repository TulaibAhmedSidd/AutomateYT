# UI guide

## Look
- Dark app.
- Colours live as CSS variables in `app/globals.css`: `--bg`, `--panel`, `--panel-2`, `--line`, `--accent` (#ff6b4a), `--accent-soft`, `--text`, `--muted`. Use them through `bg-[var(--panel)]`, `text-[var(--muted)]` and so on.
- Older pages use Tailwind slate and white/opacity classes. That is fine; match the page you are on.
- Fonts: `font-sans` (Inter) for body text, `font-display` (Space Grotesk) for headings.
- Icons come only from `lucide-react`.

## Building blocks (reuse before you build)
- `components/format-ui.tsx`: `PageHeader` (eyebrow, title, description, actions), `FormatCard`, `StatusPill`, `Meter`, `ACCENT` colour sets, `FORMAT_ICONS`.
- `components/Sidebar.tsx`: add new pages to `NAV` (groups Plan / Produce / System).
- `components/motion/PlayerPanel.tsx`: the Remotion `Player`. Load it with `next/dynamic` and `ssr: false`.

## Page pattern (copy `app/motion/page.tsx`)
1. `PageHeader` at the top.
2. Left column: editor cards (`rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5`). Right column: a sticky preview (`xl:grid-cols-[minmax(0,1fr)_380px]`).
3. Control rows use `flex flex-wrap`, so buttons never hide behind the preview on narrower screens.
4. Lists of renders poll every 2 s **only while something is running**, using a timer callback, not synchronous `setState` in an effect.
5. Every button that waits shows a spinner and is disabled while busy. Errors appear in a plain-English red box.

## Rules
- Mobile-first: check 390 px and 1280 px. Touch targets are at least 40 px. No horizontal scroll.
- Urdu text inputs get `dir="auto"`.
- Long work never blocks the page. Show the stage and percent from `status.json`.
- Client components only where you need state or browser APIs. Pages may be client components when they are mostly interactive editors (like `/motion`).
