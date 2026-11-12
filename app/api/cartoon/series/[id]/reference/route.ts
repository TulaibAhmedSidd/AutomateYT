import { NextResponse } from 'next/server';
import { imageExt, saveReference } from '@/lib/cartoon/store';
import { jsonError } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Uploads a character's reference picture. Body = the image bytes; ?character=<id>.
export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const character = new URL(req.url).searchParams.get('character') || '';
    const ext = imageExt(req.headers.get('content-type'));
    const bytes = Buffer.from(await req.arrayBuffer());
    return NextResponse.json({ series: saveReference(id, character, bytes, ext) });
  } catch (error) {
    return jsonError(error);
  }
}
