// Unit tests for the YouTube posting plan helpers. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashtags, nextSlots, type PublishEntry } from '../lib/youtube-publish.ts';

const plan = { times: ['19:00'], audited: false };
const at = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi);

test('next slot is today at the plan time when it is still ahead', () => {
  const [slot] = nextSlots(1, at(2026, 11, 15, 10), [], plan);
  assert.equal(new Date(slot).getTime(), at(2026, 11, 15, 19).getTime());
});

test('a slot in the next 30 minutes or already taken moves to the next day', () => {
  const soon = nextSlots(1, at(2026, 11, 15, 18, 45), [], plan)[0];
  assert.equal(new Date(soon).getTime(), at(2026, 11, 16, 19).getTime());
  const taken: PublishEntry[] = [{ key: 'k', title: 't', method: 'manual', privacy: 'scheduled', publishAt: at(2026, 11, 15, 19).toISOString(), at: at(2026, 11, 14, 9).toISOString() }];
  const next = nextSlots(2, at(2026, 11, 15, 10), taken, plan);
  assert.deepEqual(
    next.map((s) => new Date(s).getTime()),
    [at(2026, 11, 16, 19).getTime(), at(2026, 11, 17, 19).getTime()],
  );
});

test('two posting times a day give two slots a day', () => {
  const slots = nextSlots(3, at(2026, 11, 15, 8), [], { times: ['13:00', '19:00'], audited: true });
  assert.deepEqual(
    slots.map((s) => new Date(s).getTime()),
    [at(2026, 11, 15, 13).getTime(), at(2026, 11, 15, 19).getTime(), at(2026, 11, 16, 13).getTime()],
  );
});

test('hashtags start with #Shorts and are clean', () => {
  assert.deepEqual(hashtags(['pakistan', 'then and now', '#urdu', 'pakistan', 'x']), ['#Shorts', '#pakistan', '#thenandnow', '#urdu']);
});
