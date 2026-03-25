import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { addVideoJob } from '@/lib/queue';

export async function POST(req: Request) {
  try {
    const { count } = await req.json();
    const amount = Number(count) || 1;
    
    await connectToDatabase();
    
    const videos = [];
    for(let i=0; i<amount; i++) {
        const video = await Video.create({
            status: 'generating',
            title: `Bulk Generating Job ${i+1}`,
            videoPath: ''
        });
        await addVideoJob(video._id.toString(), '', 'idea', 'gpt-4o-mini');
        videos.push(video._id);
    }
    
    return NextResponse.json({ success: true, videos });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
