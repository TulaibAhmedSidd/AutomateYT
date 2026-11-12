// Helpers for the shared AI setup. AGENTS.md is the rulebook; .agents/skills is canonical and
// is copied to .claude/skills for Claude Code. Used by scripts/sync-ai.mjs, check-ai.mjs and the pre-commit hook.
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

/** Antigravity reads AGENTS.md whole; keep it small so it never gets cut off. */
export const AGENTS_MAX_BYTES = 24_000;

/** Guides AGENTS.md points to. Missing ones would send an AI tool to a dead link. */
export const REQUIRED_DOCS = [
  'docs/ai/architecture.md',
  'docs/ai/video-pipelines.md',
  'docs/ai/integrations.md',
  'docs/ai/ui.md',
  'docs/ai/coding-standards.md',
  'docs/ai/workflow.md',
  'docs/ai/home-pc-setup.md',
];

/** Reads the simple `key: value` frontmatter used by skills and rules. */
export function parseFrontmatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m) data[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return data;
}

/** Lists every file under a folder as forward-slash paths relative to it. */
export function listFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  const walk = (current) => {
    for (const name of readdirSync(current)) {
      const full = join(current, name);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(dir, full).split('\\').join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

/** Replaces .claude/skills with a fresh copy of .agents/skills. */
export function syncSkills(root) {
  const src = join(root, '.agents/skills');
  const dest = join(root, '.claude/skills');
  rmSync(dest, { recursive: true, force: true });
  for (const file of listFiles(src)) {
    const target = join(dest, file);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(src, file), target);
  }
  return listFiles(dest).length;
}

/** Returns a list of problems with the AI setup (empty list = all good). */
export function checkAiSetup(root) {
  const problems = [];
  const agentsPath = join(root, 'AGENTS.md');
  if (!existsSync(agentsPath)) problems.push('AGENTS.md is missing');
  else {
    const agents = readFileSync(agentsPath, 'utf8');
    const size = Buffer.byteLength(agents, 'utf8');
    if (size > AGENTS_MAX_BYTES) problems.push(`AGENTS.md is ${size} bytes — keep it under ${AGENTS_MAX_BYTES}`);
    if (!agents.includes('<!-- BEGIN:nextjs-agent-rules -->')) problems.push('AGENTS.md lost the Next.js managed block');
    if (!agents.includes('# AutomateYT — rules for AI agents')) problems.push('AGENTS.md is missing the project rules section');
    if (/[\u0900-\u097F]/.test(agents)) problems.push('AGENTS.md contains Devanagari text');
  }
  const claudePath = join(root, 'CLAUDE.md');
  if (!existsSync(claudePath) || !readFileSync(claudePath, 'utf8').includes('@AGENTS.md')) problems.push('CLAUDE.md must import @AGENTS.md');
  for (const doc of REQUIRED_DOCS) if (!existsSync(join(root, doc))) problems.push(`${doc} is missing`);

  const skillsDir = join(root, '.agents/skills');
  const skillNames = existsSync(skillsDir) ? readdirSync(skillsDir).filter((n) => statSync(join(skillsDir, n)).isDirectory()) : [];
  if (skillNames.length === 0) problems.push('.agents/skills has no skills');
  for (const name of skillNames) {
    const file = join(skillsDir, name, 'SKILL.md');
    if (!existsSync(file)) {
      problems.push(`.agents/skills/${name}/SKILL.md is missing`);
      continue;
    }
    const fm = parseFrontmatter(readFileSync(file, 'utf8'));
    if (!fm?.description) problems.push(`.agents/skills/${name}/SKILL.md needs a description in its frontmatter`);
    if (fm?.name !== name) problems.push(`.agents/skills/${name}/SKILL.md name must be "${name}"`);
  }

  const canonical = listFiles(skillsDir);
  const copies = listFiles(join(root, '.claude/skills'));
  if (canonical.join('|') !== copies.join('|')) problems.push('.claude/skills is out of sync — run npm run ai:sync');
  else {
    for (const f of canonical) {
      if (readFileSync(join(skillsDir, f), 'utf8') !== readFileSync(join(root, '.claude/skills', f), 'utf8')) {
        problems.push(`.claude/skills/${f} differs from .agents/skills — run npm run ai:sync`);
      }
    }
  }

  const rulesDir = join(root, '.agents/rules');
  for (const f of listFiles(rulesDir)) {
    const fm = parseFrontmatter(readFileSync(join(rulesDir, f), 'utf8'));
    if (!fm?.trigger) problems.push(`.agents/rules/${f} needs a trigger in its frontmatter`);
    else if (!['always_on', 'glob', 'model_decision', 'manual'].includes(fm.trigger)) problems.push(`.agents/rules/${f} has an unknown trigger "${fm.trigger}"`);
    if (fm?.trigger === 'glob' && !fm.globs) problems.push(`.agents/rules/${f} uses trigger glob but has no globs`);
  }
  return problems;
}
