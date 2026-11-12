// Animated cartoon format: a series bible (characters, look, rules, voice) plus episodes made of ~5 s shots.
// Shared by the browser (Cartoon Studio, live preview), Remotion (CartoonEpisode) and the render worker.
// Keep this file free of runtime imports (type-only imports are fine): it also runs under `node --test`.

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export type CartoonLang = 'en' | 'ur';
export type Camera = 'static' | 'push-in' | 'pull-out' | 'pan-left' | 'pan-right' | 'orbit' | 'low-angle';
export type VoiceProvider = 'recorded' | 'edge';
export type Word = { text: string; start: number; end: number };

/** A recurring character. `look` is the fixed description used in every shot prompt; `reference` is an image file in series/<id>/refs/. */
export type Character = { id: string; name: string; look: string; reference?: string };

/** One series = one channel idea: look, characters, narrator voice and story rules. */
export type CartoonSeries = {
  id: string;
  name: string;
  language: CartoonLang;
  audience: 'kids' | 'general';
  madeForKids: boolean;
  style: string;
  negative: string;
  characters: Character[];
  voice: { provider: VoiceProvider; edgeVoice: string };
  rules: string[];
  episodeSeconds: 45 | 60 | 75;
  palette: { bg: string; accent: string };
};

/** The owner's recorded line for one shot, already cleaned to MP3 (file in episodes/<id>/recordings/). */
export type Recording = { file: string; seconds: number; at: string };

/** One ~5 s shot. The worker fills image/clip/audio/words/duration before rendering. */
export type CartoonShot = {
  id: string;
  narration: string;
  characters: string[];
  scene: string;
  action: string;
  camera: Camera;
  mood?: string;
  recording?: Recording;
  keyframe?: string;
  image?: string;
  clip?: string;
  audio?: string;
  words?: Word[];
  duration?: number;
};

/** One episode of a series. */
export type CartoonEpisode = {
  id: string;
  seriesId: string;
  title: string;
  description?: string;
  tags?: string[];
  shots: CartoonShot[];
  endHook: string;
  createdAt: string;
};

/** Props of the Remotion composition. assetBase = URL folder for preview files; empty while rendering (staticFile). */
export type EpisodeRenderProps = {
  episode: CartoonEpisode;
  series: Pick<CartoonSeries, 'name' | 'language' | 'palette'>;
  assetBase?: string;
};

/** Camera moves the stills engine animates (and the clip prompt asks for). */
export const CAMERAS: { id: Camera; label: string; prompt: string }[] = [
  { id: 'static', label: 'Still', prompt: 'steady camera' },
  { id: 'push-in', label: 'Push in', prompt: 'slow camera push in' },
  { id: 'pull-out', label: 'Pull out', prompt: 'slow camera pull back' },
  { id: 'pan-left', label: 'Pan left', prompt: 'camera pans left' },
  { id: 'pan-right', label: 'Pan right', prompt: 'camera pans right' },
  { id: 'orbit', label: 'Orbit', prompt: 'camera slowly orbits the subject' },
  { id: 'low-angle', label: 'Low angle', prompt: 'low angle shot looking up' },
];

const CAMERA_IDS = new Set<Camera>(CAMERAS.map((c) => c.id));
const SERIES_ID = /^[\w-]{3,64}$/;
const SHOT_ID = /^[a-z0-9]{6}$/;
const CHAR_ID = /^[a-z0-9-]{1,32}$/;
const AUDIO_FILE = /^[\w-]{1,64}\.(mp3|webm)$/;
const IMAGE_FILE = /^[\w-]{1,64}\.(png|jpe?g|webp)$/;
const EDGE_VOICE = /^[a-z]{2,3}-[A-Z]{2}-\w+Neural$/;

const WORDS_PER_SECOND = 2.6;
const TAIL = 0.3;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);

/** Random 6-character shot id; stable through edits so recordings stay attached to their shot. */
export function newShotId() {
  let id = '';
  while (id.length < 6) id += Math.random().toString(36).slice(2);
  return id.slice(0, 6);
}

/** About one shot per 5 seconds of episode. */
export function shotCountFor(seconds: number) {
  return Math.round(seconds / 5);
}

/** Seconds a shot stays on screen: set duration, else recorded length + tail, else an estimate from the words. */
export function shotSeconds(shot: CartoonShot) {
  if (shot.duration && shot.duration > 0) return shot.duration;
  if (shot.recording && shot.recording.seconds > 0) return shot.recording.seconds + TAIL;
  const words = shot.narration.split(/\s+/).filter(Boolean).length;
  return Math.max(2.4, words / WORDS_PER_SECOND + 0.35);
}

/** Frames for one shot at 30 fps. */
export function shotFrames(shot: CartoonShot) {
  return Math.max(1, Math.round(shotSeconds(shot) * FPS));
}

/** Frames for the whole episode (at least one second). */
export function episodeFrames(ep: CartoonEpisode) {
  return Math.max(FPS, ep.shots.reduce((sum, s) => sum + shotFrames(s), 0));
}

/** Spreads the words of `text` over `seconds`, longer words getting more time. Used when we have no real word timings. */
export function spreadWords(text: string, seconds: number, offset = 0): Word[] {
  const parts = text.split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const total = Math.max(0.2, seconds - offset - 0.05);
  const weights = parts.map((p) => Math.max(2, p.length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = offset;
  return parts.map((word, i) => {
    const len = (weights[i] / sum) * total;
    const w = { text: word, start: t, end: t + len };
    t += len;
    return w;
  });
}

/** Caption timings for a shot: real ones when the worker has them, otherwise spread over the shot. */
export function shotWords(shot: CartoonShot): Word[] {
  if (shot.words?.length) return shot.words;
  return spreadWords(shot.narration, Math.max(0.5, shotSeconds(shot) - TAIL), 0.05);
}

/** The image/video prompt for a shot: series style + fixed looks of the characters in it + scene, action, camera, mood. */
export function buildShotPrompt(series: CartoonSeries, shot: CartoonShot) {
  const looks = shot.characters
    .map((id) => series.characters.find((c) => c.id === id))
    .filter((c): c is Character => Boolean(c))
    .map((c) => c.look);
  const camera = CAMERAS.find((c) => c.id === shot.camera)?.prompt || 'steady camera';
  return [
    series.style,
    looks.length ? `Characters: ${looks.join('; ')}` : '',
    `Scene: ${shot.scene}`,
    `Action: ${shot.action}`,
    `Camera: ${camera}`,
    shot.mood ? `Mood: ${shot.mood}` : '',
  ]
    .filter(Boolean)
    .join('. ');
}

function sanitizeCharacter(input: unknown, index: number): Character | null {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const name = str(r.name, 40);
  if (!name) return null;
  const rawId = str(r.id, 32);
  const id = CHAR_ID.test(rawId) ? rawId : slug(name) || `c${index + 1}`;
  const c: Character = { id, name, look: str(r.look, 400) };
  const reference = str(r.reference, 80);
  if (IMAGE_FILE.test(reference)) c.reference = reference;
  return c;
}

/** Cleans a series from the browser before saving. */
export function sanitizeSeries(input: unknown): CartoonSeries {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const name = str(r.name, 60) || 'Untitled series';
  const rawId = str(r.id, 64);
  const id = SERIES_ID.test(rawId) ? rawId : `${slug(name) || 'series'}-${newShotId()}`;
  const seen = new Set<string>();
  const characters = (Array.isArray(r.characters) ? r.characters : [])
    .slice(0, 6)
    .map(sanitizeCharacter)
    .filter((c): c is Character => {
      if (!c || seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });
  const v = (r.voice && typeof r.voice === 'object' ? r.voice : {}) as Record<string, unknown>;
  const language: CartoonLang = r.language === 'ur' ? 'ur' : 'en';
  const edgeVoice = EDGE_VOICE.test(str(v.edgeVoice, 60)) ? str(v.edgeVoice, 60) : language === 'ur' ? 'ur-PK-AsadNeural' : 'en-US-AndrewNeural';
  const p = (r.palette && typeof r.palette === 'object' ? r.palette : {}) as Record<string, unknown>;
  const hex = (x: unknown, d: string) => (typeof x === 'string' && /^#[0-9a-fA-F]{6}$/.test(x) ? x : d);
  const seconds = Number(r.episodeSeconds);
  return {
    id,
    name,
    language,
    audience: r.audience === 'general' ? 'general' : 'kids',
    madeForKids: r.madeForKids === true,
    style: str(r.style, 600),
    negative: str(r.negative, 400),
    characters,
    voice: { provider: v.provider === 'edge' ? 'edge' : 'recorded', edgeVoice },
    rules: (Array.isArray(r.rules) ? r.rules : []).map((x) => str(x, 300)).filter(Boolean).slice(0, 12),
    episodeSeconds: seconds === 45 || seconds === 75 ? seconds : 60,
    palette: { bg: hex(p.bg, '#120c24'), accent: hex(p.accent, '#ffb547') },
  };
}

function sanitizeShot(input: unknown): CartoonShot | null {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const narration = str(r.narration, 240);
  const scene = str(r.scene, 300);
  const action = str(r.action, 300);
  if (!narration && !scene && !action) return null;
  const rawId = str(r.id, 6);
  const shot: CartoonShot = {
    id: SHOT_ID.test(rawId) ? rawId : newShotId(),
    narration,
    characters: (Array.isArray(r.characters) ? r.characters : []).filter((c): c is string => typeof c === 'string' && CHAR_ID.test(c)).slice(0, 4),
    scene,
    action,
    camera: CAMERA_IDS.has(r.camera as Camera) ? (r.camera as Camera) : 'static',
  };
  const mood = str(r.mood, 80);
  if (mood) shot.mood = mood;
  const rec = (r.recording && typeof r.recording === 'object' ? r.recording : null) as Record<string, unknown> | null;
  if (rec && AUDIO_FILE.test(str(rec.file, 80)) && typeof rec.seconds === 'number' && rec.seconds > 0 && rec.seconds <= 60) {
    shot.recording = { file: str(rec.file, 80), seconds: rec.seconds, at: str(rec.at, 40) };
  }
  const keyframe = str(r.keyframe, 80);
  if (IMAGE_FILE.test(keyframe)) shot.keyframe = keyframe;
  if (typeof r.duration === 'number' && r.duration > 0 && r.duration <= 60) shot.duration = r.duration;
  return shot;
}

/** Cleans an episode that came from the browser or the AI writer. */
export function sanitizeEpisode(input: unknown, seriesId: string): CartoonEpisode {
  const r = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const seen = new Set<string>();
  const shots = (Array.isArray(r.shots) ? r.shots : [])
    .slice(0, 20)
    .map(sanitizeShot)
    .filter((s): s is CartoonShot => Boolean(s))
    .map((s) => {
      if (seen.has(s.id)) s.id = newShotId();
      seen.add(s.id);
      return s;
    });
  const rawId = str(r.id, 64);
  const ep: CartoonEpisode = {
    id: SERIES_ID.test(rawId) ? rawId : '',
    seriesId,
    title: str(r.title, 120) || 'Untitled episode',
    shots,
    endHook: str(r.endHook, 200),
    createdAt: str(r.createdAt, 40) || new Date().toISOString(),
  };
  const description = str(r.description, 2000);
  if (description) ep.description = description;
  if (Array.isArray(r.tags)) {
    const tags = r.tags.map((t) => str(t, 40)).filter(Boolean).slice(0, 15);
    if (tags.length) ep.tags = tags;
  }
  return ep;
}

const KIDS_NEGATIVE = 'text, letters, words, watermark, logo, scary, horror, violence, blood, weapons, extra fingers, deformed face, blurry';

/** Starter series. Saved to disk on first use, then editable. */
export const SERIES_PRESETS: CartoonSeries[] = [
  {
    id: 'little-lessons',
    name: 'Little Lessons',
    language: 'en',
    audience: 'kids',
    madeForKids: true,
    style: '3D animated family film look, soft warm lighting, rounded friendly shapes, rich colours, cinematic depth of field, vertical 9:16 frame',
    negative: KIDS_NEGATIVE,
    characters: [
      { id: 'mimi', name: 'Mimi', look: 'Mimi, a cheerful 7-year-old girl with curly black hair in two puffs, big brown eyes, a yellow raincoat and red rubber boots' },
      { id: 'tiko', name: 'Tiko', look: 'Tiko, a small green turtle with a shiny dark-green shell, round friendly eyes and a tiny blue scarf' },
    ],
    voice: { provider: 'recorded', edgeVoice: 'en-US-AvaNeural' },
    rules: [
      'Every episode teaches one simple lesson: kindness, honesty, patience or sharing.',
      'Nothing scary or violent. Problems are small and the characters solve them.',
      'The last shot says the lesson in one short line and teases the next adventure.',
    ],
    episodeSeconds: 60,
    palette: { bg: '#1b1035', accent: '#ffb547' },
  },
  {
    id: 'ahmed-aur-billu',
    name: 'Ahmed aur Billu',
    language: 'ur',
    audience: 'kids',
    madeForKids: true,
    style: '3D animated family film look, colourful Pakistani neighbourhood, soft sunlight, rounded friendly shapes, rich colours, vertical 9:16 frame',
    negative: KIDS_NEGATIVE,
    characters: [
      { id: 'ahmed', name: 'Ahmed', look: 'Ahmed, an 8-year-old Pakistani boy with short black hair, light-brown skin, a white shalwar kameez and brown sandals' },
      { id: 'billu', name: 'Billu', look: 'Billu, a fluffy orange cat with white paws and a green collar' },
    ],
    voice: { provider: 'recorded', edgeVoice: 'ur-PK-AsadNeural' },
    rules: [
      'Narration in simple, polite Urdu for children, in Urdu script.',
      'Everyday Pakistani life: home, school, bazaar, park, family.',
      'Every episode has one small lesson; nothing scary or violent.',
    ],
    episodeSeconds: 60,
    palette: { bg: '#0c2a1d', accent: '#facc15' },
  },
  {
    id: 'gappu-the-goat',
    name: 'Gappu the Goat',
    language: 'en',
    audience: 'general',
    madeForKids: false,
    style: '3D animated comedy cartoon, bright saturated colours, exaggerated expressions, sunny farm setting, vertical 9:16 frame',
    negative: 'text, letters, watermark, logo, blood, gore, extra limbs, deformed face, blurry',
    characters: [
      { id: 'gappu', name: 'Gappu', look: 'Gappu, a goofy white goat with one bent horn, big yellow eyes and a red bandana' },
      { id: 'chikki', name: 'Chikki', look: 'Chikki, a bossy little brown hen wearing a tiny straw hat' },
    ],
    voice: { provider: 'recorded', edgeVoice: 'en-US-AndrewNeural' },
    rules: [
      'Comedy first: every shot moves the joke forward.',
      'Slapstick is fine, but nobody gets hurt.',
      'End on a twist punchline that makes people want the next episode.',
    ],
    episodeSeconds: 45,
    palette: { bg: '#2a0f08', accent: '#ff6b4a' },
  },
  {
    id: 'stories-of-light',
    name: 'Stories of Light',
    language: 'en',
    audience: 'general',
    madeForKids: false,
    style: '3D animated film look, warm golden light, historic desert towns, oil lanterns, calm and respectful mood, vertical 9:16 frame',
    negative: 'text, letters, watermark, logo, faces of holy figures, violence, blood, blurry',
    characters: [
      { id: 'zara', name: 'Zara', look: 'Zara, a curious 9-year-old girl in a light-blue headscarf and a cream dress' },
      { id: 'dada', name: 'Dada', look: "Dada, Zara's kind grandfather with a short white beard, round glasses and a grey waistcoat, an ordinary family elder" },
    ],
    voice: { provider: 'recorded', edgeVoice: 'en-US-BrianNeural' },
    rules: [
      'Never show the face or body of any prophet, companion or holy figure. Show places, objects, nature and light instead; the story is narrated.',
      'Only well-known, authentic stories and lessons. No invented sayings, quotes or numbers.',
      'Dada tells the story to Zara at home; the story itself is shown through places and objects.',
      'Calm, respectful tone from start to end.',
    ],
    episodeSeconds: 60,
    palette: { bg: '#0b1430', accent: '#fcd34d' },
  },
];
