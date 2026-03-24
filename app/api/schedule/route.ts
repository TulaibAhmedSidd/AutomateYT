import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';
import { Video } from '@/models/Video';

export async function POST(req: Request) {
  try {
    const { timeStr, uploadEnabled } = await req.json();
    
    await connectToDatabase();
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    if (timeStr) {
      if (!settings.scheduleTimes.includes(timeStr)) {
        settings.scheduleTimes.push(timeStr);
      }
    }
    
    if (uploadEnabled !== undefined) {
      settings.uploadEnabled = uploadEnabled;
    }

    await settings.save();
    
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
