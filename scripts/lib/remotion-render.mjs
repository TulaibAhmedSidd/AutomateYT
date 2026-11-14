// Bundles the Remotion project and renders one composition to MP4. Shared by the Motion and Cartoon workers.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

/** Uses an already-installed headless Chrome when there is one, so nothing extra is downloaded. Undefined = Remotion downloads its own. */
export function findBrowser() {
  if (process.env.REMOTION_BROWSER && fs.existsSync(process.env.REMOTION_BROWSER)) return process.env.REMOTION_BROWSER;
  const base = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  if (!fs.existsSync(base)) return undefined;
  const dirs = fs
    .readdirSync(base)
    .filter((d) => d.startsWith('chromium_headless_shell-'))
    .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
  for (const d of dirs) {
    for (const sub of ['chrome-headless-shell-win64', 'chrome-win']) {
      const exe = path.join(base, d, sub, 'chrome-headless-shell.exe');
      if (fs.existsSync(exe)) return exe;
    }
  }
  return undefined;
}

/**
 * Bundles `entry` with `publicDir` as the static folder (staticFile('x.mp3')) and renders composition `id` to `out`.
 * The bundle goes to the OS temp folder: inside the job folder it would copy itself forever.
 * Headless Chrome now and then crashes a tab ("Page crashed!"), so a failed render is retried once with one tab.
 * onStage(stage, extra) is called with 'bundle' and 'render'; onProgress(p) gets 0–1 for each.
 */
export async function renderComposition({ entry, publicDir, id, inputProps, out, onStage = () => {}, onProgress = () => {} }) {
  fs.mkdirSync(publicDir, { recursive: true });
  onStage('bundle');
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'remotion-bundle-'));
  try {
    const serveUrl = await bundle({ entryPoint: entry, publicDir, outDir: bundleDir, onProgress: (p) => onProgress(p / 100) });
    const browserExecutable = findBrowser();
    // Headless Chrome sometimes fails to start ("Failed to launch the browser process!"), often right after
    // another render or a heavy ComfyUI job. Waiting a few seconds and trying again fixes it, so try 3 times.
    let composition;
    for (let attempt = 1; ; attempt += 1) {
      try {
        composition = await selectComposition({ serveUrl, id, inputProps, browserExecutable });
        break;
      } catch (e) {
        if (attempt >= 3 || !/launch the browser|browser process|Target closed|ECONNRESET/i.test(String(e?.message || e))) throw e;
        console.error(`Browser start failed (try ${attempt} of 3), trying again in ${attempt * 4} s:`, e?.message || e);
        await new Promise((r) => setTimeout(r, attempt * 4000));
      }
    }
    onStage('render', { frames: composition.durationInFrames, seconds: composition.durationInFrames / composition.fps });
    const tries = [Math.max(1, Math.min(4, Math.floor(os.cpus().length / 3))), 1];
    for (let attempt = 0; attempt < tries.length; attempt += 1) {
      let last = 0;
      try {
        await renderMedia({
          composition,
          serveUrl,
          codec: 'h264',
          crf: 20,
          outputLocation: out,
          inputProps,
          browserExecutable,
          concurrency: tries[attempt],
          onProgress: ({ progress }) => {
            if (progress - last >= 0.02 || progress === 1) {
              last = progress;
              onProgress(progress);
            }
          },
        });
        break;
      } catch (e) {
        if (attempt === tries.length - 1) throw e;
        console.error(`Render attempt ${attempt + 1} failed, retrying:`, e?.message || e);
        onStage('render', { note: 'Retrying after a browser crash' });
      }
    }
    return { frames: composition.durationInFrames, fps: composition.fps };
  } finally {
    fs.rmSync(bundleDir, { recursive: true, force: true });
  }
}
