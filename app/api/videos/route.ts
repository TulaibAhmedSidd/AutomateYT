import { NextResponse } from 'next/server';
import connectToDatabase from '@/lib/mongodb';
import { Video } from '@/models/Video';
import { normalizeModelSelections } from '@/lib/generation-config';
import fs from 'fs-extra';
import path from 'path';

type SceneItem = {
  text: string;
  imagePrompt: string;
};

function parseScenes(script: unknown): SceneItem[] {
  if (typeof script !== 'string' || !script.trim()) return [];

  try {
    const parsed = JSON.parse(script);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((scene) => scene && typeof scene === 'object')
      .map((scene) => ({
        text: typeof scene.text === 'string' ? scene.text : '',
        imagePrompt: typeof scene.imagePrompt === 'string' ? scene.imagePrompt : '',
      }))
      .filter((scene) => scene.text || scene.imagePrompt);
  } catch {
    return [];
  }
}

function inferFailure(video: Record<string, unknown>) {
  const rawError = `${video.errorSummary || ''} ${video.errorDetails || ''}`.toLowerCase();
  const currentStep = typeof video.failedStep === 'string' && video.failedStep ? video.failedStep : '';
  const currentTool = typeof video.failedTool === 'string' && video.failedTool ? video.failedTool : '';

  if (currentStep || currentTool) {
    return {
      failedStep: currentStep,
      failedTool: currentTool,
      scriptStatus: video.scriptStatus,
      voiceStatus: video.voiceStatus,
      imageStatus: video.imageStatus,
      videoRenderStatus: video.videoRenderStatus,
    };
  }

  if (rawError.includes('height must be between') || rawError.includes('image generation failed') || rawError.includes('leonardo')) {
    return {
      failedStep: 'Image generation',
      failedTool: 'Leonardo API',
      scriptStatus: video.scriptStatus,
      voiceStatus: video.voiceStatus === 'pending' ? 'done' : video.voiceStatus,
      imageStatus: 'failed',
      videoRenderStatus: video.videoRenderStatus,
    };
  }

  if (rawError.includes('video rendering failed') || rawError.includes('ffmpeg') || rawError.includes('video render')) {
    return {
      failedStep: 'Video render',
      failedTool: 'FFmpeg',
      scriptStatus: video.scriptStatus,
      voiceStatus: video.voiceStatus,
      imageStatus: video.imageStatus,
      videoRenderStatus: 'failed',
    };
  }

  if (rawError.includes('voiceover') || rawError.includes('elevenlabs')) {
    return {
      failedStep: 'Voiceover generation',
      failedTool: 'ElevenLabs',
      scriptStatus: video.scriptStatus,
      voiceStatus: 'failed',
      imageStatus: video.imageStatus,
      videoRenderStatus: video.videoRenderStatus,
    };
  }

  if (rawError.includes('script') || rawError.includes('openai') || rawError.includes('gemini')) {
    return {
      failedStep: 'Script generation',
      failedTool: 'OpenAI / Gemini',
      scriptStatus: 'failed',
      voiceStatus: video.voiceStatus,
      imageStatus: video.imageStatus,
      videoRenderStatus: video.videoRenderStatus,
    };
  }

  return {
    failedStep: '',
    failedTool: '',
    scriptStatus: video.scriptStatus,
    voiceStatus: video.voiceStatus,
    imageStatus: video.imageStatus,
    videoRenderStatus: video.videoRenderStatus,
  };
}

export async function GET() {
  try {
    await connectToDatabase();
    const videos = await Video.find({}).sort({ createdAt: -1 }).lean();

    const enrichedVideos = await Promise.all(videos.map(async (video) => {
      const scenes = parseScenes(video.script);
      const inferred = inferFailure(video as Record<string, unknown>);
      const modelSelections = normalizeModelSelections(video.modelSelections);
      const voiceoverText = scenes.map((scene) => scene.text).join(' ').trim();
      const videoId = String(video._id);
      const audioPublicPath = `/audio/${videoId}.mp3`;
      const audioDiskPath = path.resolve(`public/audio/${videoId}.mp3`);
      const renderedVideoPath = typeof video.videoPath === 'string' ? video.videoPath : '';
      const renderedVideoDiskPath = renderedVideoPath ? path.resolve(`public${renderedVideoPath}`) : '';
      const thumbnailPath = typeof video.thumbnail === 'string' ? video.thumbnail : '';
      const thumbnailDiskPath = thumbnailPath ? path.resolve(`public${thumbnailPath}`) : '';

      const [audioExists, videoExists, thumbnailExists] = await Promise.all([
        fs.pathExists(audioDiskPath),
        renderedVideoDiskPath ? fs.pathExists(renderedVideoDiskPath) : Promise.resolve(false),
        thumbnailDiskPath ? fs.pathExists(thumbnailDiskPath) : Promise.resolve(false),
      ]);

      const hasScript = scenes.length > 0;
      const resolvedScriptStatus = typeof inferred.scriptStatus === 'string' && inferred.scriptStatus
        ? inferred.scriptStatus
        : hasScript ? 'done' : 'pending';
      const resolvedVoiceStatus = typeof inferred.voiceStatus === 'string' && inferred.voiceStatus && inferred.voiceStatus !== 'pending'
        ? inferred.voiceStatus
        : audioExists ? 'done' : (typeof inferred.voiceStatus === 'string' && inferred.voiceStatus ? inferred.voiceStatus : 'pending');
      const resolvedImageStatus = typeof inferred.imageStatus === 'string' && inferred.imageStatus
        ? inferred.imageStatus
        : 'pending';
      const resolvedVideoRenderStatus = typeof inferred.videoRenderStatus === 'string' && inferred.videoRenderStatus && inferred.videoRenderStatus !== 'pending'
        ? inferred.videoRenderStatus
        : videoExists ? 'done' : (typeof inferred.videoRenderStatus === 'string' && inferred.videoRenderStatus ? inferred.videoRenderStatus : 'pending');

      return {
        ...video,
        ...inferred,
        scriptStatus: resolvedScriptStatus,
        voiceStatus: resolvedVoiceStatus,
        imageStatus: resolvedImageStatus,
        videoRenderStatus: resolvedVideoRenderStatus,
        modelSelections,
        scenes,
        sourcePrompt: video.sourceContent || '',
        voiceoverText,
        audioGenerated: audioExists,
        audioPath: audioExists ? audioPublicPath : '',
        videoPath: videoExists ? renderedVideoPath : '',
        thumbnail: thumbnailExists ? thumbnailPath : '',
      };
    }));

    return NextResponse.json(enrichedVideos);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load videos';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
