// Unit tests for the pure cartoon spec helpers. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SERIES_PRESETS,
  buildShotPrompt,
  episodeFrames,
  newShotId,
  sanitizeEpisode,
  sanitizeSeries,
  shotCountFor,
  shotSeconds,
  shotWords,
  spreadWords,
  spokenText,
  keyShotIds,
  FPS,
  type CartoonShot,
} from '../lib/cartoon/spec.ts';

const shot = (over: Partial<CartoonShot> = {}): CartoonShot => ({
  id: 'abc123',
  narration: 'Mimi found a tiny turtle by the pond',
  characters: ['mimi'],
  scene: 'a pond in a park',
  action: 'Mimi kneels and smiles at a turtle',
  camera: 'push-in',
  ...over,
});

test('shotCountFor gives about one shot per 5 seconds', () => {
  assert.equal(shotCountFor(45), 9);
  assert.equal(shotCountFor(60), 12);
  assert.equal(shotCountFor(75), 15);
});

test('newShotId is 6 lowercase letters or digits', () => {
  for (let i = 0; i < 20; i += 1) assert.match(newShotId(), /^[a-z0-9]{6}$/);
});

test('spreadWords keeps order and stays inside the time', () => {
  const words = spreadWords('a bb ccc', 3);
  assert.equal(words.length, 3);
  assert.deepEqual(words.map((w) => w.text), ['a', 'bb', 'ccc']);
  assert.ok(words[0].start >= 0);
  for (let i = 1; i < words.length; i += 1) assert.ok(words[i].start >= words[i - 1].end - 1e-9);
  assert.ok(words[2].end <= 3 + 1e-9);
  assert.ok(words[2].end - words[2].start > words[0].end - words[0].start, 'longer word gets more time');
});

test('spreadWords handles empty text', () => {
  assert.deepEqual(spreadWords('   ', 2), []);
});

test('shotSeconds uses the recording length plus a short tail', () => {
  const s = shot({ recording: { file: 'abc123.mp3', seconds: 3.2, at: '2026-11-13T00:00:00Z' } });
  assert.equal(Math.round(shotSeconds(s) * 100) / 100, 3.5);
});

test('shotSeconds estimates from words when nothing is recorded, never under 2.4 s', () => {
  assert.ok(shotSeconds(shot()) >= 2.4);
  assert.equal(shotSeconds(shot({ narration: 'Hi' })), 2.4);
  assert.equal(shotSeconds(shot({ duration: 4.1 })), 4.1);
});

test('shotWords spreads words over a recording', () => {
  const words = shotWords(shot({ recording: { file: 'x.mp3', seconds: 3, at: '' } }));
  assert.equal(words.length, 8);
  assert.ok(words[words.length - 1].end <= 3.3);
});

test('episodeFrames is the sum of shot frames, at least one second', () => {
  const ep = sanitizeEpisode({ title: 't', shots: [shot({ duration: 2 }), shot({ id: 'zzz999', duration: 3 })], endHook: '' }, 'little-lessons');
  assert.equal(episodeFrames(ep), 5 * FPS);
  assert.equal(episodeFrames({ ...ep, shots: [] }), FPS);
});

test('sanitizeEpisode fixes bad input', () => {
  const many = Array.from({ length: 30 }, (_, i) => ({ narration: `line ${i}`, camera: 'spin-wildly', characters: ['mimi', 7] }));
  const ep = sanitizeEpisode({ title: 'x'.repeat(500), shots: many, endHook: 'Next time!' }, 'little-lessons');
  assert.equal(ep.shots.length, 20);
  assert.equal(ep.shots[0].camera, 'static');
  assert.deepEqual(ep.shots[0].characters, ['mimi']);
  assert.ok(ep.title.length <= 120);
  assert.equal(ep.seriesId, 'little-lessons');
  assert.match(ep.shots[0].id, /^[a-z0-9]{6}$/);
});

test('sanitizeEpisode keeps valid shot ids, recordings and keyframes', () => {
  const rec = { file: 'abc123.mp3', seconds: 2.5, at: '2026-11-13T00:00:00Z' };
  const ep = sanitizeEpisode({ title: 'T', shots: [shot({ recording: rec, keyframe: 'abc123.png' })], endHook: '' }, 'little-lessons');
  assert.equal(ep.shots[0].id, 'abc123');
  assert.deepEqual(ep.shots[0].recording, rec);
  assert.equal(ep.shots[0].keyframe, 'abc123.png');
});

test('sanitizeEpisode rejects unsafe file names', () => {
  const ep = sanitizeEpisode(
    { title: 'T', shots: [shot({ keyframe: '../../.env', recording: { file: '..\\x.mp3', seconds: 1, at: '' } })], endHook: '' },
    'little-lessons',
  );
  assert.equal(ep.shots[0].keyframe, undefined);
  assert.equal(ep.shots[0].recording, undefined);
});

test('buildShotPrompt includes the right character look only', () => {
  const series = SERIES_PRESETS.find((s) => s.id === 'little-lessons');
  assert.ok(series);
  const other = series.characters.find((c) => c.id !== 'mimi');
  assert.ok(other, 'preset has a second character');
  const prompt = buildShotPrompt(series, shot());
  const mimi = series.characters.find((c) => c.id === 'mimi');
  assert.ok(mimi && prompt.includes(mimi.look));
  assert.ok(!prompt.includes(other.look));
  assert.ok(prompt.includes(series.style));
  assert.ok(prompt.includes('a pond in a park'));
});

test('every preset survives sanitizeSeries unchanged', () => {
  assert.equal(SERIES_PRESETS.length, 4);
  for (const preset of SERIES_PRESETS) assert.deepEqual(sanitizeSeries(preset), preset);
});

test('the Islamic preset forbids showing holy figures', () => {
  const islamic = SERIES_PRESETS.find((s) => s.id === 'stories-of-light');
  assert.ok(islamic);
  assert.ok(islamic.rules.some((r) => /never show/i.test(r) && /prophet/i.test(r)));
});

test('ElevenLabs voice settings are kept only when valid', () => {
  const ok = sanitizeSeries({ name: 'X', voice: { provider: 'elevenlabs', elevenVoiceId: 'TX3LPaxmHKxFdv7VOQHJ', elevenModel: 'eleven_v4_turbo' } });
  assert.deepEqual(ok.voice, { provider: 'elevenlabs', edgeVoice: 'en-US-AndrewNeural', elevenVoiceId: 'TX3LPaxmHKxFdv7VOQHJ', elevenModel: 'eleven_v4_turbo' });
  const noVoice = sanitizeSeries({ name: 'X', voice: { provider: 'elevenlabs', elevenVoiceId: 'bad id!' } });
  assert.equal(noVoice.voice.provider, 'recorded');
  assert.equal(noVoice.voice.elevenVoiceId, undefined);
});

test('audio tags are spoken as sounds but never shown in captions', () => {
  assert.equal(spokenText('[laughs] Hello there! [sighs] Bye'), 'Hello there! Bye');
  assert.deepEqual(spreadWords('[laughs] a bb', 2).map((w) => w.text), ['a', 'bb']);
});

test('key moments: ticked shots, or hook, middle and ending', () => {
  const ep = sanitizeEpisode({ title: 'T', endHook: '', shots: Array.from({ length: 12 }, (_, i) => ({ id: `s${String(i).padStart(5, '0')}`, narration: `line ${i}` })) }, 'x');
  assert.deepEqual(keyShotIds(ep), [ep.shots[0].id, ep.shots[6].id, ep.shots[11].id]);
  ep.shots[2].animate = true;
  assert.deepEqual(keyShotIds(ep), [ep.shots[2].id]);
  const one = sanitizeEpisode({ title: 'T', endHook: '', shots: [{ narration: 'only' }] }, 'x');
  assert.equal(keyShotIds(one).length, 1);
});

test('sanitizeSeries fills defaults and clamps', () => {
  const s = sanitizeSeries({ id: '../evil', name: '', language: 'fr', characters: [{ name: 'A' }], episodeSeconds: 999 });
  assert.match(s.id, /^[\w-]{3,64}$/);
  assert.equal(s.language, 'en');
  assert.equal(s.episodeSeconds, 60);
  assert.equal(s.characters[0].id.length > 0, true);
  assert.equal(s.voice.provider, 'recorded');
});
