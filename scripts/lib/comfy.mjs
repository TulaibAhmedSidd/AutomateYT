// ComfyUI client for the cartoon worker (home GPU PC). Talks to ComfyUI's HTTP API, starts ComfyUI when it is not
// running (COMFY_START), fills {{TOKENS}} in comfy/workflows/*.api.json, waits for the result and downloads it.
//   COMFY_URL   default http://127.0.0.1:8188 (ComfyUI Desktop usually uses http://127.0.0.1:8000)
//   COMFY_START optional: full path of the ComfyUI launcher (.exe or .bat) to start it automatically
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Base URL of ComfyUI, without a trailing slash. */
export function comfyUrl() {
  return (process.env.COMFY_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '');
}

/** Path of a workflow file, e.g. workflowPath('clip') → comfy/workflows/clip.api.json. */
export function workflowPath(name) {
  return path.join(ROOT, 'comfy', 'workflows', `${name}.api.json`);
}

/** True when the workflow file exists (the keyframe one is made on the GPU PC). */
export function hasWorkflow(name) {
  return fs.existsSync(workflowPath(name));
}

/** GPU and version info from ComfyUI, or null when it is not reachable. */
export async function comfyStats() {
  try {
    const res = await fetch(`${comfyUrl()}/system_stats`, { signal: AbortSignal.timeout(4000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

/**
 * Makes sure ComfyUI is running. If not and COMFY_START is set, starts it (hidden, detached) and waits up to
 * 4 minutes for it to answer. Throws a plain-English error when it cannot be reached.
 */
export async function ensureComfy(onNote = () => {}) {
  if (await comfyStats()) return;
  const start = process.env.COMFY_START;
  if (!start || !fs.existsSync(start)) {
    throw new Error(
      `ComfyUI is not running at ${comfyUrl()}. Start ComfyUI first, or set COMFY_START in .env.local to its launcher so the app can start it.`,
    );
  }
  onNote('Starting ComfyUI…');
  const isBat = /\.(bat|cmd)$/i.test(start);
  const child = spawn(isBat ? 'cmd.exe' : start, isBat ? ['/c', start] : [], {
    cwd: path.dirname(start),
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  });
  child.unref();
  for (let i = 0; i < 48; i += 1) {
    await sleep(5000);
    if (await comfyStats()) return;
  }
  throw new Error(`Started ComfyUI but it did not answer at ${comfyUrl()} within 4 minutes. Check COMFY_URL (ComfyUI Desktop uses port 8000).`);
}

/** Uploads a local image into ComfyUI's input folder and returns the name to use in LoadImage. */
export async function uploadImage(file) {
  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(file)]), `automateyt-${path.basename(file)}`);
  form.append('overwrite', 'true');
  const res = await fetch(`${comfyUrl()}/upload/image`, { method: 'POST', body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.name) throw new Error(`ComfyUI image upload failed (HTTP ${res.status})`);
  return data.subfolder ? `${data.subfolder}/${data.name}` : data.name;
}

/** Loads a workflow and fills tokens. "{{X}}" as a whole value becomes the raw value (numbers stay numbers). */
export function fillWorkflow(name, tokens) {
  const wf = JSON.parse(fs.readFileSync(workflowPath(name), 'utf8'));
  const fill = (v) => {
    if (typeof v === 'string') {
      const whole = /^\{\{(\w+)\}\}$/.exec(v);
      if (whole && whole[1] in tokens) return tokens[whole[1]];
      return v.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? String(tokens[k]) : m));
    }
    if (Array.isArray(v)) return v.map(fill);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, fill(x)]));
    return v;
  };
  return fill(wf);
}

/** First output file of a finished prompt (videos and images both come back in the outputs list). */
function firstOutput(entry) {
  for (const node of Object.values(entry.outputs || {})) {
    for (const key of ['videos', 'gifs', 'images']) {
      const f = node[key]?.[0];
      if (f?.filename) return f;
    }
  }
  return null;
}

/**
 * Runs a workflow and saves its first output to `outFile`. Polls every 5 s until done or `timeoutMin` passes.
 * onTick(minutes) is called while waiting so the worker can show progress.
 */
export async function runWorkflow(name, tokens, outFile, { timeoutMin = 90, onTick = () => {} } = {}) {
  const prompt = fillWorkflow(name, tokens);
  const res = await fetch(`${comfyUrl()}/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt, client_id: 'automateyt' }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.prompt_id) {
    const why = data?.error?.message || JSON.stringify(data?.node_errors || data).slice(0, 300);
    throw new Error(`ComfyUI refused the ${name} workflow: ${why}`);
  }
  const started = Date.now();
  for (;;) {
    await sleep(5000);
    const minutes = (Date.now() - started) / 60000;
    onTick(minutes);
    if (minutes > timeoutMin) throw new Error(`ComfyUI ${name} took longer than ${timeoutMin} minutes`);
    const h = await fetch(`${comfyUrl()}/history/${data.prompt_id}`).then((r) => r.json()).catch(() => ({}));
    const entry = h[data.prompt_id];
    if (!entry) continue;
    if (entry.status?.status_str === 'error') {
      const msg = (entry.status.messages || []).find((m) => m[0] === 'execution_error')?.[1];
      throw new Error(`ComfyUI ${name} failed: ${msg?.exception_message || 'see the ComfyUI window'}`);
    }
    const out = firstOutput(entry);
    if (!out) {
      if (entry.status?.completed) throw new Error(`ComfyUI ${name} finished without an output file`);
      continue;
    }
    const q = new URLSearchParams({ filename: out.filename, subfolder: out.subfolder || '', type: out.type || 'output' });
    const file = await fetch(`${comfyUrl()}/view?${q}`);
    if (!file.ok) throw new Error(`Could not download the ${name} result from ComfyUI`);
    fs.writeFileSync(outFile, Buffer.from(await file.arrayBuffer()));
    return { seconds: (Date.now() - started) / 1000 };
  }
}
