import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { cleanRecording } from './audio';
import { edgeTts, elevenTts } from './tts';
import {
  ELEVEN_MODELS,
  SERIES_PRESETS,
  sanitizeEpisode,
  sanitizeSeries,
  type CartoonEpisode,
  type CartoonSeries,
  type Recording,
  type RenderMode,
} from './spec';
import type { ServedFile } from '../media-response';

// Server-only storage for the cartoon format. Everything lives on this PC in storage/cartoon/ (gitignored):
//   series/<seriesId>/series.json, refs/<characterId>.<ext>
//   episodes/<episodeId>/episode.json, status.json, log.txt, recordings/, keyframes/, assets/, video.mp4

export const CARTOON_DIR = path.join(process.cwd(), 'storage', 'cartoon');
const SERIES_ROOT = path.join(CARTOON_DIR, 'series');
const EPISODES_ROOT = path.join(CARTOON_DIR, 'episodes');
const ID = /^[\w-]{3,64}$/;
const SHOT = /^[a-z0-9]{6}$/;
const MAX_AUDIO = 10 * 1024 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;

/** An error whose message is safe and useful to show the owner (returned as HTTP 400). */
export class CartoonError extends Error {}

export type EpisodeStatus = {
  stage: 'idle' | 'queued' | 'voice' | 'visuals' | 'bundle' | 'render' | 'done' | 'failed';
  progress: number;
  error?: string | null;
  note?: string;
  pid?: number | null;
  shots?: Record<string, { voice?: string; image?: string }>;
  bytes?: number;
  seconds?: number;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
};

export type EpisodeSummary = {
  id: string;
  /** Episode number for library episodes (from the id, e.g. -e07). */
  number?: number;
  title: string;
  seriesId: string;
  createdAt: string;
  shots: number;
  recorded: number;
  status: EpisodeStatus;
};

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function seriesDir(id: string) {
  if (!ID.test(id)) throw new CartoonError('Bad series id');
  return path.join(SERIES_ROOT, id);
}

function episodeDir(id: string) {
  if (!ID.test(id)) throw new CartoonError('Bad episode id');
  return path.join(EPISODES_ROOT, id);
}

function processAlive(pid?: number | null) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ---------- Series ----------

/** All series. The four presets are written to disk the first time, after which they can be edited. */
export function listSeries(): CartoonSeries[] {
  for (const preset of SERIES_PRESETS) {
    const file = path.join(SERIES_ROOT, preset.id, 'series.json');
    if (!fs.existsSync(file)) writeJson(file, preset);
  }
  importLibrary();
  const order = new Map([...readLibrary().map((l) => l.series.id), ...SERIES_PRESETS.map((p) => p.id)].map((id, i) => [id, i]));
  return fs
    .readdirSync(SERIES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && ID.test(d.name))
    .map((d) => readJson<CartoonSeries>(path.join(SERIES_ROOT, d.name, 'series.json')))
    .filter((s): s is CartoonSeries => Boolean(s))
    .map((s) => sanitizeSeries(s))
    .sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99) || a.name.localeCompare(b.name));
}

// ---------- Content library (committed in content/cartoon, shared by every PC) ----------

const LIBRARY = path.join(process.cwd(), 'content', 'cartoon');

/** A series from the content library, with its planned episode ideas. */
export type LibrarySeries = { series: CartoonSeries; group: string; why: string; model: string; topics: string[] };

/** Reads content/cartoon/series/*.json (series bible + episode ideas). */
export function readLibrary(): LibrarySeries[] {
  const dir = path.join(LIBRARY, 'series');
  if (!fs.existsSync(dir)) return [];
  const groups = ['islamic', 'kids', 'grown-ups', 'trending', 'earning'];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<{ series: unknown; group?: string; why?: string; model?: string; topics?: unknown[] }>(path.join(dir, f)))
    .filter((x): x is NonNullable<typeof x> => Boolean(x?.series))
    .map((x) => ({
      series: sanitizeSeries(x.series),
      group: String(x.group || 'other'),
      why: String(x.why || ''),
      model: String(x.model || 'gpt-6.1-sol'),
      topics: (x.topics || []).map(String),
    }))
    .sort((a, b) => groups.indexOf(a.group) - groups.indexOf(b.group) || a.series.name.localeCompare(b.series.name));
}

/** Episode id of library episode number n, e.g. mishi-and-bruno-e07. */
export function libraryEpisodeId(seriesId: string, n: number) {
  return `${seriesId}-e${String(n).padStart(2, '0')}`;
}

const hash = (text: string) => createHash('sha1').update(text).digest('hex');

/**
 * Copies a library series into storage. When the library version changes (e.g. after a git pull), the stored copy is
 * updated too, but only if the owner has not edited it in the app since the last import (tracked in library.json).
 */
function importSeries(series: CartoonSeries) {
  const file = path.join(SERIES_ROOT, series.id, 'series.json');
  const marker = path.join(SERIES_ROOT, series.id, 'library.json');
  const content = JSON.stringify(series, null, 2);
  const seen = readJson<{ content: string; stored: string }>(marker);
  if (fs.existsSync(file)) {
    if (seen?.content === hash(content)) return;
    const editedInApp = seen ? hash(fs.readFileSync(file, 'utf8')) !== seen.stored : false;
    if (editedInApp) return;
  }
  // Keep reference pictures the owner uploaded.
  const old = readJson<CartoonSeries>(file);
  const next = { ...series, characters: series.characters.map((c) => ({ ...c, ...(old?.characters.find((o) => o.id === c.id)?.reference ? { reference: old?.characters.find((o) => o.id === c.id)?.reference } : {}) })) };
  const text = JSON.stringify(next, null, 2);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  writeJson(marker, { content: hash(content), stored: hash(text) });
}

/**
 * Copies library series and written episodes into storage. Episodes are never overwritten, so the owner's edits,
 * recordings and videos are safe. Library episodes get old createdAt dates, in episode order.
 */
function importLibrary() {
  for (const lib of readLibrary()) {
    importSeries(lib.series);
    const epDir = path.join(LIBRARY, 'episodes', lib.series.id);
    if (!fs.existsSync(epDir)) continue;
    for (const f of fs.readdirSync(epDir)) {
      const m = /^(\d{2})\.json$/.exec(f);
      if (!m) continue;
      const n = Number(m[1]);
      const id = libraryEpisodeId(lib.series.id, n);
      const target = path.join(EPISODES_ROOT, id, 'episode.json');
      if (fs.existsSync(target)) continue;
      const data = readJson<{ episode?: unknown }>(path.join(epDir, f));
      if (!data?.episode) continue;
      const ep = { ...sanitizeEpisode(data.episode, lib.series.id), id, createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString() };
      writeJson(target, ep);
    }
  }
}

/** One series, or null. */
export function getSeries(id: string): CartoonSeries | null {
  const s = readJson<CartoonSeries>(path.join(seriesDir(id), 'series.json'));
  return s ? sanitizeSeries(s) : null;
}

/** Saves a series from the browser. Reference images are only kept if the file really exists. */
export function saveSeries(input: unknown): CartoonSeries {
  const series = sanitizeSeries(input);
  const dir = seriesDir(series.id);
  for (const c of series.characters) {
    if (c.reference && !fs.existsSync(path.join(dir, 'refs', c.reference))) delete c.reference;
  }
  writeJson(path.join(dir, 'series.json'), series);
  return series;
}

/** Deletes a saved series. Presets can be edited but not deleted (they would come back). */
export function deleteSeries(id: string) {
  if (SERIES_PRESETS.some((p) => p.id === id)) throw new CartoonError('Starter series cannot be deleted. Edit it instead.');
  fs.rmSync(seriesDir(id), { recursive: true, force: true });
}

const IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** File extension for an uploaded image's content type, or a plain-English error. */
export function imageExt(contentType: string | null) {
  const ext = IMAGE_TYPES[(contentType || '').split(';')[0].trim()];
  if (!ext) throw new CartoonError('Please upload a PNG, JPG or WEBP picture.');
  return ext;
}

function removeVariants(dir: string, base: string) {
  if (!fs.existsSync(dir)) return;
  for (const f of fs.readdirSync(dir)) if (f.startsWith(`${base}.`)) fs.rmSync(path.join(dir, f), { force: true });
}

/** Saves the reference picture of one character (used for every shot it appears in). */
export function saveReference(seriesId: string, characterId: string, bytes: Buffer, ext: string): CartoonSeries {
  const series = getSeries(seriesId);
  if (!series) throw new CartoonError('Series not found');
  const character = series.characters.find((c) => c.id === characterId);
  if (!character) throw new CartoonError('Character not found. Save the series first.');
  if (!bytes.length || bytes.length > MAX_IMAGE) throw new CartoonError('The picture must be under 8 MB.');
  const refs = path.join(seriesDir(seriesId), 'refs');
  fs.mkdirSync(refs, { recursive: true });
  removeVariants(refs, characterId);
  fs.writeFileSync(path.join(refs, `${characterId}.${ext}`), bytes);
  character.reference = `${characterId}.${ext}`;
  writeJson(path.join(seriesDir(seriesId), 'series.json'), series);
  return series;
}

// ---------- Episodes ----------

/** Render status of an episode. A render whose process died without saying "done" counts as failed. */
export function readEpisodeStatus(id: string): EpisodeStatus {
  const status = readJson<EpisodeStatus>(path.join(episodeDir(id), 'status.json')) || { stage: 'idle', progress: 0 };
  if (!['idle', 'done', 'failed'].includes(status.stage) && status.pid && !processAlive(status.pid)) {
    return { ...status, stage: 'failed', error: status.error || 'The render process stopped unexpectedly.' };
  }
  return status;
}

/** One episode, or null. */
export function getEpisode(id: string): CartoonEpisode | null {
  const raw = readJson<CartoonEpisode>(path.join(episodeDir(id), 'episode.json'));
  if (!raw) return null;
  return { ...sanitizeEpisode(raw, raw.seriesId), id };
}

/** Newest first, with how many lines are recorded. */
export function listEpisodes(): EpisodeSummary[] {
  importLibrary();
  if (!fs.existsSync(EPISODES_ROOT)) return [];
  return fs
    .readdirSync(EPISODES_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory() && ID.test(d.name))
    .map((d) => getEpisode(d.name))
    .filter((e): e is CartoonEpisode => Boolean(e))
    .map((e) => ({
      id: e.id,
      number: Number(/-e(\d{2})$/.exec(e.id)?.[1]) || undefined,
      title: e.title,
      seriesId: e.seriesId,
      createdAt: e.createdAt,
      shots: e.shots.length,
      recorded: e.shots.filter((s) => s.recording).length,
      status: readEpisodeStatus(e.id),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Creates a new episode folder from a draft (e.g. what the AI writer returned). */
export function createEpisode(seriesId: string, draft: unknown): CartoonEpisode {
  if (!getSeries(seriesId)) throw new CartoonError('Series not found');
  const ep = sanitizeEpisode(draft, seriesId);
  for (const s of ep.shots) {
    delete s.recording;
    delete s.keyframe;
  }
  const slugTitle = ep.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'episode';
  ep.id = `${new Date().toISOString().slice(0, 10)}-${slugTitle}-${Math.random().toString(36).slice(2, 6)}`;
  ep.createdAt = new Date().toISOString();
  writeJson(path.join(episodeDir(ep.id), 'episode.json'), ep);
  return ep;
}

/**
 * Saves edits from the browser. Recordings and pictures are owned by the server (set only by their upload routes),
 * so they are taken from the saved copy by shot id. Files of deleted shots are removed.
 */
export function saveEpisode(id: string, input: unknown): CartoonEpisode {
  const current = getEpisode(id);
  if (!current) throw new CartoonError('Episode not found');
  const next = { ...sanitizeEpisode(input, current.seriesId), id, createdAt: current.createdAt };
  const byId = new Map(current.shots.map((s) => [s.id, s]));
  for (const s of next.shots) {
    const old = byId.get(s.id);
    delete s.recording;
    delete s.keyframe;
    delete s.duration;
    if (old?.recording) s.recording = old.recording;
    if (old?.keyframe) s.keyframe = old.keyframe;
  }
  const keep = new Set(next.shots.map((s) => s.id));
  for (const sub of ['recordings', 'keyframes']) {
    const dir = path.join(episodeDir(id), sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) if (!keep.has(f.split('.')[0])) fs.rmSync(path.join(dir, f), { force: true });
  }
  writeJson(path.join(episodeDir(id), 'episode.json'), next);
  return next;
}

/** Deletes an episode folder, stopping its render first. */
export function deleteEpisode(id: string) {
  const status = readEpisodeStatus(id);
  if (status.pid && processAlive(status.pid) && !['done', 'failed'].includes(status.stage)) {
    try {
      process.kill(status.pid);
    } catch {
      /* already gone */
    }
  }
  fs.rmSync(episodeDir(id), { recursive: true, force: true });
}

function shotOf(ep: CartoonEpisode, shotId: string) {
  if (!SHOT.test(shotId)) throw new CartoonError('Bad shot id');
  const shot = ep.shots.find((s) => s.id === shotId);
  if (!shot) throw new CartoonError('Shot not found. Save the episode first.');
  return shot;
}

/** Saves the owner's recorded line for one shot: cleans it to MP3 and stores its length. */
export async function saveRecording(id: string, shotId: string, bytes: Buffer): Promise<{ recording: Recording; episode: CartoonEpisode }> {
  const before = getEpisode(id);
  if (!before) throw new CartoonError('Episode not found');
  shotOf(before, shotId);
  if (bytes.length < 1000) throw new CartoonError('The recording is empty. Check that the microphone is allowed and try again.');
  if (bytes.length > MAX_AUDIO) throw new CartoonError('The recording is too long. Keep each line under 30 seconds.');
  const dir = path.join(episodeDir(id), 'recordings');
  fs.mkdirSync(dir, { recursive: true });
  const input = path.join(dir, `${shotId}.input`);
  fs.writeFileSync(input, bytes);
  try {
    const seconds = await cleanRecording(input, path.join(dir, `${shotId}.mp3`)).catch((e: unknown) => {
      throw new CartoonError(`This recording could not be used. Please record again. (${e instanceof Error ? e.message : String(e)})`);
    });
    if (seconds < 0.4) throw new CartoonError('The recording is silent. Speak closer to the microphone and try again.');
    const recording: Recording = { file: `${shotId}.mp3`, seconds, at: new Date().toISOString(), by: 'own' };
    // Re-read: the owner may have saved text edits while FFmpeg was cleaning the audio.
    const ep = getEpisode(id);
    if (!ep) throw new CartoonError('Episode not found');
    shotOf(ep, shotId).recording = recording;
    writeJson(path.join(episodeDir(id), 'episode.json'), ep);
    return { recording, episode: ep };
  } finally {
    fs.rmSync(input, { force: true });
  }
}

/** Which AI voice to use for a line. */
export type AiVoiceChoice = { provider: 'elevenlabs' | 'edge'; voiceId: string; model?: string };

/**
 * Makes one shot's line with an AI voice and saves it like a recording (with exact word timings when ElevenLabs gives
 * them). Takes a few seconds per line, so the browser calls it once per shot and shows progress.
 */
export async function saveAiVoice(id: string, shotId: string, choice: AiVoiceChoice): Promise<{ recording: Recording; episode: CartoonEpisode }> {
  const before = getEpisode(id);
  if (!before) throw new CartoonError('Episode not found');
  const text = shotOf(before, shotId).narration.trim();
  if (!text) throw new CartoonError('This shot has no line to speak.');
  if (!/^[\w-]{3,60}$/.test(choice.voiceId)) throw new CartoonError('Pick a voice first.');
  const model = ELEVEN_MODELS.some((m) => m.id === choice.model) ? String(choice.model) : 'eleven_v4';
  const result =
    choice.provider === 'elevenlabs' ? await elevenTts(text, choice.voiceId, model).catch(toUserError) : await edgeTts(text, choice.voiceId).catch(toUserError);
  const dir = path.join(episodeDir(id), 'recordings');
  fs.mkdirSync(dir, { recursive: true });
  removeVariants(dir, shotId);
  fs.writeFileSync(path.join(dir, `${shotId}.mp3`), result.audio);
  const recording: Recording = {
    file: `${shotId}.mp3`,
    seconds: Math.round(result.seconds * 100) / 100,
    at: new Date().toISOString(),
    by: choice.provider === 'elevenlabs' ? `elevenlabs:${choice.voiceId}:${model}` : `edge:${choice.voiceId}`,
    ...(result.words.length ? { words: result.words } : {}),
  };
  // Re-read: the owner may have saved text edits while the voice was being made.
  const ep = getEpisode(id);
  if (!ep) throw new CartoonError('Episode not found');
  shotOf(ep, shotId).recording = recording;
  writeJson(path.join(episodeDir(id), 'episode.json'), ep);
  return { recording, episode: ep };
}

function toUserError(e: unknown): never {
  throw new CartoonError(e instanceof Error ? e.message : String(e));
}

/** Removes one shot's recording. */
export function deleteRecording(id: string, shotId: string): CartoonEpisode {
  const ep = getEpisode(id);
  if (!ep) throw new CartoonError('Episode not found');
  const shot = shotOf(ep, shotId);
  removeVariants(path.join(episodeDir(id), 'recordings'), shotId);
  delete shot.recording;
  writeJson(path.join(episodeDir(id), 'episode.json'), ep);
  return ep;
}

/** Saves a picture for one shot (used instead of the character's reference picture). */
export function saveKeyframe(id: string, shotId: string, bytes: Buffer, ext: string): CartoonEpisode {
  const ep = getEpisode(id);
  if (!ep) throw new CartoonError('Episode not found');
  const shot = shotOf(ep, shotId);
  if (!bytes.length || bytes.length > MAX_IMAGE) throw new CartoonError('The picture must be under 8 MB.');
  const dir = path.join(episodeDir(id), 'keyframes');
  fs.mkdirSync(dir, { recursive: true });
  removeVariants(dir, shotId);
  fs.writeFileSync(path.join(dir, `${shotId}.${ext}`), bytes);
  shot.keyframe = `${shotId}.${ext}`;
  writeJson(path.join(episodeDir(id), 'episode.json'), ep);
  return ep;
}

/** Removes one shot's picture. */
export function deleteKeyframe(id: string, shotId: string): CartoonEpisode {
  const ep = getEpisode(id);
  if (!ep) throw new CartoonError('Episode not found');
  const shot = shotOf(ep, shotId);
  removeVariants(path.join(episodeDir(id), 'keyframes'), shotId);
  delete shot.keyframe;
  writeJson(path.join(episodeDir(id), 'episode.json'), ep);
  return ep;
}

/** Starts the render worker in the background. Refuses if one is already running or lines are missing. */
export function startRender(id: string, options: { allowAiVoice: boolean; mode: RenderMode }) {
  const ep = getEpisode(id);
  if (!ep) throw new CartoonError('Episode not found');
  if (!ep.shots.length) throw new CartoonError('The episode has no shots.');
  const series = getSeries(ep.seriesId);
  if (!series) throw new CartoonError('The series of this episode was deleted.');
  const status = readEpisodeStatus(id);
  if (!['idle', 'done', 'failed'].includes(status.stage)) throw new CartoonError('This episode is already rendering.');
  const missing = ep.shots.filter((s) => !s.recording).length;
  if (series.voice.provider === 'recorded' && missing && !options.allowAiVoice) {
    throw new CartoonError(`${missing} line(s) are not recorded yet. Record them, or tick "use AI voice for missing lines".`);
  }
  const dir = episodeDir(id);
  writeJson(path.join(dir, 'render-options.json'), options);
  writeJson(path.join(dir, 'status.json'), { stage: 'queued', progress: 0, updatedAt: new Date().toISOString() });
  const log = fs.openSync(path.join(dir, 'log.txt'), 'w');
  const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', 'render-cartoon.mjs'), id], {
    cwd: process.cwd(),
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  writeJson(path.join(dir, 'status.json'), { stage: 'queued', progress: 0, pid: child.pid, updatedAt: new Date().toISOString() });
}

const TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/** Resolves a file under storage/cartoon for serving, refusing anything outside it or of an unknown type. */
export function resolveCartoonFile(parts: string[]): ServedFile | null {
  const full = path.resolve(CARTOON_DIR, ...parts);
  if (!full.startsWith(CARTOON_DIR + path.sep)) return null;
  const type = TYPES[path.extname(full).toLowerCase()];
  if (!type || !fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return { full, type, size: fs.statSync(full).size };
}
