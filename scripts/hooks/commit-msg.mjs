// commit-msg check: conventional commit subject, no Devanagari. Called by .githooks/commit-msg.
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const subject = readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.trim() && !l.startsWith('#')) || '';

const ALLOWED = /^(feat|fix|docs|chore|refactor|test|perf|style|build|ci|revert)(\([\w./-]+\))?!?: \S.{2,}$/;
const GIT_MADE = /^(Merge |Revert "|fixup! |squash! |amend! )/;

const problems = [];
if (!GIT_MADE.test(subject) && !ALLOWED.test(subject)) {
  problems.push(`Subject "${subject}" is not a conventional commit. Use e.g. "feat(cartoon): add series editor" or "fix: captions drift".`);
}
if (subject.length > 100) problems.push('Subject is longer than 100 characters.');
if (/[\u0900-\u097F]/.test(readFileSync(file, 'utf8'))) problems.push('Message contains Devanagari (Hindi script). Write it in English.');

if (problems.length) {
  console.error(`\ncommit-msg blocked this commit:\n${problems.map((p) => ` - ${p}`).join('\n')}\n`);
  process.exit(1);
}
