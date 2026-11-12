#!/usr/bin/env node
// Writes every planned episode of the content library with the AI episode writer.
//   node scripts/write-library.mjs [seriesId]        (the app must be running: npm run dev -- -p 3300)
// Reads content/cartoon/series/*.json (series bible + episode ideas) and saves each finished script to
// content/cartoon/episodes/<seriesId>/<NN>.json. Already-written episodes are skipped, so it can be re-run any time.
// It costs OpenAI credit (about $0.02 per episode with gpt-6.1-sol): run it only when the owner asks.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.APP_URL || 'http://localhost:3300';
const ONLY = process.argv[2];
const CONCURRENCY = Number(process.env.CONCURRENCY || 5);
const seriesDir = path.join(ROOT, 'content', 'cartoon', 'series');

const files = fs.readdirSync(seriesDir).filter((f) => f.endsWith('.json'));
const jobs = [];
for (const f of files) {
  const lib = JSON.parse(fs.readFileSync(path.join(seriesDir, f), 'utf8'));
  if (ONLY && lib.series.id !== ONLY) continue;
  const outDir = path.join(ROOT, 'content', 'cartoon', 'episodes', lib.series.id);
  fs.mkdirSync(outDir, { recursive: true });
  lib.topics.forEach((topic, i) => {
    const out = path.join(outDir, `${String(i + 1).padStart(2, '0')}.json`);
    if (!fs.existsSync(out)) jobs.push({ seriesId: lib.series.id, model: lib.model, number: i + 1, topic, out });
  });
}

// Make the app import the library series before writing.
const ping = await fetch(`${BASE}/api/cartoon/series`).catch(() => null);
if (!ping?.ok) {
  console.error(`The app is not reachable at ${BASE}. Start it with: npm run dev -- -p 3300`);
  process.exit(1);
}

console.log(`${jobs.length} episode(s) to write, ${CONCURRENCY} at a time.`);
let done = 0;
let failed = 0;

async function writeOne(job) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(`${BASE}/api/cartoon/script`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ seriesId: job.seriesId, topic: job.topic, model: job.model }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
      fs.writeFileSync(
        job.out,
        JSON.stringify({ number: job.number, topic: job.topic, model: job.model, writtenAt: new Date().toISOString(), episode: data.episode }, null, 2) + '\n',
      );
      done += 1;
      console.log(`[${done + failed}/${jobs.length}] ${job.seriesId} #${job.number}: ${data.episode.title}`);
      return;
    } catch (e) {
      if (attempt === 3) {
        failed += 1;
        console.error(`[${done + failed}/${jobs.length}] FAILED ${job.seriesId} #${job.number}: ${e.message}`);
      } else {
        await new Promise((r) => setTimeout(r, 3000 * attempt));
      }
    }
  }
}

const queue = [...jobs];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) await writeOne(queue.shift());
  }),
);
console.log(`Finished: ${done} written, ${failed} failed. Re-run to retry the failed ones.`);
process.exit(failed ? 1 : 0);
