---
trigger: glob
globs: app/**/page.tsx, app/**/layout.tsx, components/**
description: UI rules for AutomateYT pages and components.
---

# UI rules

Read `docs/ai/ui.md` first.

- Reuse `PageHeader`, `FormatCard`, `StatusPill`, `Meter` from `components/format-ui.tsx`. Add new pages to `NAV` in `components/Sidebar.tsx`.
- Dark theme via CSS variables in `app/globals.css` (`--bg`, `--panel`, `--accent`, `--muted`…). Icons only from `lucide-react`.
- Editor left, sticky preview right (`xl:` breakpoint). Control rows `flex flex-wrap`. Check 390 px and 1280 px.
- Waiting buttons show a spinner and are disabled. Errors in plain English. Poll only while a job runs.
- Urdu inputs `dir="auto"`. The Remotion `Player` loads with `next/dynamic` and `ssr: false`.
