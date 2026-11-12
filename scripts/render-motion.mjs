#!/usr/bin/env node
// Renders one Motion Graphics job to MP4 on this PC.
//   node scripts/render-motion.mjs <jobId>
// Reads storage/motion/<jobId>/spec.json, writes status.json as it goes, ends with video.mp4.
// Steps: free Edge neural voice per scene (word timings → captions) → Remotion bundle → render.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

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

function setStatus(patch) {
  const prev = fs.existsSync(statusFile) ? JSON.parse(fs.readFileSync(statusFile, 'utf8')) : {};
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  fs.writeFileSync(statusFile, JSON.stringify(next, null, 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KBPS = 96; // AUDIO_24KHZ_96KBITRATE_MONO_MP3 is constant bit rate, so length = bytes / rate.
const TAIL = 0.35;

async function speak(text, voice, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  for (let attempt = 1; ; attempt += 1) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
      const { audioFilePath, metadataFilePath } = await tts.toFile(outDir, text, { rate: '+4%' });
      const bytes = fs.statSync(audioFilePath).size;
      if (!bytes) throw new Error('empty audio');
      let words = [];
      if (metadataFilePath && fs.existsSync(metadataFilePath)) {
        const meta = JSON.parse(fs.readFileSync(metadataFilePath, 'utf8'));
        words = (meta.Metadata || [])
          .filter((m) => m.Type === 'WordBoundary')
          .map((m) => ({ text: m.Data.text.Text, start: m.Data.Offset / 1e7, end: (m.Data.Offset + m.Data.Duration) / 1e7 }))
          .filter((w) => /[\p{L}\p{N}]/u.test(w.text));
      }
      return { audioFilePath, seconds: (bytes * 8) / (KBPS * 1000), words };
    } catch (e) {
      if (attempt >= 5) throw new Error(`Voice failed: ${e?.message || e}`);
      await sleep(2500 * attempt);
    } finally {
      tts.close();
    }
  }
}

/** Use an already-installed headless Chrome when there is one, so nothing extra is downloaded. */
function findBrowser() {
  if (process.env.REMOTION_BROWSER && fs.existsSync(process.env.REMOTION_BROWSER)) return process.env.REMOTION_BROWSER;
  const base = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs
    .readdirSync(base)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    for (const sub of ['chrome-headless-shell-win64', 'chrome-win']) {
      const exe = path.join(base, d, sub, 'chrome-headless-shell.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return undefined;
}

async function main() {
  const spec = JSON.parse(fs.readFileSync(path.join(jobDir, 'spec.json'), 'utf8'));
  setStatus({ stage: 'voice', progress: 0.02, startedAt, error: null, pid: process.pid });

  // 1. Voice + word timings, one file per scene.
  if (spec.voice && spec.voice !== 'none') {
    for (let i = 0; i < spec.scenes.length; i += 1) {
      const scene = spec.scenes[i];
      const text = (scene.voice || '').replace(/\*/g, '').trim();
      if (!text) continue;
      const tmp = path.join(jobDir, `tts-${i}`);
      const { audioFilePath, seconds, words } = await speak(text, spec.voice, tmp);
      const name = `scene-${i}.mp3`;
      fs.mkdirSync(assetsDir, { recursive: true });
      fs.copyFileSync(audioFilePath, path.join(assetsDir, name));
      fs.rmSync(tmp, { recursive: true, force: true });
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

  // 2. Bundle the Remotion project. Only assets/ is its public dir (staticFile('scene-0.mp3')),
  //    and the bundle goes to the temp folder so it never copies itself.
  fs.mkdirSync(assetsDir, { recursive: true });
  setStatus({ stage: 'bundle', progress: 0.22 });
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'motion-bundle-'));
  const serveUrl = await bundle({
    entryPoint: path.join(ROOT, 'remotion', 'index.ts'),
    publicDir: assetsDir,
    outDir: bundleDir,
    onProgress: (p) => setStatus({ stage: 'bundle', progress: 0.22 + (p / 100) * 0.08 }),
  });

  // 3. Render.
  const browserExecutable = findBrowser();
  const inputProps = { spec };
  const composition = await selectComposition({ serveUrl, id: 'MotionShort', inputProps, browserExecutable });
  setStatus({ stage: 'render', progress: 0.3, frames: composition.durationInFrames, seconds: composition.durationInFrames / composition.fps });
  const out = path.join(jobDir, 'video.mp4');
  // Headless Chrome now and then crashes a tab mid-render ("Page crashed!"); a second try with fewer tabs works.
  const tries = [Math.max(1, Math.min(4, Math.floor(os.cpus().length / 3))), 1];
  for (let attempt = 0; attempt < tries.length; attempt += 1) {
    let last = 0;
    try {
      await renderMedia({
        composition,
        serveUrl,
        codec: 'h264',
        crf: 20,
        outputLocation: out,
        inputProps,
        browserExecutable,
        concurrency: tries[attempt],
        onProgress: ({ progress }) => {
          if (progress - last >= 0.02 || progress === 1) {
            last = progress;
            setStatus({ stage: 'render', progress: 0.3 + progress * 0.69 });
          }
        },
      });
      break;
    } catch (e) {
      if (attempt === tries.length - 1) throw e;
      console.error(`Render attempt ${attempt + 1} failed, retrying:`, e?.message || e);
      setStatus({ stage: 'render', progress: 0.3, note: 'Retrying after a browser crash' });
    }
  }
  fs.rmSync(bundleDir, { recursive: true, force: true });
  setStatus({ stage: 'done', progress: 1, output: 'video.mp4', bytes: fs.statSync(out).size, finishedAt: new Date().toISOString(), pid: null });
}

main().catch((e) => {
  console.error(e);
  setStatus({ stage: 'failed', error: String(e?.message || e).slice(0, 800), pid: null });
  process.exit(1);
});
