import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { addUploadJob } from '@/lib/queue';
import { hydrateVideoRuntime } from '@/lib/video-runtime';

export async function POST(req: Request) {
  try {
    const { videoId } = await req.json();

    await connectToDatabase();

    const video = await Video.findById(videoId);
    if (!video) throw new Error('Video not found');

    const runtime = await hydrateVideoRuntime(video.toObject());
    if (!runtime.videoPath || runtime.status === 'failed') {
      throw new Error('Video must finish rendering before uploading to YouTube');
    }

    await addUploadJob(videoId);
    video.status = 'scheduled';
    await video.save();

    return NextResponse.json({ success: true, videoId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
