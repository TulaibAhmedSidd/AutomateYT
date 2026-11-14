#!/usr/bin/env node
// Renders one cartoon episode to MP4.
//   node scripts/render-cartoon.mjs <episodeId>
// Reads storage/cartoon/episodes/<id>/episode.json + its series, writes status.json as it goes, ends with video.mp4.
// Steps per shot (resumable): voice (owner's recording, or free Edge voice) → picture (shot picture, character
// reference, or a placeholder card). Then the Remotion composition "CartoonEpisode" is rendered.
// Modes (render-options.json): pictures | key-shots | animated. Clips and AI pictures come from ComfyUI (scripts/lib/comfy.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { speakEdge } from './lib/voice.mjs';
import { speakEleven } from './lib/eleven.mjs';
import { renderComposition } from './lib/remotion-render.mjs';
import { ensureComfy, hasWorkflow, runWorkflow, uploadImage } from './lib/comfy.mjs';
import { ensureSfx } from './lib/sfx.mjs';
import { buildShotPrompt, keyShotIds } from '../lib/cartoon/spec.ts';
import { spawnSync } from 'node:child_process';

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

// What the studio shows while a video is made: done/total for every step, what runs now, and minutes left.
// Minutes per job start from measured home-PC numbers and are replaced by this run's real timings.
let steps = null;
let current = null;
const measured = { picture: [], clip: [] };
const DEFAULT_MIN = { picture: 2, clip: 21, voice: 0.05, video: 2 };
const avgMin = (kind) => (measured[kind]?.length ? measured[kind].reduce((a, b) => a + b, 0) / measured[kind].length : DEFAULT_MIN[kind]);
function startJob(what, line) {
  current = { what, line, startedAt: Date.now() };
}
function finishJob(kind) {
  if (current) measured[kind].push((Date.now() - current.startedAt) / 60000);
  current = null;
}
function report(patch = {}) {
  const P = avgMin('picture');
  const C = avgMin('clip');
  const total = steps.voice.total * DEFAULT_MIN.voice + (steps.refs.total + steps.pictures.total) * P + steps.clips.total * C + DEFAULT_MIN.video;
  let done = steps.voice.done * DEFAULT_MIN.voice + (steps.refs.done + steps.pictures.done) * P + steps.clips.done * C + DEFAULT_MIN.video * (steps.video.done / 100);
  if (current) done += Math.min((Date.now() - current.startedAt) / 60000, (current.what === 'clip' ? C : current.what === 'voice' ? DEFAULT_MIN.voice : P) * 0.95);
  setStatus({
    steps,
    current: current && { what: current.what, line: current.line, startedAt: new Date(current.startedAt).toISOString() },
    etaMin: Math.max(0, Math.round((total - done) * 10) / 10),
    progress: Math.min(0.99, 0.02 + 0.97 * (done / total)),
    ...patch,
  });
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

/** The shot's own picture (uploaded or made by AI earlier), if it exists on disk. */
function keyframeFile(shot) {
  const f = shot.keyframe && path.join(dir, 'keyframes', shot.keyframe);
  return f && fs.existsSync(f) ? f : null;
}

/** The reference picture of the first character in the shot that has one. */
function referenceFor(shot, series) {
  for (const cid of shot.characters) {
    const c = series.characters.find((x) => x.id === cid);
    const ref = c?.reference && path.join(CARTOON, 'series', series.id, 'refs', c.reference);
    if (ref && fs.existsSync(ref)) return ref;
  }
  return null;
}

/** A character's reference picture file in the series folder, if it exists. */
function referenceFile(series, c) {
  const f = c.reference && path.join(CARTOON, 'series', series.id, 'refs', c.reference);
  return f && fs.existsSync(f) ? f : null;
}

/** Records an AI-made character reference in the stored series.json. */
function saveSeriesReference(seriesId, characterId, name) {
  const file = path.join(CARTOON, 'series', seriesId, 'series.json');
  const s = readJson(file);
  const c = s?.characters.find((x) => x.id === characterId);
  if (!c) return;
  c.reference = name;
  fs.writeFileSync(file, JSON.stringify(s, null, 2));
}

/** A stable seed per shot, so re-making a shot gives a similar result. */
function seedFor(shotId) {
  return [...shotId].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 2147483647, 7);
}

/** Records an AI-made picture in episode.json (re-read first, the studio may have saved edits meanwhile). */
function saveKeyframeName(shotId, name) {
  const file = path.join(dir, 'episode.json');
  const ep = readJson(file);
  const s = ep?.shots.find((x) => x.id === shotId);
  if (!s) return;
  s.keyframe = name;
  fs.writeFileSync(file, JSON.stringify(ep, null, 2));
}

/** Length of a media file in seconds, read from FFmpeg's output. */
function mediaSeconds(file) {
  const ffmpeg = path.join(ROOT, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  const r = spawnSync(ffmpeg, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = /Duration: (\d+):(\d+):([\d.]+)/.exec(r.stderr || '');
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
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
  const mode = ['pictures', 'key-shots', 'animated'].includes(options.mode) ? options.mode : 'pictures';

  const n = episode.shots.length;
  steps = { voice: { done: 0, total: n }, refs: { done: 0, total: 0 }, pictures: { done: 0, total: 0 }, clips: { done: 0, total: 0 }, video: { done: 0, total: 100 } };
  setStatus({ stage: 'voice', progress: 0.02, startedAt: new Date().toISOString(), error: null, note: null, pid: process.pid, shots: {}, steps, current: null, etaMin: null });
  fs.mkdirSync(assets, { recursive: true });
  const shots = {};

  // 1. Voice for every shot.
  for (let i = 0; i < n; i += 1) {
    const shot = episode.shots[i];
    startJob('voice', i + 1);
    // Transition reels have no voice: each picture stays for its fixed time and the owner adds a trending sound.
    const v = series.format === 'transition' ? { kind: 'none', duration: shot.duration || 1.8 } : await voiceFor(shot, i, series, options);
    shot.duration = Math.round(v.duration * 100) / 100;
    if (v.audio) shot.audio = v.audio;
    if (v.words) shot.words = v.words;
    shots[shot.id] = { voice: v.kind };
    current = null;
    steps.voice.done = i + 1;
    report({ stage: 'voice', shots });
  }

  // 2. Pictures and clips. Two picture workflows can exist on the GPU PC:
  //    picture.api.json  = text → picture (first transition stage, character reference pictures, lines without a reference)
  //    keyframe.api.json = picture + text → edited picture (same character, or same view in the next era)
  //    The animated modes also turn shots into moving clips with clip.api.json.
  report({ stage: 'visuals', note: null });
  const animateIds = new Set(mode === 'animated' ? episode.shots.map((s) => s.id) : mode === 'key-shots' ? keyShotIds(episode) : []);
  const wantAiPictures = hasWorkflow('picture') || hasWorkflow('keyframe');
  const transition = series.format === 'transition';
  let comfyReady = false;
  if (animateIds.size || wantAiPictures) {
    try {
      await ensureComfy((note) => setStatus({ note }));
      comfyReady = true;
    } catch (e) {
      // Pictures mode still works without ComfyUI; the animated modes need it.
      if (animateIds.size) throw e;
      setStatus({ note: 'ComfyUI is not running: using uploaded or character pictures.' });
    }
  }
  // Characters need one reference picture each, so they look the same in every shot (made once, kept in the series).
  if (wantAiPictures && comfyReady && hasWorkflow('picture') && !transition) {
    const used = new Set(episode.shots.flatMap((s) => s.characters));
    const missingRefs = series.characters.filter((x) => used.has(x.id) && !referenceFile(series, x));
    steps.refs.total = missingRefs.length;
    for (const c of missingRefs) {
      startJob('reference', 0);
      report({ note: `Making the character picture of ${c.name} (once per series)` });
      const file = path.join(CARTOON, 'series', series.id, 'refs', `${c.id}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await runWorkflow('picture', {
        PROMPT: `${series.style}. Full-body character reference sheet of ${c.look}, standing, facing the camera, plain simple background, even light`,
        NEGATIVE: series.negative,
        SEED: seedFor(c.id),
        WIDTH: 480,
        HEIGHT: 832,
        PREFIX: `automateyt_ref_${series.id}_${c.id}`,
      }, file, { timeoutMin: 20 });
      c.reference = `${c.id}.png`;
      saveSeriesReference(series.id, c.id, c.reference);
      finishJob('picture');
      steps.refs.done += 1;
      report();
    }
  }

  steps.pictures.total = episode.shots.filter((s) => wantAiPictures && comfyReady && !keyframeFile(s)).length;
  steps.clips.total = episode.shots.filter((s) => animateIds.has(s.id)).length;
  report();
  // Transition reels edit every era from the FIRST stage's picture. Chaining edits (each from the one before)
  // lost quality with every step: by stage 7 the picture was washed out (measured on the home PC, 2026-11-14).
  let anchorPicture = null;
  for (let i = 0; i < n; i += 1) {
    const shot = episode.shots[i];
    const tick = (label) => (minutes) => report({ note: `${label} for line ${i + 1} of ${n} (${Math.floor(minutes)} min so far)` });

    // 2a. AI picture, saved with the episode so it shows in the studio and is not made twice.
    //     Transition reels edit the first stage's picture (same view, another era); stories edit the character's
    //     reference picture (same face); with nothing to start from, the text-to-picture workflow is used.
    if (wantAiPictures && comfyReady && !keyframeFile(shot)) {
      const base = transition ? anchorPicture : referenceFor(shot, series);
      const useEdit = Boolean(base) && hasWorkflow('keyframe');
      const workflow = useEdit ? 'keyframe' : hasWorkflow('picture') ? 'picture' : null;
      if (workflow) {
        const target = path.join(dir, 'keyframes', `${shot.id}.png`);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const prompt = transition && useEdit
          ? `Keep exactly the same place, camera angle and framing. Change it to show: ${shot.narration}. ${shot.scene}. ${shot.action}. ` +
            'It must look like a real photograph taken at that time: for old years an authentic faded archival photo with natural film grain, ' +
            'for today a sharp modern photo. Straight architecture, natural textures, small realistic people. Not a painting, not an illustration.'
          : buildShotPrompt(series, shot);
        startJob('picture', i + 1);
        report({ note: `Making the picture for line ${i + 1} of ${n}` });
        await runWorkflow(workflow, {
          PROMPT: prompt,
          NEGATIVE: series.negative,
          ...(useEdit ? { IMAGE: await uploadImage(base) } : {}),
          SEED: seedFor(transition ? episode.id : shot.id),
          WIDTH: 480,
          HEIGHT: 832,
          PREFIX: `automateyt_${id}_${shot.id}_kf`,
        }, target, { timeoutMin: 20, onTick: tick('Making the picture') });
        shot.keyframe = `${shot.id}.png`;
        saveKeyframeName(shot.id, shot.keyframe);
        finishJob('picture');
        steps.pictures.done += 1;
      } else {
        steps.pictures.total -= 1;
      }
    }
    anchorPicture = anchorPicture || keyframeFile(shot);
    const p = pictureFor(shot, series);
    if (p.image) shot.image = p.image;
    shots[shot.id] = { ...shots[shot.id], image: p.kind };
    report({ shots });

    // 2b. Moving clip from the picture (cached in clips/ so a resumed render does not make it again).
    if (animateIds.has(shot.id)) {
      const start = keyframeFile(shot) || referenceFor(shot, series);
      if (!start) {
        shots[shot.id].clip = 'skipped: no picture';
        steps.clips.total -= 1;
      } else {
        const clipFile = path.join(dir, 'clips', `${shot.id}.mp4`);
        if (!fs.existsSync(clipFile)) {
          fs.mkdirSync(path.dirname(clipFile), { recursive: true });
          startJob('clip', i + 1);
          report({ note: `Animating line ${i + 1} of ${n}` });
          await runWorkflow('clip', {
            PROMPT: buildShotPrompt(series, shot),
            NEGATIVE: series.negative,
            IMAGE: await uploadImage(start),
            SEED: seedFor(shot.id),
            WIDTH: 480,
            HEIGHT: 832,
            FRAMES: 49,
            PREFIX: `automateyt_${id}_${shot.id}`,
          }, clipFile, { timeoutMin: 90, onTick: tick('Animating') });
          finishJob('clip');
        }
        shot.clip = stage(clipFile, `clip-${shot.id}.mp4`);
        shot.clipSeconds = mediaSeconds(clipFile) || 2;
        shots[shot.id].clip = 'done';
        steps.clips.done += 1;
      }
    }
    report({ stage: 'visuals', shots });
  }
  report({ note: null });

  // 3. Render.
  const inputProps = { episode, series: { name: series.name, language: series.language, palette: series.palette, format: series.format } };
  if (transition) {
    // A silent reel is dead on Shorts: a whoosh on every era change and a deep hit when "today" lands.
    const fx = ensureSfx(ROOT);
    inputProps.sfx = { whoosh: stage(fx.whoosh, 'sfx-whoosh.mp3'), impact: stage(fx.impact, 'sfx-impact.mp3') };
  }
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
      report({ stage: s, note: null, ...extra });
    },
    onProgress: (p) => {
      steps.video.done = Math.round((stageName === 'bundle' ? p * 0.1 : 0.1 + p * 0.9) * 100);
      report();
    },
  });
  steps.video.done = 100;
  setStatus({ stage: 'done', progress: 1, steps, current: null, etaMin: 0, bytes: fs.statSync(out).size, finishedAt: new Date().toISOString(), pid: null });
}

main().catch((e) => {
  console.error(e);
  setStatus({ stage: 'failed', error: String(e?.message || e).slice(0, 800), pid: null });
  process.exit(1);
});
