import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { addVideoJob } from '@/lib/queue';
import { DEFAULT_MODEL_SELECTIONS, normalizeModelSelections } from '@/lib/generation-config';
import { Settings } from '@/models/Settings';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const content = body.content || body.topic || '';
    const promptType = body.promptType || 'idea';
    const aiModel = body.aiModel || 'gpt-4o-mini';

    await connectToDatabase();
    const settings = await Settings.findOne();
    const modelSelections = normalizeModelSelections(
      body.modelSelections || (aiModel ? { script: aiModel } : undefined),
      settings?.generationDefaults || DEFAULT_MODEL_SELECTIONS
    );
    
    // Default video creation
    const video = await Video.create({
      status: 'generating',
      title: promptType === 'script' ? 'Processing custom script...' : content ? 'Generating from idea...' : 'Generating random video...',
      videoPath: '',
      sourceContent: content,
      promptType,
      modelSelections
    });

    await addVideoJob(video._id.toString(), content, promptType, aiModel, { modelSelections });
    
    return NextResponse.json({ success: true, videoId: video._id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
