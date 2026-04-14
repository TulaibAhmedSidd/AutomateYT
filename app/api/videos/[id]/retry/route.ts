import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { Settings } from '@/models/Settings';
import { addVideoJob } from '@/lib/queue';
import { DEFAULT_MODEL_SELECTIONS, normalizeModelSelections } from '@/lib/generation-config';

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    await connectToDatabase();
    const [video, settings] = await Promise.all([
      Video.findById(id),
      Settings.findOne(),
    ]);

    if (!video) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    const modelSelections = normalizeModelSelections(
      video.modelSelections,
      settings?.generationDefaults || DEFAULT_MODEL_SELECTIONS
    );

    video.status = 'generating';
    video.failedStep = '';
    video.failedTool = '';
    video.errorSummary = '';
    video.errorDetails = '';
    video.modelSelections = modelSelections;
    await video.save();

    await addVideoJob(video._id.toString(), video.sourceContent || '', video.promptType || 'idea', modelSelections.script, {
      retryMode: true,
      modelSelections,
    });

    return NextResponse.json({ success: true, videoId: video._id });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
