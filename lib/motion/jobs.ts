import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import type { MotionSpec } from './spec';

// Server-only helpers for Motion Graphics render jobs. Jobs live on this PC in storage/motion/<id>.

export const MOTION_DIR = path.join(process.cwd(), 'storage', 'motion');

export type JobStatus = {
  stage: 'queued' | 'voice' | 'bundle' | 'render' | 'done' | 'failed';
  progress: number;
  error?: string | null;
  output?: string;
  bytes?: number;
  seconds?: number;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
  pid?: number | null;
};

export type JobSummary = { id: string; title: string; theme: string; language: string; createdAt: string; status: JobStatus };

const ID_RE = /^[\w-]{3,64}$/;

export function isJobId(id: string) {
  return ID_RE.test(id);
}

export function jobDir(id: string) {
  if (!isJobId(id)) throw new Error('Bad job id');
  return path.join(MOTION_DIR, id);
}

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch {
    return null;
  }
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

export function readStatus(id: string): JobStatus {
  const status = readJson<JobStatus>(path.join(jobDir(id), 'status.json')) || { stage: 'queued', progress: 0 };
  // A render whose process is gone without saying "done" crashed (or the PC restarted).
  if (!['done', 'failed'].includes(status.stage) && status.pid && !processAlive(status.pid)) {
    return { ...status, stage: 'failed', error: status.error || 'The render process stopped unexpectedly.' };
  }
  return status;
}

export function readSpec(id: string): MotionSpec | null {
  const dir = jobDir(id);
  return readJson<MotionSpec>(path.join(dir, 'spec.final.json')) || readJson<MotionSpec>(path.join(dir, 'spec.json'));
}

export function listJobs(): JobSummary[] {
  if (!fs.existsSync(MOTION_DIR)) return [];
  return fs
    .readdirSync(MOTION_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && isJobId(d.name) && fs.existsSync(path.join(MOTION_DIR, d.name, 'spec.json')))
    .map((d) => {
      const spec = readSpec(d.name);
      const createdAt = fs.statSync(path.join(MOTION_DIR, d.name, 'spec.json')).birthtime.toISOString();
      return {
        id: d.name,
        title: spec?.title || d.name,
        theme: spec?.theme || 'ember',
        language: spec?.language || 'en',
        createdAt,
        status: readStatus(d.name),
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createJob(spec: MotionSpec) {
  const slug = spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'short';
  const id = `${new Date().toISOString().slice(0, 10)}-${slug}-${Math.random().toString(36).slice(2, 6)}`;
  const dir = jobDir(id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'spec.json'), JSON.stringify(spec, null, 2));
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ stage: 'queued', progress: 0, updatedAt: new Date().toISOString() }, null, 2));

  const log = fs.openSync(path.join(dir, 'log.txt'), 'a');
  const child = spawn(process.execPath, [path.join(process.cwd(), 'scripts', 'render-motion.mjs'), id], {
    cwd: process.cwd(),
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  child.unref();
  fs.writeFileSync(path.join(dir, 'status.json'), JSON.stringify({ stage: 'queued', progress: 0, pid: child.pid, updatedAt: new Date().toISOString() }, null, 2));
  return id;
}

export function deleteJob(id: string) {
  const status = readStatus(id);
  if (status.pid && processAlive(status.pid) && !['done', 'failed'].includes(status.stage)) {
    try {
      process.kill(status.pid);
    } catch {
      /* already gone */
    }
  }
  fs.rmSync(jobDir(id), { recursive: true, force: true });
}

const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.mp3': 'audio/mpeg', '.json': 'application/json' };

/** Resolve a file inside a job folder (video.mp4 or assets/scene-0.mp3) without letting the path escape it. */
export function jobFile(id: string, parts: string[]) {
  const dir = jobDir(id);
  const full = path.resolve(dir, ...parts);
  if (!full.startsWith(dir + path.sep)) throw new Error('Bad path');
  const type = TYPES[path.extname(full).toLowerCase()];
  if (!type || !fs.existsSync(full)) return null;
  return { full, type, size: fs.statSync(full).size };
}
