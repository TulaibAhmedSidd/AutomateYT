// Points git at .githooks/ so every computer (office and home) runs the same hooks.
// Runs from `npm install` (prepare). Silent when this is not a git checkout.
import { execFileSync } from 'node:child_process';

try {
  execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { stdio: 'ignore' });
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  console.log('Git hooks installed (.githooks)');
} catch {
  // Not a git checkout (e.g. a zip download) — nothing to do.
}
