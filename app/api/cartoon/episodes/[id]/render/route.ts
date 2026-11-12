import { NextResponse } from 'next/server';
import { startRender } from '@/lib/cartoon/store';
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
    startRender(id, { allowAiVoice: body.allowAiVoice === true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
