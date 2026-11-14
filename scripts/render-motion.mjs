#!/usr/bin/env node
// Renders one Motion Graphics job to MP4 on this PC.
//   node scripts/render-motion.mjs <jobId>
// Reads storage/motion/<jobId>/spec.json, writes status.json as it goes, ends with video.mp4.
// Steps: free Edge neural voice per scene (word timings → captions) → Remotion bundle → render.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { speakEdge } from './lib/voice.mjs';
import { speakEleven } from './lib/eleven.mjs';
import { renderComposition } from './lib/remotion-render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jobId = process.argv[2];
if (!jobId || !/^[\w-]+$/.test(jobId)) {
  console.error('Usage: node scripts/render-motion.mjs <jobId>');
  process.exit(1);
}
const jobDir = path.join(ROOT, 'storage', 'motion', jobId);
const statusFile = path.join(jobDir, 'status.json');
const assetsDir = path.join(jobDir, 'assets');
const startedAt = new Date().toISOString();
const TAIL = 0.35;
const VOICE_CACHE = path.join(ROOT, 'storage', 'motion', 'voice-cache');

function setStatus(patch) {
  const prev = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile, 'utf8')) : {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(statusFile, JSON.stringify(next, null, 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const spec = JSON.parse(fs.readFileSync(path.join(jobDir, 'spec.json'), 'utf8'));
  setStatus({ stage: 'voice', progress: 0.02, startedAt, error: null, pid: process.pid });

  // 1. Voice + word timings, one file per scene.
  if (spec.voice && spec.voice !== 'none') {
    for (let i = 0; i < spec.scenes.length; i += 1) {
      const scene = spec.scenes[i];
      const text = (scene.voice || '').replace(/\*/g, '').trim();
      if (!text) continue;
      const name = `scene-${i}.mp3`;
      fs.mkdirSync(assetsDir, { recursive: true });
      let seconds;
      let words;
      if (spec.voice.startsWith('eleven:')) {
        // ElevenLabs costs credits, so every spoken line is kept in storage/motion/voice-cache and reused
        // when the same text and voice are rendered again (re-renders and small edits cost nothing).
        const model = spec.elevenModel || 'eleven_v4';
        const key = crypto.createHash('sha1').update(`${spec.voice}|${model}|${text}`).digest('hex').slice(0, 20);
        const cached = path.join(VOICE_CACHE, `${key}.mp3`);
        const meta = path.join(VOICE_CACHE, `${key}.json`);
        if (!fs.existsSync(cached) || !fs.existsSync(meta)) {
          fs.mkdirSync(VOICE_CACHE, { recursive: true });
          setStatus({ note: `ElevenLabs voice for scene ${i + 1} of ${spec.scenes.length}` });
          const r = await speakEleven(text, spec.voice.slice('eleven:'.length), model, cached);
          fs.writeFileSync(meta, JSON.stringify(r));
        }
        ({ seconds, words } = JSON.parse(fs.readFileSync(meta, 'utf8')));
        fs.copyFileSync(cached, path.join(assetsDir, name));
      } else {
        const tmp = path.join(jobDir, `tts-${i}`);
        const r = await speakEdge(text, spec.voice, tmp);
        ({ seconds, words } = r);
        fs.copyFileSync(r.file, path.join(assetsDir, name));
        fs.rmSync(tmp, { recursive: true, force: true });
      }
      const lastWord = words.length ? words[words.length - 1].end : 0;
      scene.audio = name;
      scene.words = words;
      scene.duration = Math.max(2.2, seconds, lastWord) + TAIL;
      setStatus({ stage: 'voice', progress: 0.02 + 0.18 * ((i + 1) / spec.scenes.length) });
      await sleep(200);
    }
  }
  delete spec.assetBase;
  fs.writeFileSync(path.join(jobDir, 'spec.final.json'), JSON.stringify(spec, null, 2));

  // 2 + 3. Bundle (only assets/ is public: staticFile('scene-0.mp3')) and render.
  const out = path.join(jobDir, 'video.mp4');
  await renderComposition({
    entry: path.join(ROOT, 'remotion', 'index.ts'),
    publicDir: assetsDir,
    id: 'MotionShort',
    inputProps: { spec },
    out,
    onStage: (stage, extra = {}) => setStatus({ stage, progress: stage === 'bundle' ? 0.22 : 0.3, ...extra }),
    onProgress: (p) => {
      const s = JSON.parse(fs.readFileSync(statusFile, 'utf8')).stage;
      setStatus({ progress: s === 'bundle' ? 0.22 + p * 0.08 : 0.3 + p * 0.69 });
    },
  });
  setStatus({ stage: 'done', progress: 1, output: 'video.mp4', bytes: fs.statSync(out).size, finishedAt: new Date().toISOString(), pid: null });
}

main().catch((e) => {
  console.error(e);
  setStatus({ stage: 'failed', error: String(e?.message || e).slice(0, 800), pid: null });
  process.exit(1);
});
