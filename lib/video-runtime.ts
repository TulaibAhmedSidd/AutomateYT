import fs from 'fs-extra';
import path from 'path';
import { normalizeModelSelections, type StepModelSelections } from './generation-config';

const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const WORKSPACE_DIR = IS_VERCEL ? '/tmp' : process.cwd();

function getDiskPath(publicPath: string) {
  if (!publicPath) return '';
  // Convert /audio/xyz.mp3 to [WORKSPACE]/public/audio/xyz.mp3
  const relative = publicPath.startsWith('/') ? publicPath.substring(1) : publicPath;
  return path.join(WORKSPACE_DIR, 'public', relative);
}

export type SceneItem = {
  text: string;
  imagePrompt: string;
  uploadedImagePath?: string;
};

export type HydratedVideoState = {
  status: string;
  scenes: SceneItem[];
  scriptStatus: string;
  voiceStatus: string;
  imageStatus: string;
  videoRenderStatus: string;
  audioGenerated: boolean;
  audioPath: string;
  videoPath: string;
  thumbnail: string;
  imagePaths: string[];
  storageMode: string;
  failedStep: string;
  failedTool: string;
  modelSelections: StepModelSelections;
  sourcePrompt: string;
  voiceoverText: string;
};

export function parseScenes(script: unknown): SceneItem[] {
  if (typeof script !== 'string' || !script.trim()) return [];

  try {
    const parsed = JSON.parse(script);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((scene) => scene && typeof scene === 'object')
      .map((scene) => ({
        text: typeof scene.text === 'string' ? scene.text : '',
        imagePrompt: typeof scene.imagePrompt === 'string' ? scene.imagePrompt : '',
        uploadedImagePath: typeof scene.uploadedImagePath === 'string' ? scene.uploadedImagePath : '',
      }))
      .filter((scene) => scene.text || scene.imagePrompt || scene.uploadedImagePath);
  } catch {
    return [];
  }
}

export function inferFailure(video: Record<string, unknown>) {
  const rawError = `${video.errorSummary || ''} ${video.errorDetails || ''}`.toLowerCase();
  const currentStep = typeof video.failedStep === 'string' && video.failedStep ? video.failedStep : '';
  const currentTool = typeof video.failedTool === 'string' && video.failedTool ? video.failedTool : '';

  if (currentStep || currentTool) {
    return {
      failedStep: currentStep,
      failedTool: currentTool,
    };
  }

  if (rawError.includes('height must be between') || rawError.includes('image generation failed') || rawError.includes('leonardo')) {
    return {
      failedStep: 'Image generation',
      failedTool: 'Leonardo API',
    };
  }

  if (rawError.includes('video rendering failed') || rawError.includes('ffmpeg') || rawError.includes('video render')) {
    return {
      failedStep: 'Video render',
      failedTool: 'FFmpeg',
    };
  }

  if (rawError.includes('voiceover') || rawError.includes('elevenlabs')) {
    return {
      failedStep: 'Voiceover generation',
      failedTool: 'ElevenLabs',
    };
  }

  if (rawError.includes('script') || rawError.includes('openai') || rawError.includes('gemini')) {
    return {
      failedStep: 'Script generation',
      failedTool: 'OpenAI / Gemini',
    };
  }

  return {
    failedStep: '',
    failedTool: '',
  };
}

export async function hydrateVideoRuntime(video: Record<string, unknown>): Promise<HydratedVideoState> {
  const scenes = parseScenes(video.script);
  const voiceoverText = scenes.map((scene) => scene.text).join(' ').trim();
  const videoId = String(video._id);
  const modelSelections = normalizeModelSelections(video.modelSelections as Partial<StepModelSelections> | undefined);
  const failed = inferFailure(video);

  const audioDiskPath = getDiskPath(`/audio/${videoId}.mp3`);
  const videoPublicPath = typeof video.videoPath === 'string' ? video.videoPath : '';
  const videoDiskPath = getDiskPath(videoPublicPath);
  const thumbnailPublicPath = typeof video.thumbnail === 'string' ? video.thumbnail : '';
  const thumbnailDiskPath = getDiskPath(thumbnailPublicPath);
  const imageDiskPaths = scenes.map((_, index) => getDiskPath(`/images/${videoId}_${index}.png`));

  const [audioExists, videoExists, thumbnailExists, imageExistsList] = await Promise.all([
    fs.pathExists(audioDiskPath),
    videoDiskPath ? fs.pathExists(videoDiskPath) : Promise.resolve(false),
    thumbnailDiskPath ? fs.pathExists(thumbnailDiskPath) : Promise.resolve(false),
    Promise.all(imageDiskPaths.map((imagePath) => fs.pathExists(imagePath))),
  ]);

  const mediaRefs = typeof video.mediaRefs === 'object' && video.mediaRefs ? video.mediaRefs as {
    audio?: { url?: string };
    video?: { url?: string };
    thumbnail?: { url?: string };
    images?: Array<{ url?: string }>;
  } : {};
  const storageMode = typeof video.storageMode === 'string' ? video.storageMode : 'local';

  const hasScript = scenes.length > 0;
  const imagesGenerated = imageExistsList.length > 0 && imageExistsList.every(Boolean);

  let scriptStatus = typeof video.scriptStatus === 'string' && video.scriptStatus ? video.scriptStatus : hasScript ? 'done' : 'pending';
  let voiceStatus = typeof video.voiceStatus === 'string' && video.voiceStatus ? video.voiceStatus : 'pending';
  let imageStatus = typeof video.imageStatus === 'string' && video.imageStatus ? video.imageStatus : 'pending';
  let videoRenderStatus = typeof video.videoRenderStatus === 'string' && video.videoRenderStatus ? video.videoRenderStatus : 'pending';

  if (hasScript && scriptStatus === 'pending') scriptStatus = 'done';
  if (audioExists && voiceStatus === 'pending') voiceStatus = 'done';
  if (imagesGenerated && imageStatus === 'pending') imageStatus = 'done';
  if (videoExists && videoRenderStatus === 'pending') videoRenderStatus = 'done';

  if (failed.failedStep === 'Script generation') scriptStatus = 'failed';
  if (failed.failedStep === 'Voiceover generation') voiceStatus = 'failed';
  if (failed.failedStep === 'Image generation') imageStatus = 'failed';
  if (failed.failedStep === 'Video render') videoRenderStatus = 'failed';

  let normalizedStatus = typeof video.status === 'string' && video.status ? video.status : 'generating';
  if (videoExists && hasScript && audioExists) {
    normalizedStatus = typeof video.youtubeId === 'string' && video.youtubeId
      ? 'uploaded'
      : normalizedStatus === 'scheduled'
        ? 'scheduled'
        : 'generated';
  } else if (scriptStatus === 'failed' || voiceStatus === 'failed' || imageStatus === 'failed' || videoRenderStatus === 'failed') {
    normalizedStatus = 'failed';
  } else {
    normalizedStatus = 'generating';
  }

  return {
    status: normalizedStatus,
    scenes,
    scriptStatus,
    voiceStatus,
    imageStatus,
    videoRenderStatus,
    audioGenerated: audioExists,
    audioPath: storageMode === 'cloud' ? (mediaRefs.audio?.url || '') : (audioExists ? `/audio/${videoId}.mp3` : ''),
    videoPath: storageMode === 'cloud' ? (mediaRefs.video?.url || '') : (videoExists ? videoPublicPath : ''),
    thumbnail: storageMode === 'cloud' ? (mediaRefs.thumbnail?.url || '') : (thumbnailExists ? thumbnailPublicPath : ''),
    imagePaths: storageMode === 'cloud'
      ? (mediaRefs.images || []).map((image) => image.url || '').filter(Boolean)
      : scenes.map((_, index) => `/images/${videoId}_${index}.png`).filter((_, index) => imageExistsList[index]),
    storageMode,
    failedStep: failed.failedStep,
    failedTool: failed.failedTool,
    modelSelections,
    sourcePrompt: typeof video.sourceContent === 'string' ? video.sourceContent : '',
    voiceoverText,
  };
}
