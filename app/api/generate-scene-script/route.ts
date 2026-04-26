import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Settings } from '@/models/Settings';
import { generateTopicAndScript } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const content = typeof body.content === 'string' ? body.content : '';
    const sourcePrompt = typeof body.sourcePrompt === 'string' ? body.sourcePrompt : '';
    const aiModel = typeof body.model === 'string' ? body.model : 'gpt-4o-mini';
    const prompt = content || sourcePrompt;

    if (!prompt.trim()) {
      return NextResponse.json({ success: false, error: 'A prompt or scene description is required' }, { status: 400 });
    }

    await connectToDatabase();
    const settings = await Settings.findOne() || {};
    const scriptData = await generateTopicAndScript(settings, `Write exactly one scene for this short video context: ${prompt}`, 'idea', aiModel);
    const firstScene = Array.isArray(scriptData?.scenes) ? scriptData.scenes[0] : null;

    return NextResponse.json({
      success: true,
      scene: {
        text: firstScene?.text || '',
        summaryText: firstScene?.text || '',
        imagePrompt: firstScene?.imagePrompt || '',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scene script generation failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
