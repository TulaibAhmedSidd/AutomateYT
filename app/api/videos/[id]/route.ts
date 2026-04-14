import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { hydrateVideoRuntime } from '@/lib/video-runtime';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await connectToDatabase();

    const video = await Video.findById(id).lean();
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const runtime = await hydrateVideoRuntime(video as Record<string, unknown>);
    return NextResponse.json({
      ...video,
      ...runtime,
      failedStep: runtime.status === 'failed' ? runtime.failedStep : '',
      failedTool: runtime.status === 'failed' ? runtime.failedTool : '',
      uploadStatus: typeof video.uploadStatus === 'string' ? video.uploadStatus : 'not_uploaded',
      uploadError: typeof video.uploadError === 'string' ? video.uploadError : '',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load video';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
