import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs-extra';
import path from 'path';
import { getVideoRenderConfig } from './generation-config';

function resolveFfmpegPath() {
  const directStaticPath = typeof ffmpegStatic === 'string' ? ffmpegStatic : '';
  const candidatePaths = [
    directStaticPath,
    path.resolve(process.cwd(), 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'),
  ].filter(Boolean);

  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`FFmpeg binary was not found. Checked: ${candidatePaths.join(', ')}`);
}

ffmpeg.setFfmpegPath(resolveFfmpegPath());

export async function renderVideo(images: string[], audioPath: string, outputPath: string, videoModel: string = 'ffmpeg-basic-vertical') {
  return new Promise((resolve, reject) => {
    const renderConfig = getVideoRenderConfig(videoModel);
    const command = ffmpeg();

    images.forEach((img) => {
      command.input(img).inputOptions(['-loop 1', '-t 5']);
    });

    command.input(audioPath);

    let filterGraph = '';
    const numImages = images.length;
    for (let i = 0; i < numImages; i++) {
      const scaledHeight = Math.round(renderConfig.height * 1.2);
      filterGraph += `[${i}:v]scale=${renderConfig.width}x${scaledHeight},zoompan=z='zoom+0.001':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=125:s=${renderConfig.width}x${renderConfig.height}[v${i}];`;
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
        `-map ${numImages}:a`,
        '-c:v libx264',
        '-preset fast',
        '-pix_fmt yuv420p',
        '-b:v 4M',
        '-c:a aac',
        '-b:a 192k',
        '-shortest'
      ])
      .save(outputPath)
      .on('end', resolve)
      .on('error', reject);
  });
}

export async function generateThumbnail(videoPath: string, outputPath: string, videoModel: string = 'ffmpeg-basic-vertical') {
  return new Promise((resolve, reject) => {
    const renderConfig = getVideoRenderConfig(videoModel);

    ffmpeg()
      .input(videoPath)
      .seekInput('00:00:01')
      .screenshot({
        timestamps: [1],
        folder: path.dirname(outputPath),
        filename: path.basename(outputPath),
        size: renderConfig.thumbnailSize
      })
      .on('end', () => resolve(outputPath))
      .on('error', reject);
  });
}
