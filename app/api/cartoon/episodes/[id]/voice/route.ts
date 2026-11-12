import { NextResponse } from 'next/server';
import { saveAiVoice } from '@/lib/cartoon/store';
import { jsonError, refuseOnVercel } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Makes one line with an AI voice: ?shot=<shotId>, body { provider: 'elevenlabs'|'edge', voiceId, model }.
// ElevenLabs uses credits (about 1 per character with eleven_v4); the free Microsoft voices cost nothing.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const refused = refuseOnVercel();
  if (refused) return refused;
  try {
    const { id } = await context.params;
    const shot = new URL(req.url).searchParams.get('shot') || '';
    const body = await req.json().catch(() => ({}));
    const provider = body.provider === 'edge' ? 'edge' : 'elevenlabs';
    return NextResponse.json(await saveAiVoice(id, shot, { provider, voiceId: String(body.voiceId || ''), model: body.model }));
  } catch (error) {
    return jsonError(error);
  }
}
