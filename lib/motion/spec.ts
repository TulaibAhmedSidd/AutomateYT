// Motion Graphics format: one JSON "spec" describes a whole Short.
// The same spec drives the live preview (@remotion/player) and the final render (scripts/render-motion.mjs).
// Keep this file free of Node or Next imports: it is bundled into the browser and into Remotion.

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export type MotionLang = 'en' | 'ur';
export type SceneKind = 'hook' | 'stat' | 'list' | 'compare' | 'quote' | 'statement' | 'cta';
export type ThemeId = 'ember' | 'violet' | 'ocean' | 'lime';

/** One spoken word, in seconds from the start of its scene. Filled in by the renderer from the voice. */
export type Word = { text: string; start: number; end: number };

export type MotionScene = {
  kind: SceneKind;
  /** What the voice says. */
  voice: string;
  /** Big on-screen text. Wrap words in *stars* to colour them with the accent. */
  heading?: string;
  sub?: string;
  /** stat: "90%", "$28K", "3x" — numbers count up. */
  value?: string;
  /** list: up to 4 items. compare: [left, right]. */
  items?: string[];
  /** Set by the renderer. */
  audio?: string;
  duration?: number;
  words?: Word[];
};

export type MotionSpec = {
  title: string;
  description?: string;
  tags?: string[];
  language: MotionLang;
  theme: ThemeId;
  /** Edge neural voice id, or 'none' for a silent video. */
  voice: string;
  captions: boolean;
  scenes: MotionScene[];
  /** Where audio files live for the browser preview, e.g. /api/motion/files/<id>. Empty while rendering. */
  assetBase?: string;
};

export type Theme = { name: string; bg: string; bg2: string; accent: string; accent2: string; text: string; muted: string };

export const THEMES: Record<ThemeId, Theme> = {
  ember: { name: 'Ember', bg: '#0b0706', bg2: '#2a0f08', accent: '#ff6b4a', accent2: '#ffb547', text: '#fff7f2', muted: '#c9b3a9' },
  violet: { name: 'Violet', bg: '#08061a', bg2: '#251060', accent: '#a78bfa', accent2: '#f472b6', text: '#f5f3ff', muted: '#b9b2d9' },
  ocean: { name: 'Ocean', bg: '#030b14', bg2: '#06324a', accent: '#38bdf8', accent2: '#34d399', text: '#effaff', muted: '#a3c2d3' },
  lime: { name: 'Lime', bg: '#070a05', bg2: '#1d2a0a', accent: '#bef264', accent2: '#facc15', text: '#fbfff2', muted: '#bac3a5' },
};

export const SCENE_KINDS: { id: SceneKind; label: string; hint: string }[] = [
  { id: 'hook', label: 'Hook', hint: 'First 2 seconds. A bold claim or question.' },
  { id: 'stat', label: 'Big number', hint: 'One number that counts up, e.g. 90%.' },
  { id: 'list', label: 'List', hint: 'Up to 4 short points that slide in.' },
  { id: 'compare', label: 'This vs That', hint: 'Two sides, left and right.' },
  { id: 'quote', label: 'Quote', hint: 'A line that types itself out.' },
  { id: 'statement', label: 'Statement', hint: 'One strong sentence with an underline.' },
  { id: 'cta', label: 'Call to action', hint: 'Follow, comment a word, part 2.' },
];

export type VoiceOption = { id: string; label: string; lang: MotionLang | 'any' };

/** Free Microsoft Edge neural voices (online, no key). */
export const VOICES: VoiceOption[] = [
  { id: 'en-US-AndrewNeural', label: 'Andrew — warm, male (US)', lang: 'en' },
  { id: 'en-US-BrianNeural', label: 'Brian — calm, male (US)', lang: 'en' },
  { id: 'en-US-ChristopherNeural', label: 'Christopher — deep, male (US)', lang: 'en' },
  { id: 'en-US-AvaNeural', label: 'Ava — bright, female (US)', lang: 'en' },
  { id: 'en-US-EmmaNeural', label: 'Emma — friendly, female (US)', lang: 'en' },
  { id: 'en-GB-RyanNeural', label: 'Ryan — British, male', lang: 'en' },
  { id: 'en-IN-PrabhatNeural', label: 'Prabhat — South Asian English, male', lang: 'en' },
  { id: 'en-IN-NeerjaNeural', label: 'Neerja — South Asian English, female', lang: 'en' },
  { id: 'ur-PK-AsadNeural', label: 'Asad — Urdu, male', lang: 'ur' },
  { id: 'ur-PK-UzmaNeural', label: 'Uzma — Urdu, female', lang: 'ur' },
  { id: 'none', label: 'No voice (music-only edit)', lang: 'any' },
];

const WORDS_PER_SECOND = 2.6;
const TAIL = 0.35;

export function plainText(s = '') {
  return s.replace(/\*/g, '');
}

/** Seconds a scene stays on screen: real voice length once rendered, an estimate before that. */
export function sceneSeconds(scene: MotionScene) {
  if (scene.duration && scene.duration > 0) return scene.duration;
  const words = plainText(scene.voice).split(/\s+/).filter(Boolean).length;
  return Math.max(2.4, words / WORDS_PER_SECOND + TAIL);
}

export function sceneFrames(scene: MotionScene) {
  return Math.max(1, Math.round(sceneSeconds(scene) * FPS));
}

export function totalFrames(spec: MotionSpec) {
  return Math.max(FPS, spec.scenes.reduce((sum, s) => sum + sceneFrames(s), 0));
}

/** Word timings for captions: real ones from the voice, or spread evenly over the scene. */
export function sceneWords(scene: MotionScene): Word[] {
  if (scene.words?.length) return scene.words;
  const parts = plainText(scene.voice).split(/\s+/).filter(Boolean);
  if (!parts.length) return [];
  const total = sceneSeconds(scene) - TAIL;
  const weights = parts.map((p) => Math.max(2, p.length));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = 0.1;
  return parts.map((text, i) => {
    const len = (weights[i] / sum) * (total - 0.1);
    const word = { text, start: t, end: t + len };
    t += len;
    return word;
  });
}

const KINDS = new Set<SceneKind>(SCENE_KINDS.map((k) => k.id));

/** Clean anything that came from the browser or an AI model before it reaches the renderer. */
export function sanitizeSpec(input: unknown): MotionSpec {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const str = (v: unknown, max = 400) => (typeof v === 'string' ? v.slice(0, max) : '');
  const language: MotionLang = raw.language === 'ur' ? 'ur' : 'en';
  const theme = (Object.keys(THEMES) as ThemeId[]).includes(raw.theme as ThemeId) ? (raw.theme as ThemeId) : 'ember';
  const voice = VOICES.some((v) => v.id === raw.voice) ? String(raw.voice) : language === 'ur' ? 'ur-PK-AsadNeural' : 'en-US-AndrewNeural';
  const scenesIn = Array.isArray(raw.scenes) ? raw.scenes.slice(0, 14) : [];
  const scenes: MotionScene[] = scenesIn
    .map((s) => {
      const r = (s && typeof s === 'object' ? s : {}) as Record<string, unknown>;
      const kind = KINDS.has(r.kind as SceneKind) ? (r.kind as SceneKind) : 'statement';
      const items = Array.isArray(r.items) ? r.items.map((x) => str(x, 80)).filter(Boolean).slice(0, kind === 'compare' ? 2 : 4) : undefined;
      return {
        kind,
        voice: str(r.voice, 600).trim(),
        heading: str(r.heading, 120) || undefined,
        sub: str(r.sub, 160) || undefined,
        value: str(r.value, 16) || undefined,
        items: items?.length ? items : undefined,
      };
    })
    .filter((s) => s.voice || s.heading);
  return {
    title: str(raw.title, 120) || 'Untitled Short',
    description: str(raw.description, 2000) || undefined,
    tags: Array.isArray(raw.tags) ? raw.tags.map((t) => str(t, 40)).filter(Boolean).slice(0, 15) : undefined,
    language,
    theme,
    voice,
    captions: raw.captions !== false,
    scenes,
  };
}

export const PRESETS: { id: string; name: string; spec: MotionSpec }[] = [
  {
    id: 'shorts-fail',
    name: 'Why most Shorts fail',
    spec: {
      title: 'Why 90% of Shorts get no views',
      description: 'The 3 mistakes that kill a Short in the first 2 seconds.',
      tags: ['youtube shorts', 'content creation', 'retention'],
      language: 'en',
      theme: 'ember',
      voice: 'en-US-AndrewNeural',
      captions: true,
      scenes: [
        { kind: 'hook', heading: 'Your Short dies in *2 seconds*', voice: 'Your Short has two seconds to live. Here is why most of them die.' },
        { kind: 'stat', value: '90%', heading: 'of viewers swipe before second 3', voice: 'Ninety percent of viewers swipe away before the third second.' },
        { kind: 'list', heading: 'The 3 killers', items: ['Slow intro', 'Static pictures', 'No reason to stay'], voice: 'Three things kill it. A slow intro. Static pictures. And no reason to stay.' },
        { kind: 'compare', heading: 'Fix it', items: ['Pictures + voice', 'Motion every second'], voice: 'Pictures with a voice feel like a slideshow. Motion every second keeps eyes on screen.' },
        { kind: 'statement', heading: 'Open with the *payoff*, not the setup', voice: 'So open with the payoff, not the setup.' },
        { kind: 'cta', heading: 'Follow for part 2', sub: 'Comment SHORTS for the checklist', voice: 'Follow for part two, and comment shorts for the full checklist.' },
      ],
    },
  },
  {
    id: 'did-you-know',
    name: 'Did you know (facts)',
    spec: {
      title: 'The ocean is darker than you think',
      language: 'en',
      theme: 'ocean',
      voice: 'en-US-AvaNeural',
      captions: true,
      scenes: [
        { kind: 'hook', heading: 'We have mapped Mars better than *our ocean*', voice: 'We have better maps of Mars than of our own ocean.' },
        { kind: 'stat', value: '80%', heading: 'of the ocean is unexplored', voice: 'More than eighty percent of the ocean has never been explored.' },
        { kind: 'quote', heading: 'Sunlight stops at 1,000 metres.', voice: 'Below one thousand metres, sunlight stops completely.' },
        { kind: 'list', heading: 'Down there', items: ['No light', 'Crushing pressure', 'Glowing animals'], voice: 'Down there is no light, crushing pressure, and animals that make their own glow.' },
        { kind: 'cta', heading: 'Follow for more', sub: 'One strange fact a day', voice: 'Follow for one strange fact every day.' },
      ],
    },
  },
  {
    id: 'urdu-tip',
    name: 'Urdu tip',
    spec: {
      title: 'Paisay bachane ka asaan tareeqa',
      language: 'ur',
      theme: 'lime',
      voice: 'ur-PK-AsadNeural',
      captions: true,
      scenes: [
        { kind: 'hook', heading: 'تنخواہ آتے ہی *ختم*؟', voice: 'کیا آپ کی تنخواہ آتے ہی ختم ہو جاتی ہے؟' },
        { kind: 'stat', value: '20%', heading: 'پہلے بچت، پھر خرچ', voice: 'تنخواہ آتے ہی بیس فیصد الگ کر دیں۔' },
        { kind: 'list', heading: 'تین آسان قدم', items: ['الگ اکاؤنٹ', 'ہر ماہ خودکار', 'ہاتھ مت لگائیں'], voice: 'الگ اکاؤنٹ بنائیں، ہر مہینے خود بخود پیسے ڈالیں، اور انہیں ہاتھ مت لگائیں۔' },
        { kind: 'cta', heading: 'فالو کریں', sub: 'روز ایک نئی ٹپ', voice: 'ایسی مزید ٹپس کے لیے فالو کریں۔' },
      ],
    },
  },
];
