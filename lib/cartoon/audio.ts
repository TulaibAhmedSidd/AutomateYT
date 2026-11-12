import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';

// Cleans the owner's recorded lines so they sound like a proper voiceover. Server only.

/** Path of the FFmpeg binary that ships with ffmpeg-static (or FFMPEG_PATH). */
export function ffmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  const exe = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (!fs.existsSync(exe)) throw new Error('FFmpeg was not found in node_modules/ffmpeg-static. Run npm install.');
  return exe;
}

// Rumble cut, gentle noise reduction, loudness levelled for YouTube (-16 LUFS), then silence trimmed at both ends.
// Order matters: loudnorm placed after areverse stalls FFmpeg on short clips, so levelling comes first.
const FILTER = [
  'highpass=f=80',
  'afftdn=nf=-25',
  'loudnorm=I=-16:TP=-1.5:LRA=11',
  'aresample=44100',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08',
  'areverse',
  'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12',
  'areverse',
].join(',');

/**
 * Converts any browser recording (webm/ogg/mp4, video tracks ignored) into a clean mono 128 kbps MP3 and returns its
 * length in seconds. Takes well under a second for a 5-second line, so it is fine to run inside the upload request.
 */
export function cleanRecording(input: string, output: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(
      ffmpegPath(),
      ['-hide_banner', '-nostdin', '-y', '-i', input, '-vn', '-af', FILTER, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '128k', output],
      { windowsHide: true, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 },
      (error, _stdout, stderr) => {
        if (error) {
          fs.rmSync(output, { force: true });
          const reason = String(stderr).split(/\r|\n/).filter((l) => l && !l.startsWith('size=')).pop();
          return reject(new Error(`Could not read the recording (${error.killed ? 'timed out' : reason || error.message})`));
        }
        const times = [...String(stderr).matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
        const last = times[times.length - 1];
        const seconds = last ? Number(last[1]) * 3600 + Number(last[2]) * 60 + Number(last[3]) : (fs.statSync(output).size * 8) / 128_000;
        resolve(Math.round(seconds * 100) / 100);
      },
    );
  });
}
