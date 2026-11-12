#!/usr/bin/env node
// Renders one cartoon episode to MP4.
//   node scripts/render-cartoon.mjs <episodeId>
// Reads storage/cartoon/episodes/<id>/episode.json + its series, writes status.json as it goes, ends with video.mp4.
// Steps per shot (resumable): voice (owner's recording, or free Edge voice) → picture (shot picture, character
// reference, or a placeholder card). Then the Remotion composition "CartoonEpisode" is rendered.
// Engine: CARTOON_ENGINE=stills (default, any PC). "comfy" (animated clips on the home GPU) arrives in Phase 2.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speakEdge } from './lib/voice.mjs';
import { speakEleven } from './lib/eleven.mjs';
import { renderComposition } from './lib/remotion-render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const id = process.argv[2];
if (!id || !/^[\w-]{3,64}$/.test(id)) {
  console.error('Usage: node scripts/render-cartoon.mjs <episodeId>');
  process.exit(1);
}
const CARTOON = path.join(ROOT, 'storage', 'cartoon');
const dir = path.join(CARTOON, 'episodes', id);
const assets = path.join(dir, 'assets');
const statusFile = path.join(dir, 'status.json');
const TAIL = 0.3;

const readJson = (file, fallback = null) => {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
};

function setStatus(patch) {
  const prev = readJson(statusFile, {});
  fs.writeFileSync(statusFile, JSON.stringify({ ...prev, ...patch, updatedAt: new Date().toISOString() }, null, 2));
}

/** Copies a file into assets/ under a new name, only if it changed (keeps resumes fast). */
function stage(from, name) {
  const to = path.join(assets, name);
  if (!fs.existsSync(to) || fs.statSync(to).size !== fs.statSync(from).size || fs.statSync(to).mtimeMs < fs.statSync(from).mtimeMs) {
    fs.copyFileSync(from, to);
  }
  return name;
}

async function voiceFor(shot, index, series, options) {
  const text = shot.narration.trim();
  if (!text) return { kind: 'none', duration: 2.4 };
  const recorded = shot.recording && path.join(dir, 'recordings', shot.recording.file);
  if (recorded && fs.existsSync(recorded)) {
    return { kind: 'recorded', audio: stage(recorded, `${shot.id}.mp3`), duration: shot.recording.seconds + TAIL };
  }
  const v = series.voice;
  if (v.provider === 'recorded' && !options.allowAiVoice) {
    throw new Error(`Shot ${index + 1} has no recording. Record it, or tick "use AI voice for missing lines".`);
  }
  // AI voice: ElevenLabs when the series has an ElevenLabs voice (and is not set to the free voice), else free Edge.
  const useEleven = v.provider !== 'edge' && Boolean(v.elevenVoiceId);
  const voiceKey = useEleven ? `eleven:${v.elevenVoiceId}:${v.elevenModel || 'eleven_v4'}` : `edge:${v.edgeVoice}`;
  // Cached per shot, so a resumed or repeated render does not pay for the same line twice.
  const cacheFile = path.join(assets, `${shot.id}.voice.json`);
  const mp3 = path.join(assets, `${shot.id}.ai.mp3`);
  const cache = readJson(cacheFile);
  if (!cache || cache.text !== text || cache.voice !== voiceKey || !fs.existsSync(mp3)) {
    let out;
    if (useEleven) {
      out = await speakEleven(text, v.elevenVoiceId, v.elevenModel || 'eleven_v4', mp3);
    } else {
      const tmp = path.join(dir, `tts-${shot.id}`);
      const edge = await speakEdge(text.replace(/\[[^\]]{1,30}\]/g, ' '), v.edgeVoice, tmp);
      fs.copyFileSync(edge.file, mp3);
      fs.rmSync(tmp, { recursive: true, force: true });
      out = edge;
    }
    fs.writeFileSync(cacheFile, JSON.stringify({ text, voice: voiceKey, seconds: out.seconds, words: out.words }));
  }
  const { seconds, words } = readJson(cacheFile);
  const lastWord = words.length ? words[words.length - 1].end : 0;
  return { kind: useEleven ? 'elevenlabs' : 'ai', audio: `${shot.id}.ai.mp3`, words, duration: Math.max(2.2, seconds, lastWord) + 0.35 };
}

function pictureFor(shot, series) {
  const kf = shot.keyframe && path.join(dir, 'keyframes', shot.keyframe);
  if (kf && fs.existsSync(kf)) return { kind: 'keyframe', image: stage(kf, `kf-${shot.keyframe}`) };
  for (const cid of shot.characters) {
    const c = series.characters.find((x) => x.id === cid);
    const ref = c?.reference && path.join(CARTOON, 'series', series.id, 'refs', c.reference);
    if (ref && fs.existsSync(ref)) return { kind: 'reference', image: stage(ref, `ref-${c.reference}`) };
  }
  return { kind: 'card' };
}

async function main() {
  const episode = readJson(path.join(dir, 'episode.json'));
  if (!episode) throw new Error('episode.json is missing');
  const series = readJson(path.join(CARTOON, 'series', episode.seriesId, 'series.json'));
  if (!series) throw new Error(`Series "${episode.seriesId}" was not found`);
  const options = readJson(path.join(dir, 'render-options.json'), {});
  const engine = process.env.CARTOON_ENGINE || 'stills';
  if (engine === 'comfy') throw new Error('The ComfyUI engine arrives in Phase 2. Set CARTOON_ENGINE=stills for now.');

  setStatus({ stage: 'voice', progress: 0.02, startedAt: new Date().toISOString(), error: null, note: null, pid: process.pid, shots: {} });
  fs.mkdirSync(assets, { recursive: true });
  const shots = {};
  const n = episode.shots.length;

  // 1. Voice for every shot.
  for (let i = 0; i < n; i += 1) {
    const shot = episode.shots[i];
    const v = await voiceFor(shot, i, series, options);
    shot.duration = Math.round(v.duration * 100) / 100;
    if (v.audio) shot.audio = v.audio;
    if (v.words) shot.words = v.words;
    shots[shot.id] = { voice: v.kind };
    setStatus({ stage: 'voice', progress: 0.02 + 0.2 * ((i + 1) / n), shots });
  }

  // 2. Picture for every shot (Phase 2 adds ComfyUI keyframes and clips here).
  setStatus({ stage: 'visuals', progress: 0.23 });
  for (const shot of episode.shots) {
    const p = pictureFor(shot, series);
    if (p.image) shot.image = p.image;
    shots[shot.id] = { ...shots[shot.id], image: p.kind };
  }
  setStatus({ stage: 'visuals', progress: 0.25, shots });

  // 3. Render.
  const inputProps = { episode, series: { name: series.name, language: series.language, palette: series.palette } };
  fs.writeFileSync(path.join(dir, 'episode.final.json'), JSON.stringify(inputProps, null, 2));
  const out = path.join(dir, 'video.mp4');
  let stageName = 'bundle';
  await renderComposition({
    entry: path.join(ROOT, 'remotion', 'index.ts'),
    publicDir: assets,
    id: 'CartoonEpisode',
    inputProps,
    out,
    onStage: (s, extra = {}) => {
      stageName = s;
      setStatus({ stage: s, progress: s === 'bundle' ? 0.26 : 0.32, ...extra });
    },
    onProgress: (p) => setStatus({ progress: stageName === 'bundle' ? 0.26 + p * 0.06 : 0.32 + p * 0.67 }),
  });
  setStatus({ stage: 'done', progress: 1, bytes: fs.statSync(out).size, finishedAt: new Date().toISOString(), pid: null });
}

main().catch((e) => {
  console.error(e);
  setStatus({ stage: 'failed', error: String(e?.message || e).slice(0, 800), pid: null });
  process.exit(1);
});
