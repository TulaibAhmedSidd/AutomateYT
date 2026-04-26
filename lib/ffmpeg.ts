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

type RenderVideoOptions = {
  openaiApiKey?: string;
  backgroundMusicPath?: string;
  socialOverlayText?: string;
};

export async function concatenateAudioTracks(inputPaths: string[], outputPath: string) {
  if (inputPaths.length === 0) {
    throw new Error('No audio tracks were provided for concatenation.');
  }

  await fs.ensureDir(path.dirname(outputPath));

  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    inputPaths.forEach((inputPath) => {
      command.input(inputPath);
    });

    const concatFilter = `${inputPaths.map((_, index) => `[${index}:a]`).join('')}concat=n=${inputPaths.length}:v=0:a=1[aout]`;

    command
      .complexFilter([concatFilter])
      .outputOptions(['-map [aout]', '-c:a libmp3lame', '-q:a 2'])
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .save(outputPath);
  });
}

export async function renderVideo(
  images: string[],
  audioPath: string,
  outputPath: string,
  videoModel: string = 'ffmpeg-basic-vertical',
  options: RenderVideoOptions = {}
) {
  const renderConfig = getVideoRenderConfig(videoModel);
  const workerModule = await import('../worker.js');
  const createViralVideo =
    workerModule.createViralVideo ||
    workerModule.default?.createViralVideo;

  if (typeof createViralVideo !== 'function') {
    throw new Error('worker.js is missing createViralVideo().');
  }

  return createViralVideo({
    images,
    audioPath,
    outputPath,
    openaiApiKey: options.openaiApiKey,
    backgroundMusicPath: options.backgroundMusicPath,
    socialOverlayText: options.socialOverlayText,
    width: renderConfig.width,
    height: renderConfig.height,
    workspaceRoot: process.cwd(),
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
