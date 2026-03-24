import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { addUploadJob } from '@/lib/queue';

export async function POST(req: Request) {
  try {
    const { videoId } = await req.json();
    
    await connectToDatabase();
    
    const video = await Video.findById(videoId);
    if (!video) throw new Error('Video not found');

    if (video.status !== 'generated') {
         throw new Error('Video must be completely generated before uploading');
    }

    await addUploadJob(videoId);
    video.status = 'scheduled';
    await video.save();
    
    return NextResponse.json({ success: true, videoId });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
