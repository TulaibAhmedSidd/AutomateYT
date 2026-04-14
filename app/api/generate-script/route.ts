import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';
import { generateTopicAndScript } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const content = body.content || body.topic || '';
    const promptType = body.promptType || 'idea';
    const scriptModel = body.modelSelections?.script || body.aiModel || 'gpt-4o-mini';

    await connectToDatabase();
    const settings = await Settings.findOne() || {};
    const scriptData = await generateTopicAndScript(settings, content, promptType, scriptModel);

    return NextResponse.json({ success: true, scriptData });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to generate script';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
