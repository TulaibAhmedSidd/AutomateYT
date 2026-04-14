import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { Settings } from '@/models/Settings';
import { addVideoJob } from '@/lib/queue';
import { DEFAULT_MODEL_SELECTIONS, normalizeModelSelections, type StepModelSelections } from '@/lib/generation-config';
import { hydrateVideoRuntime } from '@/lib/video-runtime';

type RetryStep = 'script' | 'voice' | 'image' | 'video';

type RetryVideoDocument = {
  scriptStatus: string;
  voiceStatus: string;
  imageStatus: string;
  videoRenderStatus: string;
  status: string;
  failedStep: string;
  failedTool: string;
  errorSummary: string;
  errorDetails: string;
  modelSelections: unknown;
  save(): Promise<unknown>;
  _id: { toString(): string };
  sourceContent?: string;
  promptType?: string;
};

function applyRetryStep(video: RetryVideoDocument, retryStep: RetryStep) {
  if (retryStep === 'script') {
    video.scriptStatus = 'pending';
    video.voiceStatus = 'pending';
    video.imageStatus = 'pending';
    video.videoRenderStatus = 'pending';
    return;
  }

  if (retryStep === 'voice') {
    video.voiceStatus = 'pending';
    video.imageStatus = video.imageStatus === 'done' ? 'done' : 'pending';
    video.videoRenderStatus = 'pending';
    return;
  }

  if (retryStep === 'image') {
    video.imageStatus = 'pending';
    video.videoRenderStatus = 'pending';
    return;
  }

  video.videoRenderStatus = 'pending';
}

function mapFailureToRetryStep(failedStep: string): RetryStep {
  if (failedStep === 'Script generation') return 'script';
  if (failedStep === 'Voiceover generation') return 'voice';
  if (failedStep === 'Image generation') return 'image';
  return 'video';
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));

    await connectToDatabase();
    const [video, settings] = await Promise.all([
      Video.findById(id),
      Settings.findOne(),
    ]);

    if (!video) {
      return NextResponse.json({ success: false, error: 'Video not found' }, { status: 404 });
    }

    const retryVideo = video as unknown as RetryVideoDocument;
    const runtime = await hydrateVideoRuntime(video.toObject());
    const retryStep = (body.step as RetryStep | undefined) || mapFailureToRetryStep(runtime.failedStep);
    const modelSelections = normalizeModelSelections(
      retryVideo.modelSelections as Partial<StepModelSelections> | undefined,
      settings?.generationDefaults || DEFAULT_MODEL_SELECTIONS
    );

    retryVideo.scriptStatus = runtime.scriptStatus;
    retryVideo.voiceStatus = runtime.voiceStatus;
    retryVideo.imageStatus = runtime.imageStatus;
    retryVideo.videoRenderStatus = runtime.videoRenderStatus;
    retryVideo.status = 'generating';
    retryVideo.failedStep = '';
    retryVideo.failedTool = '';
    retryVideo.errorSummary = '';
    retryVideo.errorDetails = '';
    retryVideo.modelSelections = modelSelections;

    applyRetryStep(retryVideo, retryStep);
    await retryVideo.save();

    await addVideoJob(retryVideo._id.toString(), retryVideo.sourceContent || '', retryVideo.promptType || 'idea', modelSelections.script, {
      retryMode: true,
      modelSelections,
    });

    return NextResponse.json({ success: true, videoId: retryVideo._id, retryStep });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Retry failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
