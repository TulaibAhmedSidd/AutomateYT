import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { hydrateVideoRuntime } from '@/lib/video-runtime';

export async function GET() {
  try {
    await connectToDatabase();
    const videos = await Video.find({}).sort({ createdAt: -1 }).lean();

    const enrichedVideos = await Promise.all(
      videos.map(async (video) => {
        const runtime = await hydrateVideoRuntime(video as Record<string, unknown>);
        return {
          ...video,
          ...runtime,
          failedStep: runtime.status === 'failed' ? runtime.failedStep : '',
          failedTool: runtime.status === 'failed' ? runtime.failedTool : '',
          uploadStatus: typeof video.uploadStatus === 'string' ? video.uploadStatus : 'not_uploaded',
          uploadError: typeof video.uploadError === 'string' ? video.uploadError : '',
        };
      })
    );

    return NextResponse.json(enrichedVideos);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load videos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
