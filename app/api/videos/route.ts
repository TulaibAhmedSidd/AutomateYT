import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';

export async function GET() {
  try {
    await connectToDatabase();
    const videos = await Video.find({}).sort({ createdAt: -1 });
    return NextResponse.json(videos);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
