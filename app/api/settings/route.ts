import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';

export async function GET() {
  await connectToDatabase();
  const settings = await Settings.findOne() || await Settings.create({});
  return NextResponse.json(settings);
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    await connectToDatabase();
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings(data);
    } else {
      Object.assign(settings, data);
    }
    
    await settings.save();
    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
