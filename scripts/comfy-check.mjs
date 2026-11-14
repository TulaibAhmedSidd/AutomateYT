#!/usr/bin/env node
// npm run comfy:check — is ComfyUI ready for Cartoon Studio? Prints GPU, VRAM, workflows and missing model files.
import fs from 'node:fs';
import path from 'node:path';
import { comfyStats, comfyUrl, hasWorkflow, workflowPath } from './lib/comfy.mjs';

// Load .env.local the same way the app does (only the keys this check needs).
const envFile = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = /^(COMFY_URL|COMFY_START)=(.*)$/.exec(line.trim());
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

const ok = (b) => (b ? '✅' : '❌');
console.log(`ComfyUI address (COMFY_URL): ${comfyUrl()}`);
console.log(`Auto-start (COMFY_START): ${process.env.COMFY_START ? `${process.env.COMFY_START} ${ok(fs.existsSync(process.env.COMFY_START))}` : 'not set (start ComfyUI by hand)'}`);

const stats = await comfyStats();
console.log(`${ok(stats)} ComfyUI reachable`);
if (stats) {
  for (const d of stats.devices || []) {
    console.log(`   GPU: ${d.name} · VRAM ${(d.vram_total / 1024 ** 3).toFixed(1)} GB (free ${(d.vram_free / 1024 ** 3).toFixed(1)} GB)`);
  }
}

for (const name of ['picture', 'keyframe', 'clip']) {
  console.log(`${ok(hasWorkflow(name))} workflow ${name}.api.json${hasWorkflow(name) ? '' : name === 'clip' ? '' : ' (AI pictures off until it exists: uploaded or character pictures are used)'}`);
  if (!hasWorkflow(name) || !stats) continue;
  // Check every model file the workflow names is known to ComfyUI.
  const wf = JSON.parse(fs.readFileSync(workflowPath(name), 'utf8'));
  for (const node of Object.values(wf)) {
    for (const [key, value] of Object.entries(node.inputs || {})) {
      if (!/_name$/.test(key) || typeof value !== 'string' || value.includes('{{')) continue;
      const info = await fetch(`${comfyUrl()}/object_info/${node.class_type}`).then((r) => r.json()).catch(() => ({}));
      const options = info?.[node.class_type]?.input?.required?.[key]?.[0];
      const found = Array.isArray(options) ? options.includes(value) : null;
      console.log(`   ${found === null ? '❔' : ok(found)} ${node.class_type}: ${value}`);
    }
  }
}
if (!stats) process.exit(1);
