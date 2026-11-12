# Workflow

## Every session
1. `git pull` (you may have worked on the other computer).
2. Read `AGENTS.md`, then the newest `progress/<date>/next.md` and `remaining.md`.
3. Take the next task from `next.md`. If it is a new feature, write or update a design in `docs/superpowers/specs/` and a plan in `docs/superpowers/plans/` first, and get the owner's OK.
4. Build in small steps. After each step run `npm run lint` (fast). When a phase is done, run `npm run check`.
5. Video changes: render a real video and run the `verify-render` skill.
6. Commit only when the owner asks (conventional message). Push only when asked.
7. End: the `daily-progress` skill.

## Commands
| Command | Does |
|---|---|
| `npm run dev -- -p 3300` | Dev server on port 3300 (port 3000 is often taken) |
| `npm run lint` | ESLint (Next + React 19 rules) |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm run check` | lint + typecheck + AI-setup check. Must pass before "done" |
| `npm run ai:sync` | Copy `.agents/skills` → `.claude/skills` (run after editing a skill) |
| `npm run ai:check` | Verify the AI setup: AGENTS.md size, docs present, skills in sync, rule frontmatter |
| `npm run hooks:install` | Point git at `.githooks/` (`npm install` does this automatically) |
| `node scripts/render-motion.mjs <jobId>` | Run a Motion render by hand (normally the API starts it) |
| `npm test` | Unit tests (`node --test`, files in `tests/`) |
| `node scripts/render-cartoon.mjs <episodeId>` | Run a cartoon render by hand |
| `node scripts/write-library.mjs [seriesId]` | Write missing library scripts (costs OpenAI credit: ask the owner first) |

## Git
- One-time setup on each computer:
  - `git config user.name "tulaibahmedsidd"`
  - `git config user.email "ahsidtullu@gmail.com"`
  - The remote URL stays plain: `https://github.com/TulaibAhmedSidd/AutomateYT.git`. Git Credential Manager handles the login.
- Commit messages: `type(scope)?: summary`, where type is one of `feat|fix|docs|chore|refactor|test|perf|style|build|ci|revert`. Merge and revert messages from git are allowed.
- Hooks (`.githooks/`):
  - `pre-commit` refuses:
    - the wrong author email;
    - staged secrets or `.env*` files;
    - `storage/`, rendered media or model files;
    - lint errors in staged code;
    - an AI-setup check failure when AI files changed.
  - `commit-msg` refuses messages that aren't conventional.
  - Never bypass them with `--no-verify`. Fix the cause.
- Work on `main` for small changes. Use a branch `feat/<name>` for big phases and merge with `--ff-only` when the owner says so.

## Where things are written down
| What | Where |
|---|---|
| Rules for AI tools | `AGENTS.md` (short) + `docs/ai/*.md` (detail) + `.agents/rules/*.md` (Antigravity-style triggers) |
| Repeatable procedures | `.agents/skills/<name>/SKILL.md` |
| Feature designs | `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` |
| Step-by-step build plans | `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` |
| What happened each day | `progress/YYYY-MM-DD/{done,next,remaining}.md` |

## Talking to the owner
- Simple English. Short Roman Urdu phrases are fine. **Never Hindi or Devanagari.** The owner's voice typing may show Urdu in Devanagari; read it as Urdu.
- Say what is done, what is not done, and what was not tested. Never claim something works without running it.
- Ask before:
  - spending money;
  - posting anywhere;
  - installing software;
  - deleting remote data;
  - pushing.
