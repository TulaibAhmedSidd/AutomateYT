import { NextResponse } from 'next/server';
import { deleteKeyframe, imageExt, saveKeyframe } from '@/lib/cartoon/store';
import { jsonError } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// Uploads a picture for one shot. Body = image bytes; ?shot=<shotId>.
export async function POST(req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const shot = new URL(req.url).searchParams.get('shot') || '';
    const ext = imageExt(req.headers.get('content-type'));
    const bytes = Buffer.from(await req.arrayBuffer());
    return NextResponse.json({ episode: saveKeyframe(id, shot, bytes, ext) });
  } catch (error) {
    return jsonError(error);
  }
}

// Removes one shot's picture. ?shot=<shotId>
export async function DELETE(req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const shot = new URL(req.url).searchParams.get('shot') || '';
    return NextResponse.json({ episode: deleteKeyframe(id, shot) });
  } catch (error) {
    return jsonError(error);
  }
}
