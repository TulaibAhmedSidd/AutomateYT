import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { addVideoJob } from '@/lib/queue';
import { DEFAULT_MODEL_SELECTIONS, normalizeModelSelections } from '@/lib/generation-config';
import { Settings } from '@/models/Settings';

type SceneInput = {
  text: string;
  imagePrompt: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const content = body.content || body.topic || '';
    const promptType = body.promptType || 'idea';
    const aiModel = body.aiModel || 'gpt-4o-mini';
    const prebuiltScript = body.scriptData as
      | {
          title?: string;
          description?: string;
          tags?: string[];
          scenes?: SceneInput[];
        }
      | undefined;

    await connectToDatabase();
    const settings = await Settings.findOne();
    const modelSelections = normalizeModelSelections(
      body.modelSelections || (aiModel ? { script: aiModel } : undefined),
      settings?.generationDefaults || DEFAULT_MODEL_SELECTIONS
    );

    const hasPrebuiltScenes = Array.isArray(prebuiltScript?.scenes) && prebuiltScript!.scenes.length > 0;
    const video = await Video.create({
      status: 'generating',
      title: hasPrebuiltScenes
        ? (prebuiltScript?.title || 'Script approved, generating media...')
        : promptType === 'script'
          ? 'Processing custom script...'
          : content
            ? 'Generating from idea...'
            : 'Generating random video...',
      description: prebuiltScript?.description || '',
      tags: prebuiltScript?.tags || [],
      script: hasPrebuiltScenes ? JSON.stringify(prebuiltScript?.scenes) : '',
      scriptStatus: hasPrebuiltScenes ? 'done' : 'pending',
      videoPath: '',
      sourceContent: content,
      promptType,
      modelSelections
    });

    await addVideoJob(video._id.toString(), content, promptType, aiModel, { modelSelections });

    return NextResponse.json({ success: true, videoId: video._id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Video generation request failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
