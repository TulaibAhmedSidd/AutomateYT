import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { readGridFSFile } from '@/lib/storage';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    const file = await readGridFSFile(id);

    return new NextResponse(file.buffer, {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': `inline; filename="${file.filename}"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load media file';
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
