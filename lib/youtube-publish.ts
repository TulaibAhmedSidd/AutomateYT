import fs from 'fs';
import path from 'path';

// What has gone to YouTube and when the next video should go up. Server only.
// storage/youtube/log.json  = every video posted or scheduled (from the app, or marked by hand after a Studio upload)
// storage/youtube/plan.json = the posting plan: which times of day to post, and whether the Google project passed
//                             YouTube's API audit (until then YouTube keeps app uploads private, even scheduled ones).

const DIR = path.join(process.cwd(), 'storage', 'youtube');
const LOG = path.join(DIR, 'log.json');
const PLAN = path.join(DIR, 'plan.json');

export type PublishEntry = {
  /** 'motion:<seriesId>#<n>' for a series episode, 'motion-job:<jobId>' for a single video, 'cartoon:<episodeId>'. */
  key: string;
  title: string;
  /** 'api' = uploaded by the app; 'manual' = the owner uploaded in YouTube Studio and marked it here. */
  method: 'api' | 'manual';
  privacy: 'private' | 'unlisted' | 'public' | 'scheduled';
  /** When it goes (or went) public. */
  publishAt?: string;
  videoId?: string;
  url?: string;
  /** When it was recorded here. */
  at: string;
};

export type PostingPlan = {
  /** Times of day ("HH:MM", this PC's clock) to post; one video per time. */
  times: string[];
  /** The owner says the Google project passed YouTube's API audit, so app uploads can be public or scheduled. */
  audited: boolean;
};

const DEFAULT_PLAN: PostingPlan = { times: ['19:00'], audited: false };

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

export function readLog(): PublishEntry[] {
  return readJson<{ entries: PublishEntry[] }>(LOG, { entries: [] }).entries;
}

export function findEntry(key: string) {
  return readLog().find((e) => e.key === key) || null;
}

/** Records a post (replaces an older record of the same video). */
export function addEntry(entry: PublishEntry) {
  const entries = readLog().filter((e) => e.key !== entry.key);
  entries.push(entry);
  writeJson(LOG, { entries });
}

/** Forgets a record (only for mistakes: it does not touch the video on YouTube). */
export function removeEntry(key: string) {
  writeJson(LOG, { entries: readLog().filter((e) => e.key !== key) });
}

export function readPlan(): PostingPlan {
  const p = readJson<Partial<PostingPlan>>(PLAN, {});
  const times = (Array.isArray(p.times) ? p.times : DEFAULT_PLAN.times).filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t));
  return { times: times.length ? [...new Set(times)].sort() : DEFAULT_PLAN.times, audited: p.audited === true };
}

export function savePlan(input: Partial<PostingPlan>) {
  const cur = readPlan();
  const next = { ...cur, ...input };
  writeJson(PLAN, next);
  return readPlan();
}

/** When an entry goes (or went) live. */
function liveAt(e: PublishEntry) {
  return Date.parse(e.publishAt || e.at);
}

/**
 * The next free posting times from the plan: today and the following days at each plan time, skipping times in
 * the next 30 minutes and times already taken by a post within 3 hours of them.
 */
export function nextSlots(count = 3, now = new Date(), entries = readLog(), plan = readPlan()): string[] {
  const taken = entries.map(liveAt).filter((t) => Number.isFinite(t));
  const out: string[] = [];
  for (let day = 0; day < 60 && out.length < count; day += 1) {
    for (const time of plan.times) {
      const [h, m] = time.split(':').map(Number);
      const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, h, m, 0, 0);
      if (slot.getTime() < now.getTime() + 30 * 60_000) continue;
      if (taken.some((t) => Math.abs(t - slot.getTime()) < 3 * 3600_000)) continue;
      out.push(slot.toISOString());
      if (out.length >= count) break;
    }
  }
  return out;
}

/** Hashtags for the description: #Shorts first, then the tags as hashtags (letters and digits only). */
export function hashtags(tags: string[], max = 5) {
  const clean = tags
    .map((t) => t.replace(/^#/, '').replace(/[^\p{L}\p{N}]+/gu, ''))
    .filter((t) => t.length > 1);
  return ['#Shorts', ...[...new Set(clean)].slice(0, max - 1).map((t) => `#${t}`)];
}
