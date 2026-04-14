import { executeVideoGeneration } from './generator';
import { uploadVideo } from './youtube';
import connectToDatabase from './mongodb';
import { Video } from '@/models/Video';
import { Settings } from '@/models/Settings';
import path from 'path';
import type { StepModelSelections } from './generation-config';

// Replaced BullMQ with simple async functions to remove the Redis requirement
export async function addVideoJob(
  videoId: string,
  content?: string,
  promptType?: string,
  aiModel?: string,
  options?: { retryMode?: boolean; modelSelections?: Partial<StepModelSelections> }
) {
  // Fire and forget (Runs entirely in background locally or on non-Vercel hosts)
  executeVideoGeneration(videoId, content, promptType, aiModel, options).catch(console.error);
  return { id: videoId };
}

export async function addUploadJob(videoId: string) {
  // Simple background upload
  (async () => {
     try {
         await connectToDatabase();
         const video = await Video.findById(videoId);
         const settings = await Settings.findOne();
         const finalVideoPath = path.resolve('public' + video.videoPath);
         const finalThumbnailPath = path.resolve('public' + video.thumbnail);
         await uploadVideo(video, finalVideoPath, finalThumbnailPath, settings);
         
         video.status = 'uploaded';
         await video.save();
     } catch (err) {
         console.error('Upload failed:', err);
         await Video.findByIdAndUpdate(videoId, { status: 'failed' });
     }
  })();
  return { id: videoId };
}
