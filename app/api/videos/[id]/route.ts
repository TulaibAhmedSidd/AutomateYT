import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { hydrateVideoRuntime } from '@/lib/video-runtime';
import { addVideoJob } from '@/lib/queue';
import { DEFAULT_MODEL_SELECTIONS, normalizeModelSelections, type StepModelSelections } from '@/lib/generation-config';
import { Settings } from '@/models/Settings';
import { createProjectManifest, manifestToScriptScenes, normalizeProjectManifest, type VideoProjectManifest } from '@/lib/video-project';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await connectToDatabase();

    const video = await Video.findById(id).lean();
    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const runtime = await hydrateVideoRuntime(video as Record<string, unknown>);
    return NextResponse.json({
      ...video,
      ...runtime,
      failedStep: runtime.status === 'failed' ? runtime.failedStep : '',
      failedTool: runtime.status === 'failed' ? runtime.failedTool : '',
      uploadStatus: typeof video.uploadStatus === 'string' ? video.uploadStatus : 'not_uploaded',
      uploadError: typeof video.uploadError === 'string' ? video.uploadError : '',
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load video';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type UpdatePayload = {
  sourcePrompt?: string;
  modelSelections?: Partial<StepModelSelections>;
  projectManifest?: Partial<VideoProjectManifest>;
  generationIntent?: 'save' | 'render' | 'regenerate';
};

function validateProjectForRender(manifest: VideoProjectManifest) {
  const incompleteScenes = manifest.scriptSegments
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => !scene.text.trim() || (!scene.imageUrl && !scene.imagePrompt.trim()));

  if (incompleteScenes.length > 0) {
    return `Scene ${incompleteScenes[0].index + 1} is incomplete. Each scene needs script text and either an uploaded image or an AI image prompt before render.`;
  }

  return '';
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({})) as UpdatePayload;

    await connectToDatabase();
    const [video, settings] = await Promise.all([
      Video.findById(id),
      Settings.findOne(),
    ]);

    if (!video) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    const generationIntent = body.generationIntent || 'save';
    const normalizedModels = normalizeModelSelections(
      body.modelSelections,
      settings?.generationDefaults || DEFAULT_MODEL_SELECTIONS
    );

    const fallbackManifest = normalizeProjectManifest(video.projectManifest, {
      title: typeof video.title === 'string' ? video.title : '',
      description: typeof video.description === 'string' ? video.description : '',
      tags: Array.isArray(video.tags) ? video.tags : [],
      sourcePrompt: typeof video.sourceContent === 'string' ? video.sourceContent : '',
      scenes: (() => {
        try {
          return JSON.parse(typeof video.script === 'string' ? video.script : '[]');
        } catch {
          return [];
        }
      })(),
    });

    const inputManifest = body.projectManifest && typeof body.projectManifest === 'object'
      ? body.projectManifest
      : fallbackManifest;
    const nextManifest = createProjectManifest({
      title: inputManifest.metadata?.title || video.title,
      description: inputManifest.metadata?.description || video.description,
      tags: inputManifest.metadata?.tags || video.tags,
      sourcePrompt: body.sourcePrompt || video.sourceContent,
      scenes: manifestToScriptScenes(inputManifest),
      voiceId: settings?.voiceover?.selectedVoiceId,
      existing: {
        ...fallbackManifest,
        ...inputManifest,
      },
      generationIntent,
    });
    const nextScenes = manifestToScriptScenes(nextManifest);

    video.title = nextManifest.metadata.title;
    video.description = nextManifest.metadata.description;
    video.tags = nextManifest.metadata.tags;
    video.projectManifest = nextManifest;
    video.script = JSON.stringify(nextScenes);
    video.sourceContent = body.sourcePrompt || nextManifest.savedPrompts.sourcePrompt || video.sourceContent || '';
    video.modelSelections = normalizedModels;

    if (generationIntent === 'save') {
      if (video.status !== 'generated' && video.status !== 'uploaded' && video.status !== 'scheduled') {
        video.status = 'draft';
      }
      await video.save();
      return NextResponse.json({ success: true, status: video.status });
    }

    if (generationIntent === 'render') {
      const renderValidationError = validateProjectForRender(nextManifest);
      if (renderValidationError) {
        return NextResponse.json({ error: renderValidationError }, { status: 400 });
      }
      video.status = 'generating';
      video.videoRenderStatus = 'pending';
      video.failedStep = '';
      video.failedTool = '';
      video.errorSummary = '';
      video.errorDetails = '';
      await video.save();
      await addVideoJob(video._id.toString(), video.sourceContent, video.promptType || 'idea', normalizedModels.script, {
        retryMode: true,
        modelSelections: normalizedModels,
      });
      return NextResponse.json({ success: true, status: 'generating', generationIntent });
    }

    video.status = 'generating';
    video.scriptStatus = nextManifest.scriptSegments.every((scene) => scene.text.trim()) ? 'done' : 'pending';
    video.voiceStatus = 'pending';
    video.imageStatus = 'pending';
    video.videoRenderStatus = 'pending';
    video.failedStep = '';
    video.failedTool = '';
    video.errorSummary = '';
    video.errorDetails = '';
    await video.save();

    await addVideoJob(video._id.toString(), video.sourceContent, video.promptType || 'idea', normalizedModels.script, {
      retryMode: true,
      modelSelections: normalizedModels,
    });

    return NextResponse.json({ success: true, status: 'generating', generationIntent });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update video';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    await connectToDatabase();
    await Video.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete video';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
