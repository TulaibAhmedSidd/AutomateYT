import path from 'path';
import { executeVideoGeneration } from './generator';
import { uploadVideo } from './youtube';
import connectToDatabase from './mongodb';
import { Video } from '@/models/Video';
import { Settings } from '@/models/Settings';
import type { StepModelSelections } from './generation-config';
import { hydrateVideoRuntime } from './video-runtime';

type QueueVideo = {
  _id: { toString(): string };
  videoPath?: string;
  thumbnail?: string;
  status: string;
  uploadStatus?: 'not_uploaded' | 'uploading' | 'uploaded' | 'failed';
  uploadError?: string;
  youtubeId?: string;
  title?: string;
  description?: string;
  tags?: string[];
  save(): Promise<unknown>;
  toObject(): Record<string, unknown>;
};

export async function addVideoJob(
  videoId: string,
  content?: string,
  promptType?: string,
  aiModel?: string,
  options?: { retryMode?: boolean; modelSelections?: Partial<StepModelSelections> }
) {
  executeVideoGeneration(videoId, content, promptType, aiModel, options).catch(console.error);
  return { id: videoId };
}

export async function addUploadJob(videoId: string) {
  (async () => {
    try {
      await connectToDatabase();
      const [video, settings] = await Promise.all([
        Video.findById(videoId) as Promise<QueueVideo | null>,
        Settings.findOne(),
      ]);

      if (!video) throw new Error('Video not found');

      video.uploadStatus = 'uploading';
      video.uploadError = '';
      await Video.findByIdAndUpdate(videoId, { uploadStatus: 'uploading', uploadError: '' });

      const runtime = await hydrateVideoRuntime(video.toObject());
      if (!runtime.videoPath) {
        throw new Error('Rendered video file is missing, so YouTube upload cannot start.');
      }

      const finalVideoPath = path.resolve('public' + (video.videoPath || runtime.videoPath));
      const finalThumbnailPath = video.thumbnail ? path.resolve('public' + video.thumbnail) : '';
      const uploadResult = await uploadVideo(video, finalVideoPath, finalThumbnailPath, settings || {});

      video.status = 'uploaded';
      video.uploadStatus = 'uploaded';
      video.uploadError = '';
      video.youtubeId = uploadResult.id || '';
      await Video.findByIdAndUpdate(videoId, {
        status: 'uploaded',
        uploadStatus: 'uploaded',
        uploadError: '',
        youtubeId: uploadResult.id || ''
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'YouTube upload failed';
      console.error('Upload failed:', err);
      await Video.findByIdAndUpdate(videoId, {
        uploadStatus: 'failed',
        uploadError: message,
        status: 'generated',
      });
    }
  })();

  return { id: videoId };
}
