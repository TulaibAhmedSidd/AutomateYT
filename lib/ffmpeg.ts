import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs-extra';
import path from 'path';

ffmpeg.setFfmpegPath(ffmpegStatic as string);

export async function renderVideo(images: string[], audioPath: string, outputPath: string) {
  return new Promise((resolve, reject) => {
    // Basic zoom pan slide show generator using fluent-ffmpeg.
    // For production you may want a complex filter script to handle transition per scene perfectly,
    // but here is a functional pipeline.

    const command = ffmpeg();
    images.forEach(img => {
      command.input(img).inputOptions(['-loop 1', '-t 5']); // assume 5s per scene for simplicity
    });

    command.input(audioPath);

    // Apply zoom pan
    let filterGraph = '';
    const numImages = images.length;
    for (let i = 0; i < numImages; i++) {
        // Simple zoom effect
        filterGraph += `[${i}:v]scale=1280x2275,zoompan=z='zoom+0.001':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=1080x1920[v${i}];`;
    }

    let concatStr = '';
    for (let i = 0; i < numImages; i++) {
      concatStr += `[v${i}]`;
    }
    filterGraph += `${concatStr}concat=n=${numImages}:v=1:a=0[outv]`;

    command
      .complexFilter(filterGraph)
      .outputOptions([
        '-map [outv]',
        `-map ${numImages}:a`, // audio mapping
        '-c:v libx264',
        '-preset fast',
        '-pix_fmt yuv420p',
        '-b:v 4M',          // bitrate
        '-c:a aac',
        '-b:a 192k',
        '-shortest'
      ])
      .save(outputPath)
      .on('end', resolve)
      .on('error', reject);
  });
}

// Extract thumbnail
export async function generateThumbnail(videoPath: string, outputPath: string) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(videoPath)
      .seekInput('00:00:01') // capture at 1s
      .screenshot({
        folder: path.dirname(outputPath),
        filename: path.basename(outputPath),
        size: '1080x1920'
      })
      .on('end', () => resolve(outputPath))
      .on('error', reject);
  });
}
