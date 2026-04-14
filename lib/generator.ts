import path from 'path';
import fs from 'fs-extra';
import connectToDatabase from './mongodb';
import { Video } from '@/models/Video';
import { Settings } from '@/models/Settings';
import { generateTopicAndScript, generateVoiceover, generateImage } from './ai';
import { renderVideo, generateThumbnail } from './ffmpeg';
import { normalizeModelSelections, type StepModelSelections } from './generation-config';

type GenerationOptions = {
  retryMode?: boolean;
  modelSelections?: Partial<StepModelSelections>;
};

function getErrorMessage(err: any) {
  if (typeof err?.response?.data?.error === 'string') return err.response.data.error;
  if (typeof err?.response?.data?.message === 'string') return err.response.data.message;
  if (typeof err?.response?.data === 'string') return err.response.data;
  if (err?.message) return err.message;
  return String(err);
}

function getErrorDetails(err: any) {
  if (err?.response?.data) {
    try {
      return JSON.stringify(err.response.data, null, 2);
    } catch {
      return String(err.response.data);
    }
  }

  return err?.stack || err?.message || String(err);
}

function createStepError(step: string, tool: string, err: any) {
  const summary = getErrorMessage(err);
  const wrapped = new Error(`${step} failed: ${summary}`) as Error & {
    step: string;
    tool: string;
    summary: string;
    details: string;
  };

  wrapped.step = step;
  wrapped.tool = tool;
  wrapped.summary = summary;
  wrapped.details = getErrorDetails(err);
  return wrapped;
}

function resetStatusesForRetry(video: any) {
  video.status = 'generating';
  video.failedStep = '';
  video.failedTool = '';
  video.errorSummary = '';
  video.errorDetails = '';

  if (video.scriptStatus === 'failed') {
    video.scriptStatus = 'pending';
    video.voiceStatus = 'pending';
    video.imageStatus = 'pending';
    video.videoRenderStatus = 'pending';
    return;
  }

  if (video.voiceStatus === 'failed') {
    video.voiceStatus = 'pending';
    video.imageStatus = 'pending';
    video.videoRenderStatus = 'pending';
    return;
  }

  if (video.imageStatus === 'failed') {
    video.imageStatus = 'pending';
    video.videoRenderStatus = 'pending';
    return;
  }

  if (video.videoRenderStatus === 'failed') {
    video.videoRenderStatus = 'pending';
    return;
  }

  video.scriptStatus = 'pending';
  video.voiceStatus = 'pending';
  video.imageStatus = 'pending';
  video.videoRenderStatus = 'pending';
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
    const video = await Video.findById(videoId);
    const settings = (await Settings.findOne()) || {};

    if (!video) return;

    const retryMode = options?.retryMode || false;
    const settingsDefaults = settings.generationDefaults || {};
    const modelSelections = normalizeModelSelections(
      options?.modelSelections || video.modelSelections || (aiModel ? { script: aiModel } : undefined),
      settingsDefaults
    );

    video.sourceContent = content ?? video.sourceContent ?? '';
    video.promptType = promptType ?? video.promptType ?? 'idea';
    video.modelSelections = modelSelections;

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
    const audioPath = path.resolve(`public/audio/${idStr}.mp3`);
    const finalVideoPath = path.resolve(`public/videos/${idStr}.mp4`);
    const finalThumbnailPath = path.resolve(`public/images/${idStr}_thumb.png`);

    await fs.ensureDir(path.resolve('public/audio'));
    await fs.ensureDir(path.resolve('public/images'));
    await fs.ensureDir(path.resolve('public/videos'));

    if (video.scriptStatus !== 'done' || !video.script) {
      try {
        const scriptData = await generateTopicAndScript(settings, video.sourceContent, video.promptType, modelSelections.script);
        video.title = scriptData.title;
        video.description = scriptData.description;
        video.tags = scriptData.tags;
        video.script = JSON.stringify(scriptData.scenes);
        video.scriptStatus = 'done';
        await video.save();
      } catch (err: any) {
        video.scriptStatus = 'failed';
        await video.save();
        throw createStepError('Script generation', 'OpenAI / Gemini', err);
      }
    }

    let scriptDataObj: Array<{ text: string; imagePrompt: string }> = [];
    try {
      scriptDataObj = JSON.parse(video.script || '[]');
    } catch {
      scriptDataObj = [];
    }

    if (scriptDataObj.length === 0) {
      throw createStepError('Script parsing', 'Application', new Error('No scenes were available for voice, image, and render generation.'));
    }

    if (video.voiceStatus !== 'done' || !(await fs.pathExists(audioPath))) {
      try {
        const fullText = scriptDataObj.map((scene) => scene.text).join(' ');
        await generateVoiceover(fullText, audioPath, settings, modelSelections.voice);
        video.voiceStatus = 'done';
        await video.save();
      } catch (err: any) {
        video.voiceStatus = 'failed';
        await video.save();
        throw createStepError('Voiceover generation', 'ElevenLabs', err);
      }
    }

    const imagePaths = scriptDataObj.map((_, index) => path.resolve(`public/images/${idStr}_${index}.png`));
    const imagesReady = imagePaths.length > 0 && await Promise.all(imagePaths.map((imagePath) => fs.pathExists(imagePath))).then((results) => results.every(Boolean));

    if (video.imageStatus !== 'done' || !imagesReady) {
      try {
        for (let i = 0; i < scriptDataObj.length; i++) {
          await generateImage(scriptDataObj[i].imagePrompt, imagePaths[i], settings, modelSelections.image);
        }
        video.imageStatus = 'done';
        await video.save();
      } catch (err: any) {
        video.imageStatus = 'failed';
        await video.save();
        throw createStepError('Image generation', 'Leonardo API', err);
      }
    }

    if (video.videoRenderStatus !== 'done' || !(await fs.pathExists(finalVideoPath))) {
      try {
        await renderVideo(imagePaths, audioPath, finalVideoPath, modelSelections.video);
        video.videoPath = `/videos/${idStr}.mp4`;

        await generateThumbnail(finalVideoPath, finalThumbnailPath, modelSelections.video);
        video.thumbnail = `/images/${idStr}_thumb.png`;

        video.videoRenderStatus = 'done';
        video.status = 'generated';
        await video.save();
      } catch (err: any) {
        video.videoRenderStatus = 'failed';
        await video.save();
        throw createStepError('Video render', 'FFmpeg', err);
      }
    } else {
      video.status = 'generated';
      await video.save();
    }
  } catch (error: any) {
    console.error('Video generation failed:', error);

    try {
      await Video.findByIdAndUpdate(videoId, {
        status: 'failed',
        failedStep: error?.step || 'Generation pipeline',
        failedTool: error?.tool || 'Unknown tool',
        errorSummary: error?.summary || error?.message || 'Unknown failure',
        errorDetails: error?.details || getErrorDetails(error),
      });
    } catch {
      // Best-effort persistence of the failure state.
    }
  }
}
