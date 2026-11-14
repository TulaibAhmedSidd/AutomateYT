// Unit tests for the Motion Graphics spec helpers. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { PRESETS, isElevenVoice, sanitizeSpec, sceneSeconds } from '../lib/motion/spec.ts';

test('timeline points are kept, trimmed and capped at 6', () => {
  const points = Array.from({ length: 9 }, (_, i) => ({ label: ` ${1950 + i * 10} `, value: `${i + 1} crore` }));
  const spec = sanitizeSpec({ title: 'T', scenes: [{ kind: 'timeline', voice: 'v', points: [...points, { label: '', value: 'x' }] }] });
  assert.equal(spec.scenes[0].points?.length, 6);
  assert.deepEqual(spec.scenes[0].points?.[0], { label: '1950', value: '1 crore' });
});

test('points are dropped from scenes that are not timelines', () => {
  const spec = sanitizeSpec({ title: 'T', scenes: [{ kind: 'stat', voice: 'v', value: '9%', points: [{ label: '1', value: '2' }] }] });
  assert.equal(spec.scenes[0].points, undefined);
});

test('ElevenLabs voices and series tags survive; bad ones fall back', () => {
  assert.equal(isElevenVoice('eleven:JBFqnCBsd6RMkjVDRZzb'), true);
  assert.equal(isElevenVoice('eleven:../../x'), false);
  const ok = sanitizeSpec({ title: 'T', voice: 'eleven:JBFqnCBsd6RMkjVDRZzb', elevenModel: 'eleven_v4', series: 'pakistan-tab-aur-ab', episode: 3, scenes: [{ voice: 'v' }] });
  assert.equal(ok.voice, 'eleven:JBFqnCBsd6RMkjVDRZzb');
  assert.equal(ok.elevenModel, 'eleven_v4');
  assert.equal(ok.series, 'pakistan-tab-aur-ab');
  assert.equal(ok.episode, 3);
  const bad = sanitizeSpec({ title: 'T', language: 'ur', voice: 'eleven:bad id', elevenModel: 'x', series: '../x', episode: -1, scenes: [{ voice: 'v' }] });
  assert.equal(bad.voice, 'ur-PK-AsadNeural');
  assert.equal(bad.elevenModel, undefined);
  assert.equal(bad.series, undefined);
  assert.equal(bad.episode, undefined);
});

test('a timeline lasts long enough to read every step', () => {
  const points = Array.from({ length: 6 }, (_, i) => ({ label: String(2000 + i), value: String(i) }));
  assert.ok(sceneSeconds({ kind: 'timeline', voice: 'short', points }) >= 6 * 1.3);
  assert.ok(sceneSeconds({ kind: 'timeline', voice: 'short', points, duration: 3 }) >= 6 * 1.3);
});

test('every preset and every series episode survives sanitizeSpec unchanged in shape', () => {
  for (const p of PRESETS) assert.equal(sanitizeSpec(p.spec).scenes.length, p.spec.scenes.length, p.id);
  const dir = 'content/motion/series';
  for (const f of fs.readdirSync(dir)) {
    const series = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
    series.episodes.forEach((ep: { scenes: unknown[] }, i: number) => {
      const spec = sanitizeSpec({ ...ep, language: series.language, voice: series.voice });
      assert.equal(spec.scenes.length, ep.scenes.length, `${f} episode ${i + 1}`);
      const tl = spec.scenes.find((s) => s.kind === 'timeline');
      assert.ok(tl?.points && tl.points.length >= 3, `${f} episode ${i + 1} has a timeline`);
    });
  }
});
