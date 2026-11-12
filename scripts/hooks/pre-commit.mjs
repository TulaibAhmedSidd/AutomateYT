// Pre-commit checks for AutomateYT. Called by .githooks/pre-commit.
// Blocks: wrong author, secrets, .env files, render output, model files, big files, Devanagari text,
// lint errors in staged code, and a broken AI setup. Never bypass with --no-verify; fix the cause.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { checkAiSetup } from '../lib/ai-files.mjs';

const OWNER_EMAIL = 'ahsidtullu@gmail.com';
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const problems = [];

// 1. Author identity (Vercel and the owner's GitHub expect this account).
let email = '';
try {
  email = git('config', 'user.email');
} catch {
  /* not set */
}
if (email.toLowerCase() !== OWNER_EMAIL) {
  problems.push(`Commit author email is "${email || '(not set)'}". Run: git config user.email "${OWNER_EMAIL}" and git config user.name "tulaibahmedsidd"`);
}

const staged = git('diff', '--cached', '--name-only', '--diff-filter=ACMR').split('\n').filter(Boolean);

// 2. Files that must never be committed.
const BLOCKED = [
  [/^\.env(?!\.example$)/, 'environment file with secrets'],
  [/^storage\//, 'render job output (storage/)'],
  [/^public\/(audio|images|videos)\/(?!\.gitkeep$)/, 'Image Studio output'],
  [/\.(mp4|mov|mp3|wav|m4a)$/i, 'media file'],
  [/\.(safetensors|gguf|ckpt|pt|pth|onnx)$/i, 'AI model file'],
];
for (const file of staged) {
  for (const [re, why] of BLOCKED) if (re.test(file)) problems.push(`${file}: ${why} must not be committed`);
  if (existsSync(file) && statSync(file).size > MAX_FILE_BYTES) problems.push(`${file}: bigger than 5 MB`);
}

// 3. Secrets and Devanagari in added lines.
const SECRETS = [
  [/sk-(proj-)?[A-Za-z0-9_-]{20,}/, 'OpenAI key'],
  [/sk_[a-f0-9]{40,}/, 'ElevenLabs key'],
  [/AIza[0-9A-Za-z_-]{30,}/, 'Google API key'],
  [/GOCSPX-[0-9A-Za-z_-]{20,}/, 'Google OAuth client secret'],
  [/ya29\.[0-9A-Za-z_-]{20,}/, 'Google access token'],
  [/1\/\/0[0-9A-Za-z_-]{20,}/, 'Google refresh token'],
  [/mongodb(\+srv)?:\/\/[^\s:/]+:[^\s@]+@/, 'MongoDB URI with password'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
];
const diff = git('diff', '--cached', '-U0', '--no-color', '--', '.', ':(exclude).env.example', ':(exclude)package-lock.json');
let current = '';
for (const line of diff.split('\n')) {
  if (line.startsWith('+++ ')) {
    current = line.slice(6);
    continue;
  }
  if (!line.startsWith('+') || line.startsWith('+++')) continue;
  for (const [re, why] of SECRETS) if (re.test(line)) problems.push(`${current}: looks like a ${why} — keep secrets in .env.local only`);
  if (/[\u0900-\u097F]/.test(line)) problems.push(`${current}: contains Devanagari (Hindi script) — use English, Roman Urdu or Urdu script`);
}

// 4. Lint the staged code files (errors only; warnings are allowed).
const lintable = staged.filter((f) => /\.(ts|tsx|js|mjs|cjs)$/.test(f) && existsSync(f));
if (lintable.length) {
  // Run ESLint's own entry with this Node, so no shell is needed on Windows.
  const res = spawnSync(process.execPath, ['node_modules/eslint/bin/eslint.js', '--quiet', ...lintable], { stdio: 'inherit' });
  if (res.status !== 0) problems.push('ESLint found errors in staged files (see above). Fix them, then commit again.');
}

// 5. AI setup, when any AI file changed.
if (staged.some((f) => /^(AGENTS\.md|CLAUDE\.md|docs\/ai\/|\.agents\/|\.claude\/skills\/)/.test(f))) {
  for (const p of checkAiSetup(process.cwd())) problems.push(`AI setup: ${p}`);
}

if (problems.length) {
  console.error(`\npre-commit blocked this commit:\n${[...new Set(problems)].map((p) => ` - ${p}`).join('\n')}\n`);
  process.exit(1);
}
