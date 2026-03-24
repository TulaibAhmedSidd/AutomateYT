import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { addVideoJob } from '@/lib/queue';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const customTopic = body.topic || '';

    await connectToDatabase();
    
    // Default video creation
    const video = await Video.create({
      status: 'generating',
      title: customTopic ? 'Custom Script Generation...' : 'Generating Process...',
      videoPath: ''
    });

    await addVideoJob(video._id.toString(), customTopic);
    
    return NextResponse.json({ success: true, videoId: video._id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
