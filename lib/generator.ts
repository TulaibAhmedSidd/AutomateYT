import path from 'path';
import fs from 'fs-extra';
import connectToDatabase from './mongodb';
import { Video } from '@/models/Video';
import { Settings } from '@/models/Settings';
import { generateTopicAndScript, generateVoiceover, generateImage } from './ai';
import { concatenateAudioTracks, renderVideo, generateThumbnail } from './ffmpeg';
import { normalizeModelSelections, type StepModelSelections } from './generation-config';
import { saveLocalFileToGridFS } from './storage';
import { createProjectManifest, manifestToScriptScenes, normalizeProjectManifest, type VideoProjectManifest } from './video-project';

const IS_VERCEL = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
const WORKSPACE_DIR = IS_VERCEL ? '/tmp' : process.cwd();

function getStoragePath(subDir: string, fileName: string) {
  // On Vercel, everything goes to /tmp. On local, it goes to public/
  const base = IS_VERCEL ? path.join(WORKSPACE_DIR, 'public') : path.join(process.cwd(), 'public');
  return path.join(base, subDir, fileName);
}

function getPublicAssetDiskPath(publicPath: string) {
  const relative = publicPath.startsWith('/') ? publicPath.slice(1) : publicPath;
  const base = IS_VERCEL ? path.join(WORKSPACE_DIR, 'public') : path.join(process.cwd(), 'public');
  return path.join(base, relative);
}

type GenerationOptions = {
  retryMode?: boolean;
  modelSelections?: Partial<StepModelSelections>;
};

type ScriptScene = {
  text: string;
  summaryText?: string;
  imagePrompt: string;
  uploadedImagePath?: string;
  voiceUrl?: string;
  source?: {
    script?: 'ai' | 'user' | 'none';
    image?: 'ai' | 'user' | 'none';
    voice?: 'ai' | 'user' | 'none';
  };
  componentStatus?: {
    script?: 'generated' | 'uploaded' | 'edited' | 'missing';
    image?: 'generated' | 'uploaded' | 'edited' | 'missing';
    voice?: 'generated' | 'uploaded' | 'edited' | 'missing';
  };
};

type ErrorWithResponse = Error & {
  response?: {
    data?: unknown;
  };
  step?: string;
  tool?: string;
  summary?: string;
  details?: string;
};

type VideoDocument = {
  _id: { toString(): string };
  title?: string;
  description?: string;
  tags?: string[];
  script?: string;
  sourceContent?: string;
  promptType?: string;
  modelSelections?: Partial<StepModelSelections>;
  storageMode?: 'local' | 'cloud';
  projectManifest?: Partial<VideoProjectManifest>;
  mediaRefs?: {
    audio?: unknown;
    video?: unknown;
    thumbnail?: unknown;
    images?: unknown[];
  };
  status: string;
  scriptStatus: string;
  voiceStatus: string;
  imageStatus: string;
  videoRenderStatus: string;
  failedStep?: string;
  failedTool?: string;
  errorSummary?: string;
  errorDetails?: string;
  videoPath?: string;
  thumbnail?: string;
  save(): Promise<unknown>;
};

type SettingsDocument = {
  generationDefaults?: Partial<StepModelSelections>;
  storage?: {
    mode?: 'local' | 'cloud';
  };
  voiceover?: {
    selectedVoiceId?: string;
  };
  apiKeys?: {
    openai?: string;
    gemini?: string;
    elevenlabs?: string;
    leonardo?: string;
  };
};

function getErrorMessage(err: unknown) {
  const known = err as ErrorWithResponse;
  if (typeof known.response?.data === 'string') return known.response.data;
  if (typeof known.response?.data === 'object' && known.response?.data && 'error' in known.response.data) {
    const errorValue = (known.response.data as { error?: unknown }).error;
    if (typeof errorValue === 'string') return errorValue;
  }
  if (typeof known.message === 'string') return known.message;
  return String(err);
}

function getErrorDetails(err: unknown) {
  const known = err as ErrorWithResponse;
  if (known.response?.data) {
    try {
      return JSON.stringify(known.response.data, null, 2);
    } catch {
      return String(known.response.data);
    }
  }

  return known.stack || known.message || String(err);
}

function createStepError(step: string, tool: string, err: unknown) {
  const summary = getErrorMessage(err);
  const wrapped = new Error(`${step} failed: ${summary}`) as ErrorWithResponse;
  wrapped.step = step;
  wrapped.tool = tool;
  wrapped.summary = summary;
  wrapped.details = getErrorDetails(err);
  return wrapped;
}

function parseFallbackScenes(script: unknown): ScriptScene[] {
  if (typeof script !== 'string' || !script.trim()) return [];

  try {
    const parsed = JSON.parse(script);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((scene) => ({
      text: typeof scene?.text === 'string' ? scene.text : '',
      summaryText: typeof scene?.summaryText === 'string' ? scene.summaryText : '',
      imagePrompt: typeof scene?.imagePrompt === 'string' ? scene.imagePrompt : '',
      uploadedImagePath: typeof scene?.uploadedImagePath === 'string' ? scene.uploadedImagePath : '',
      voiceUrl: typeof scene?.voiceUrl === 'string' ? scene.voiceUrl : '',
      source: typeof scene?.source === 'object' && scene.source ? scene.source : undefined,
      componentStatus: typeof scene?.componentStatus === 'object' && scene.componentStatus ? scene.componentStatus : undefined,
    })).filter((scene) => scene.text || scene.imagePrompt || scene.uploadedImagePath || scene.voiceUrl);
  } catch {
    return [];
  }
}

async function copyPublicAsset(publicPath: string, outputPath: string) {
  await fs.copy(getPublicAssetDiskPath(publicPath), outputPath, { overwrite: true });
}

function resetStatusesForRetry(video: VideoDocument) {
  video.status = 'generating';
  video.failedStep = '';
  video.failedTool = '';
  video.errorSummary = '';
  video.errorDetails = '';
}

async function persistCloudAssets(video: VideoDocument, audioPath: string, imagePaths: string[], finalVideoPath: string, finalThumbnailPath: string) {
  const idStr = video._id.toString();
  const audioRef = await saveLocalFileToGridFS(audioPath, `${idStr}.mp3`, 'audio/mpeg');
  const imageRefs = await Promise.all(
    imagePaths.map((imagePath, index) => saveLocalFileToGridFS(imagePath, `${idStr}_${index}.png`, 'image/png'))
  );
  const videoRef = await saveLocalFileToGridFS(finalVideoPath, `${idStr}.mp4`, 'video/mp4');
  const thumbnailRef = await saveLocalFileToGridFS(finalThumbnailPath, `${idStr}_thumb.png`, 'image/png');

  video.mediaRefs = {
    audio: audioRef,
    images: imageRefs,
    video: videoRef,
    thumbnail: thumbnailRef,
  };
  video.storageMode = 'cloud';
}

export async function executeVideoGeneration(
  videoId: string,
  content?: string,
  promptType?: string,
  aiModel?: string,
  options?: GenerationOptions
) {
  try {
    await connectToDatabase();
    const video = await Video.findById(videoId) as unknown as VideoDocument | null;
    const settings = ((await Settings.findOne()) || {}) as SettingsDocument;

    if (!video) return;

    const retryMode = options?.retryMode || false;
    const modelSelections = normalizeModelSelections(
      options?.modelSelections || video.modelSelections || (aiModel ? { script: aiModel } : undefined),
      settings.generationDefaults
    );

    video.sourceContent = content ?? video.sourceContent ?? '';
    video.promptType = promptType ?? video.promptType ?? 'idea';
    video.modelSelections = modelSelections;
    video.storageMode = settings.storage?.mode || (IS_VERCEL ? 'cloud' : 'local');

    if (retryMode) {
      resetStatusesForRetry(video);
    } else {
      video.status = 'generating';
      video.failedStep = '';
      video.failedTool = '';
      video.errorSummary = '';
      video.errorDetails = '';
      video.scriptStatus = 'pending';
      video.voiceStatus = 'pending';
      video.imageStatus = 'pending';
      video.videoRenderStatus = 'pending';
    }

    await video.save();

    const idStr = video._id.toString();
    const audioPath = getStoragePath('audio', `${idStr}.mp3`);
    const finalVideoPath = getStoragePath('videos', `${idStr}.mp4`);
    const finalThumbnailPath = getStoragePath('images', `${idStr}_thumb.png`);

    await fs.ensureDir(path.dirname(audioPath));
    await fs.ensureDir(path.dirname(finalVideoPath));
    await fs.ensureDir(path.dirname(finalThumbnailPath));

    if (video.scriptStatus !== 'done' || !video.script) {
      try {
        const scriptData = await generateTopicAndScript(settings, video.sourceContent, video.promptType, modelSelections.script);
        video.title = scriptData.title;
        video.description = scriptData.description;
        video.tags = scriptData.tags;
        video.script = JSON.stringify(scriptData.scenes);
        video.projectManifest = createProjectManifest({
          title: scriptData.title,
          description: scriptData.description,
          tags: scriptData.tags,
          sourcePrompt: video.sourceContent,
          scenes: scriptData.scenes,
          voiceId: settings.voiceover?.selectedVoiceId,
          existing: video.projectManifest,
          generationIntent: 'regenerate',
        });
        video.scriptStatus = 'done';
        await video.save();
      } catch (err: unknown) {
        video.scriptStatus = 'failed';
        await video.save();
        throw createStepError('Script generation', 'OpenAI / Gemini', err);
      }
    }

    const projectManifest = normalizeProjectManifest(video.projectManifest, {
      title: video.title,
      description: video.description,
      tags: video.tags,
      sourcePrompt: video.sourceContent,
      scenes: parseFallbackScenes(video.script),
    });
    let scriptDataObj: ScriptScene[] = manifestToScriptScenes(projectManifest);
    if (scriptDataObj.length === 0) {
      scriptDataObj = parseFallbackScenes(video.script);
    }

    if (scriptDataObj.length === 0) {
      throw createStepError('Script parsing', 'Application', new Error('No scenes were available for voice, image, and render generation.'));
    }

    video.projectManifest = createProjectManifest({
      title: video.title,
      description: video.description,
      tags: video.tags,
      sourcePrompt: video.sourceContent,
      scenes: scriptDataObj,
      voiceId: settings.voiceover?.selectedVoiceId,
      existing: projectManifest,
      generationIntent: 'regenerate',
    });
    video.script = JSON.stringify(scriptDataObj);
    await video.save();

    const manifestSegments = video.projectManifest?.scriptSegments || [];

    if (video.voiceStatus !== 'done' || !(await fs.pathExists(audioPath))) {
      try {
        const segmentAudioDir = getStoragePath('audio', `${idStr}_segments`);
        await fs.ensureDir(segmentAudioDir);
        const activeSegments = manifestSegments.filter((segment) => !segment.muteScene && segment.text.trim());

        if (activeSegments.length === 0) {
          throw new Error('At least one scene needs script text before voice can be rendered.');
        }

        const segmentAudioPaths: string[] = [];
        for (const [index, segment] of activeSegments.entries()) {
          const segmentOutputPath = path.join(segmentAudioDir, `${index}.mp3`);
          if (segment.voiceUrl) {
            await copyPublicAsset(segment.voiceUrl, segmentOutputPath);
          } else if (segment.text.trim()) {
            await generateVoiceover(segment.text, segmentOutputPath, settings, modelSelections.voice);
          } else {
            throw new Error(`Scene ${index + 1} is missing both uploaded voice and script text.`);
          }
          segmentAudioPaths.push(segmentOutputPath);
        }

        if (segmentAudioPaths.length === 1) {
          await fs.copy(segmentAudioPaths[0], audioPath, { overwrite: true });
        } else {
          await concatenateAudioTracks(segmentAudioPaths, audioPath);
        }
        video.voiceStatus = 'done';
        await video.save();
      } catch (err: unknown) {
        video.voiceStatus = 'failed';
        await video.save();
        throw createStepError('Voiceover generation', 'ElevenLabs', err);
      }
    }

    const imagePaths = scriptDataObj.map((_, index) => getStoragePath('images', `${idStr}_${index}.png`));
    const imagesReady = imagePaths.length > 0 && await Promise.all(imagePaths.map((imagePath) => fs.pathExists(imagePath))).then((results) => results.every(Boolean));
    let renderImagePaths = imagePaths;

    if (video.imageStatus !== 'done' || !imagesReady) {
      try {
        for (let i = 0; i < scriptDataObj.length; i++) {
          const segment = manifestSegments[i];
          const uploadedImagePath = segment?.imageUrl || scriptDataObj[i].uploadedImagePath;
          if (uploadedImagePath) {
            await copyPublicAsset(uploadedImagePath, imagePaths[i]);
            continue;
          }

          if (!scriptDataObj[i].imagePrompt.trim()) {
            throw new Error(`Scene ${i + 1} is missing both an uploaded image and an AI image prompt.`);
          }

          await generateImage(scriptDataObj[i].imagePrompt, imagePaths[i], settings, modelSelections.image);
        }
        video.imageStatus = 'done';
        await video.save();
      } catch (err: unknown) {
        const existingImagePaths = await Promise.all(
          imagePaths.map(async (imagePath) => (await fs.pathExists(imagePath) ? imagePath : null))
        ).then((results) => results.filter((value): value is string => Boolean(value)));

        if (existingImagePaths.length === 0) {
          video.imageStatus = 'failed';
          await video.save();
          throw createStepError('Image generation', 'Leonardo API', err);
        }

        renderImagePaths = existingImagePaths;
        video.imageStatus = existingImagePaths.length === imagePaths.length ? 'done' : 'failed';
        video.errorSummary = `Some images failed. Rendering with ${existingImagePaths.length} of ${imagePaths.length} generated images.`;
        video.errorDetails = getErrorDetails(err);
        await video.save();
      }
    }

    if (renderImagePaths.length === imagePaths.length) {
      video.imageStatus = 'done';
      await video.save();
    }

    if (video.videoRenderStatus !== 'done' || !(await fs.pathExists(finalVideoPath))) {
      try {
        await renderVideo(renderImagePaths, audioPath, finalVideoPath, modelSelections.video, {
          openaiApiKey: settings.apiKeys?.openai || process.env.OPENAI_API_KEY,
          socialOverlayText: 'Follow for more',
        });
        video.videoPath = `/videos/${idStr}.mp4`;

        await generateThumbnail(finalVideoPath, finalThumbnailPath, modelSelections.video);
        video.thumbnail = `/images/${idStr}_thumb.png`;

        if (video.storageMode === 'cloud') {
          await persistCloudAssets(video, audioPath, renderImagePaths, finalVideoPath, finalThumbnailPath);
        }

        video.videoRenderStatus = 'done';
        video.status = 'generated';
        if (video.imageStatus === 'done') {
          video.failedStep = '';
          video.failedTool = '';
          video.errorSummary = '';
          video.errorDetails = '';
        }
        await video.save();
      } catch (err: unknown) {
        video.videoRenderStatus = 'failed';
        await video.save();
        throw createStepError('Video render', 'FFmpeg', err);
      }
    } else {
      video.status = 'generated';
      await video.save();
    }
  } catch (error: unknown) {
    const known = error as ErrorWithResponse;
    console.error('Video generation failed:', error);

    try {
      await Video.findByIdAndUpdate(videoId, {
        status: 'failed',
        failedStep: known.step || 'Generation pipeline',
        failedTool: known.tool || 'Unknown tool',
        errorSummary: known.summary || getErrorMessage(error),
        errorDetails: known.details || getErrorDetails(error),
      });
    } catch {
      // Best effort only.
    }
  }
}
