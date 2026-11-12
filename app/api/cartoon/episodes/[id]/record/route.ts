import { NextResponse } from 'next/server';
import { deleteRecording, saveRecording } from '@/lib/cartoon/store';
import { jsonError } from '@/lib/cartoon/http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Ctx = { params: Promise<{ id: string }> };

// Uploads the owner's recorded line for one shot. Body = audio bytes (webm/ogg/mp4/mp3); ?shot=<shotId>.
// The audio is cleaned to MP3 right away (well under a second), so preview and render use the same file.
export async function POST(req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const shot = new URL(req.url).searchParams.get('shot') || '';
    const bytes = Buffer.from(await req.arrayBuffer());
    return NextResponse.json(await saveRecording(id, shot, bytes));
  } catch (error) {
    return jsonError(error);
  }
}

// Removes one shot's recording. ?shot=<shotId>
export async function DELETE(req: Request, context: Ctx) {
  try {
    const { id } = await context.params;
    const shot = new URL(req.url).searchParams.get('shot') || '';
    return NextResponse.json({ episode: deleteRecording(id, shot) });
  } catch (error) {
    return jsonError(error);
  }
}
