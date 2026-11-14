import { NextResponse } from 'next/server';
import { startRender, stopRender } from '@/lib/cartoon/store';
import { jsonError, refuseOnVercel } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Starts rendering the episode in a background process: { allowAiVoice }.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const refused = refuseOnVercel();
  if (refused) return refused;
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === 'key-shots' || body.mode === 'animated' ? body.mode : 'pictures';
    startRender(id, { allowAiVoice: body.allowAiVoice === true, mode });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

// Stops a running render (worker, its Chrome/FFmpeg, and the current ComfyUI job). Work already made is kept.
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const refused = refuseOnVercel();
  if (refused) return refused;
  try {
    const { id } = await context.params;
    await stopRender(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
