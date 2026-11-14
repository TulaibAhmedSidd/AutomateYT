// Sound effects for transition reels, made on this PC with FFmpeg (no downloads, no copyright).
// whoosh = a short swish on every era change; impact = a deep hit when the last stage ("today") lands.
// Made once into storage/sfx/ and reused. The owner adds trending music in the Instagram / YouTube app.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RECIPES = {
  'sfx-whoosh.mp3': ['-f', 'lavfi', '-i', 'anoisesrc=d=0.7:c=pink:a=0.55', '-af', 'highpass=f=350,lowpass=f=5000,afade=t=in:d=0.4,afade=t=out:st=0.45:d=0.25,volume=1.6'],
  'sfx-impact.mp3': ['-f', 'lavfi', '-i', 'aevalsrc=sin(2*PI*(70-45*t)*t)*exp(-4.5*t):d=1.2', '-af', 'lowpass=f=900,volume=2.2'],
};

/** Makes the effects if missing; returns { whoosh, impact } as file paths. */
export function ensureSfx(root) {
  const dir = path.join(root, 'storage', 'sfx');
  fs.mkdirSync(dir, { recursive: true });
  const ffmpeg = path.join(root, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  for (const [name, args] of Object.entries(RECIPES)) {
    const out = path.join(dir, name);
    if (fs.existsSync(out)) continue;
    const r = spawnSync(ffmpeg, ['-y', '-hide_banner', '-loglevel', 'error', '-nostdin', ...args, '-ar', '44100', '-ac', '2', '-b:a', '160k', out], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`Could not make ${name}: ${r.stderr || r.error}`);
  }
  return { whoosh: path.join(dir, 'sfx-whoosh.mp3'), impact: path.join(dir, 'sfx-impact.mp3') };
}
