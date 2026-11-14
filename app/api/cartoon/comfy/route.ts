import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Is ComfyUI ready on this PC? Used by the studio to say which video modes can run here.
// { reachable, url, gpu, canAutoStart, workflows: { clip, keyframe } }. Free and fast (4 s timeout).
export async function GET() {
  const url = (process.env.COMFY_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '');
  const start = process.env.COMFY_START || '';
  const wf = (name: string) => fs.existsSync(path.join(process.cwd(), 'comfy', 'workflows', `${name}.api.json`));
  let gpu: string | null = null;
  let reachable = false;
  try {
    const res = await fetch(`${url}/system_stats`, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (res.ok) {
      reachable = true;
      const data = await res.json();
      const d = data?.devices?.[0];
      if (d) gpu = `${d.name} · ${(d.vram_total / 1024 ** 3).toFixed(0)} GB`;
    }
  } catch {
    /* not running */
  }
  return NextResponse.json(
    { reachable, url, gpu, canAutoStart: Boolean(start && fs.existsSync(start)), workflows: { clip: wf('clip'), keyframe: wf('keyframe') } },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
