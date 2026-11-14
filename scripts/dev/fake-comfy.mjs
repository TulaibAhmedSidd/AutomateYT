#!/usr/bin/env node
// A fake ComfyUI for testing the cartoon worker on a PC without a GPU.
//   node scripts/dev/fake-comfy.mjs [port]      then run the worker with COMFY_URL=http://127.0.0.1:<port>
// Answers /system_stats, /upload/image, /prompt, /history, /view and /object_info like ComfyUI does.
// Video workflows get a 2-second moving test clip; picture workflows get a test PNG (made with FFmpeg).
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const port = Number(process.argv[2] || 8199);
// Seconds each fake job takes (FAKE_COMFY_SECONDS=8 to watch the studio's progress panel).
const jobMs = Number(process.env.FAKE_COMFY_SECONDS || 1.5) * 1000;
const ffmpeg = path.join(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-comfy-'));
const clip = path.join(dir, 'clip.mp4');
const still = path.join(dir, 'still.png');
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=s=480x832:r=24:d=2.04', '-pix_fmt', 'yuv420p', clip]);
execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'gradients=s=480x832:d=1', '-frames:v', '1', still]);

const prompts = new Map();
let n = 0;
const json = (res, data, status = 200) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(data));
};

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (url.pathname === '/system_stats') return json(res, { devices: [{ name: 'Fake GPU (test)', vram_total: 8 * 1024 ** 3, vram_free: 7 * 1024 ** 3 }] });
      if (url.pathname === '/upload/image') return json(res, { name: `upload-${(n += 1)}.png`, subfolder: '', type: 'input' });
      if (url.pathname === '/prompt' && req.method === 'POST') {
        const { prompt } = JSON.parse(body);
        const isVideo = Object.values(prompt).some((node) => node.class_type === 'SaveVideo');
        const unresolved = JSON.stringify(prompt).match(/\{\{\w+\}\}/);
        if (unresolved) return json(res, { error: { message: `unfilled token ${unresolved[0]}` } }, 400);
        const id = `p${(n += 1)}`;
        prompts.set(id, { at: Date.now(), isVideo });
        console.log(`[fake-comfy] queued ${id} (${isVideo ? 'video' : 'picture'})`);
        return json(res, { prompt_id: id, number: n });
      }
      if (url.pathname.startsWith('/history/')) {
        const id = url.pathname.split('/').pop();
        const p = prompts.get(id);
        if (!p || Date.now() - p.at < jobMs) return json(res, {});
        return json(res, {
          [id]: {
            status: { status_str: 'success', completed: true },
            outputs: { 9: { images: [{ filename: p.isVideo ? 'clip.mp4' : 'still.png', subfolder: '', type: 'output' }] } },
          },
        });
      }
      if (url.pathname === '/view') {
        const file = url.searchParams.get('filename') === 'clip.mp4' ? clip : still;
        res.writeHead(200, { 'content-type': file.endsWith('.mp4') ? 'video/mp4' : 'image/png' });
        return fs.createReadStream(file).pipe(res);
      }
      if (url.pathname.startsWith('/object_info/')) return json(res, {});
      json(res, { error: 'not found' }, 404);
    });
  })
  .listen(port, () => console.log(`[fake-comfy] listening on http://127.0.0.1:${port}`));
