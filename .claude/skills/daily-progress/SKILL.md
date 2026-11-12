---
name: daily-progress
description: Use at the end of every AutomateYT work session, or when asked to log progress, wrap up, or say what was done today. Writes progress/YYYY-MM-DD/ with done.md, next.md and remaining.md, then commits it.
---

# Daily progress log

Every working day has a folder `progress/YYYY-MM-DD/` (Pakistan date), so the owner — and the AI on the other computer — always know what was done, what is next and what is left.

## Steps
1. **Date:** today in Asia/Karachi: `node -e "console.log(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Karachi'}).format(new Date()))"`.
2. **Gather facts:**
   - `git log --since=midnight --oneline` and `git status --short`;
   - the result of `npm run check` if a phase was finished;
   - which computer you are on (office PC, Intel graphics / home PC, GPU);
   - the previous day's `next.md` and `remaining.md`.
3. **Create or update** `progress/<date>/`. If the folder exists, ADD a `## <HH:MM PKT> — <office|home> PC` section to each file and never delete earlier entries.
   - `done.md`: one bullet per item, covering:
     - what changed, with files or commit hashes;
     - what was tested and the result (render checked? check passed?);
     - decisions and why.
   - `next.md`: the next session's tasks in order, each tagged with its phase (e.g. `Cartoon P2 — export clip workflow`), and which PC it needs.
   - `remaining.md`: the phase checklist with ✅ done / 🔄 in progress / ⬜ not started, then open bugs, blockers and questions for the owner.
4. **Index:** add or update today's line at the top of `progress/README.md`: `- [YYYY-MM-DD](YYYY-MM-DD/done.md) — one-line summary`.
5. **Commit (only if the owner allows commits this session):** `git add progress && git commit -m "docs(progress): YYYY-MM-DD"`.

Write in plain, simple English; the owner reads these on a phone. Never write Hindi or Devanagari.
