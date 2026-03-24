import connectToDatabase from './mongodb';
import { Video } from '@/models/Video';
import { Settings } from '@/models/Settings';
import { generateTopicAndScript, generateVoiceover, generateImage } from './ai';
import { renderVideo, generateThumbnail } from './ffmpeg';
import path from 'path';
import fs from 'fs-extra';

export async function executeVideoGeneration(videoId: string, customTopic?: string) {
  try {
    await connectToDatabase();
    const video = await Video.findById(videoId);
    const settings = (await Settings.findOne()) || {};

    if (!video) return;

    // 1. Topic & Script
    video.status = 'generating';
    await video.save();
    
    const scriptData = await generateTopicAndScript(settings, customTopic);
    video.title = scriptData.title;
    video.description = scriptData.description;
    video.tags = scriptData.tags;
    video.script = JSON.stringify(scriptData.scenes);
    await video.save();

    const idStr = video._id.toString();
    const audioPath = path.resolve(`public/audio/${idStr}.mp3`);
    const finalVideoPath = path.resolve(`public/videos/${idStr}.mp4`);
    const finalThumbnailPath = path.resolve(`public/images/${idStr}_thumb.png`);

    await fs.ensureDir(path.resolve('public/audio'));
    await fs.ensureDir(path.resolve('public/images'));
    await fs.ensureDir(path.resolve('public/videos'));
    
    // 3. Voiceover
    const fullText = scriptData.scenes.map((s: any) => s.text).join(' ');
    await generateVoiceover(fullText, audioPath, settings);

    // 4. Images
    const imagePaths: string[] = [];
    for (let i = 0; i < scriptData.scenes.length; i++) {
      const scene = scriptData.scenes[i];
      const imagePath = path.resolve(`public/images/${idStr}_${i}.png`);
      await generateImage(scene.imagePrompt, imagePath, settings);
      imagePaths.push(imagePath);
    }

    // 5. Render Video
    await renderVideo(imagePaths, audioPath, finalVideoPath);
    video.videoPath = `/videos/${idStr}.mp4`;
    
    // 6. Thumbnail
    await generateThumbnail(finalVideoPath, finalThumbnailPath);
    video.thumbnail = `/images/${idStr}_thumb.png`;

    video.status = 'generated';
    await video.save();
  } catch (error: any) {
    console.error('Video generation failed:', error);
    await Video.findByIdAndUpdate(videoId, { status: 'failed' });
  }
}
