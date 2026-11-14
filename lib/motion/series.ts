import fs from 'fs';
import path from 'path';
import { listJobs, type JobStatus } from './jobs';
import { sanitizeSpec, type MotionSpec } from './spec';
import { readLog, type PublishEntry } from '../youtube-publish';

// Server only. Motion graphics series: ready-written episodes kept in git under content/motion/series/<id>.json.
// The owner opens an episode in Motion Studio, checks the numbers, and renders it. Which episodes are made is
// read from the render jobs (each job's spec remembers its series and episode number).

const SERIES_DIR = path.join(process.cwd(), 'content', 'motion', 'series');

export type MotionSeriesEpisode = {
  number: number;
  spec: MotionSpec;
  /** Facts to check against a live source before posting (prices change). */
  check?: string;
  /** Newest render of this episode, if any. */
  job?: { id: string; status: JobStatus };
  /** Posted or scheduled on YouTube (from the publish log; survives re-renders). */
  post?: PublishEntry;
};

export type MotionSeries = {
  id: string;
  name: string;
  description: string;
  language: 'en' | 'ur';
  episodes: MotionSeriesEpisode[];
};

type RawSeries = {
  id?: string;
  name?: string;
  description?: string;
  language?: string;
  theme?: string;
  voice?: string;
  elevenModel?: string;
  episodes?: (Record<string, unknown> & { check?: string })[];
};

/** Every series with its episodes (full specs) and the newest render of each. */
export function listMotionSeries(): MotionSeries[] {
  if (!fs.existsSync(SERIES_DIR)) return [];
  const jobs = listJobs();
  const log = readLog();
  return fs
    .readdirSync(SERIES_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(SERIES_DIR, f), 'utf8')) as RawSeries;
      const id = path.basename(f, '.json');
      const language = raw.language === 'ur' ? 'ur' : 'en';
      const episodes = (raw.episodes || []).map((ep, i) => {
        const number = i + 1;
        // Series-wide look and voice; an episode may override them.
        const spec = sanitizeSpec({ theme: raw.theme, voice: raw.voice, elevenModel: raw.elevenModel, ...ep, language, series: id, episode: number });
        // Prefer the newest finished render, else the newest render of any state.
        const mine = jobs.filter((j) => j.series === id && j.episode === number);
        const job = mine.find((j) => j.status.stage === 'done') || mine[0];
        const post = log.find((e) => e.key === `motion:${id}#${number}`);
        return {
          number,
          spec,
          check: typeof ep.check === 'string' ? ep.check : undefined,
          job: job && { id: job.id, status: job.status },
          ...(post ? { post } : {}),
        };
      });
      return { id, name: raw.name || id, description: raw.description || '', language, episodes } satisfies MotionSeries;
    });
}
