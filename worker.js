/* eslint-disable @typescript-eslint/no-require-imports */
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs-extra');
const path = require('path');
const OpenAI = require('openai');

const DEFAULTS = {
  width: 1080,
  height: 1920,
  fps: 25,
  transitionDuration: 0.3,
  subtitleFontName: 'The Bold Font',
  socialOverlayText: 'Follow for more',
  subtitleModel: 'whisper-1',
};

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

function escapeFilterPath(inputPath) {
  return path
    .resolve(inputPath)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

function escapeDrawtext(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/,/g, '\\,');
}

function escapeAssText(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\r?\n/g, '\\N');
}

function toAssTime(seconds) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const totalCentiseconds = Math.round(safeSeconds * 100);
  const hours = Math.floor(totalCentiseconds / 360000);
  const minutes = Math.floor((totalCentiseconds % 360000) / 6000);
  const secs = Math.floor((totalCentiseconds % 6000) / 100);
  const centiseconds = totalCentiseconds % 100;

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
}

function normalizeWords(words) {
  if (!Array.isArray(words)) {
    return [];
  }

  return words
    .map((word, index) => {
      const text = String(word.word || '').trim();
      if (!text) {
        return null;
      }

      const start = Number(word.start);
      const rawEnd = Number(word.end);
      const end = rawEnd > start ? rawEnd : start + 0.18;

      return {
        id: index,
        word: text,
        start: Number.isFinite(start) ? start : 0,
        end: Number.isFinite(end) ? end : 0.18,
      };
    })
    .filter(Boolean);
}

function buildAssSubtitle(words, options = {}) {
  const fontName = options.subtitleFontName || DEFAULTS.subtitleFontName;
  const fontSize = options.subtitleFontSize || 26;
  const outline = options.outline || 2;
  const marginV = options.marginV || 120;
  const marginL = options.marginL || 120;
  const marginR = options.marginR || 120;

  const dialogues = words.map((entry) => {
    const animatedWord = `{\\an2\\fad(60,120)\\blur0.6\\bord2\\shad0\\t(0,90,\\fscx108\\fscy108)}${escapeAssText(entry.word)}`;
    return `Dialogue: 0,${toAssTime(entry.start)},${toAssTime(entry.end)},Default,,0,0,0,,${animatedWord}`;
  });

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 2',
    'ScaledBorderAndShadow: yes',
    'YCbCr Matrix: TV.601',
    '',
    '[V4+ Styles]',
    'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
    `Style: Default,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&HAA000000,-1,0,0,0,100,100,0,0,3,${outline},0,2,${marginL},${marginR},${marginV},1`,
    '',
    '[Events]',
    'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
    ...dialogues,
    '',
  ].join('\n');
}

async function transcribeAudioToWords(audioPath, apiKey, model = DEFAULTS.subtitleModel) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required for Whisper word-level subtitles.');
  }

  const client = new OpenAI({ apiKey });
  const response = await client.audio.transcriptions.create({
    file: fs.createReadStream(audioPath),
    model,
    response_format: 'verbose_json',
    timestamp_granularities: ['word'],
  });

  const words = normalizeWords(response.words);
  const duration = Number(response.duration) || (words.length > 0 ? words[words.length - 1].end : 0);

  if (words.length === 0) {
    throw new Error('Whisper did not return any word timestamps.');
  }

  return {
    text: response.text || '',
    language: response.language || 'en',
    duration,
    words,
  };
}

function findSubtitleFontPath(workspaceRoot) {
  const candidates = [
    path.join(workspaceRoot, 'public', 'fonts', 'TheBoldFont.ttf'),
    path.join(workspaceRoot, 'public', 'fonts', 'The Bold Font.ttf'),
    path.join(workspaceRoot, 'public', 'fonts', 'TheBoldFont.otf'),
    path.join(workspaceRoot, 'public', 'fonts', 'The Bold Font.otf'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function buildVideoFilters(images, options) {
  const width = options.width || DEFAULTS.width;
  const height = options.height || DEFAULTS.height;
  const fps = options.fps || DEFAULTS.fps;
  const sceneDuration = options.sceneDuration;
  const transitionDuration = options.transitionDuration || DEFAULTS.transitionDuration;
  const sceneFrames = Math.max(2, Math.round(sceneDuration * fps));
  const filters = [];
  const overscanHeight = Math.round(height * 1.2);

  for (let i = 0; i < images.length; i += 1) {
    filters.push(
      `[${i}:v]scale=${width}:${overscanHeight}:force_original_aspect_ratio=increase,crop=${width}:${overscanHeight},zoompan=z='min(zoom+0.0015,1.5)':d=${sceneFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps},trim=duration=${sceneDuration.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`
    );
  }

  if (images.length === 1) {
    return {
      filters,
      finalVideoLabel: 'v0',
      totalDuration: sceneDuration,
    };
  }

  let currentLabel = 'v0';
  let currentDuration = sceneDuration;

  for (let i = 1; i < images.length; i += 1) {
    const nextLabel = `v${i}`;
    const outputLabel = `vx${i}`;
    const offset = Math.max(0, currentDuration - transitionDuration);
    filters.push(
      `[${currentLabel}][${nextLabel}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset.toFixed(3)}[${outputLabel}]`
    );
    currentLabel = outputLabel;
    currentDuration += sceneDuration - transitionDuration;
  }

  return {
    filters,
    finalVideoLabel: currentLabel,
    totalDuration: currentDuration,
  };
}

function buildAudioFilters(voiceInputIndex, backgroundInputIndex, audioDuration) {
  const filters = [
    `[${voiceInputIndex}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=1[voice]`,
  ];

  if (backgroundInputIndex === null) {
    filters.push('[voice]alimiter=limit=0.95[aout]');
    return filters;
  }

  filters.push(
    `[${backgroundInputIndex}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo,volume=0.22,atrim=duration=${audioDuration.toFixed(3)},asetpts=PTS-STARTPTS[bg]`
  );
  filters.push('[bg][voice]sidechaincompress=threshold=0.015:ratio=10:attack=15:release=320:makeup=1[bgduck]');
  filters.push("[voice][bgduck]amix=inputs=2:weights='1 0.45':normalize=0,alimiter=limit=0.95[aout]");

  return filters;
}

async function renderWithFfmpeg(config) {
  await fs.ensureDir(path.dirname(config.outputPath));

  return new Promise((resolve, reject) => {
    const command = ffmpeg();

    for (const imagePath of config.images) {
      command.input(imagePath).inputOptions(['-loop 1', `-t ${config.sceneDuration.toFixed(3)}`]);
    }

    command.input(config.voiceoverPath);

    if (config.backgroundMusicPath) {
      command.input(config.backgroundMusicPath).inputOptions(['-stream_loop -1']);
    }

    const videoFilterResult = buildVideoFilters(config.images, config);
    const voiceInputIndex = config.images.length;
    const backgroundInputIndex = config.backgroundMusicPath ? voiceInputIndex + 1 : null;
    const filters = [
      ...videoFilterResult.filters,
      ...buildAudioFilters(voiceInputIndex, backgroundInputIndex, config.audioDuration),
    ];

    const subtitleFilter =
      `[${videoFilterResult.finalVideoLabel}]subtitles='${escapeFilterPath(config.subtitlePath)}'` +
      (config.fontsDir ? `:fontsdir='${escapeFilterPath(config.fontsDir)}'` : '') +
      '[vsub]';

    const drawtextFilter =
      `[vsub]drawtext=text='${escapeDrawtext(config.socialOverlayText)}'` +
      ':x=w-tw-40' +
      ':y=60' +
      ':fontcolor=white' +
      ':fontsize=42' +
      ':box=1' +
      ':boxcolor=black@0.55' +
      ':boxborderw=18' +
      (config.overlayFontPath ? `:fontfile='${escapeFilterPath(config.overlayFontPath)}'` : '') +
      '[vout]';

    filters.push(subtitleFilter);
    filters.push(drawtextFilter);

    command
      .complexFilter(filters)
      .outputOptions([
        '-map [vout]',
        '-map [aout]',
        '-c:v libx264',
        '-preset medium',
        '-profile:v high',
        '-pix_fmt yuv420p',
        '-movflags +faststart',
        '-r 25',
        '-c:a aac',
        '-b:a 192k',
        '-shortest',
      ])
      .on('end', resolve)
      .on('error', reject)
      .save(config.outputPath);
  });
}

async function createViralVideo(input) {
  const images = Array.isArray(input.images) ? input.images.map((entry) => path.resolve(entry)) : [];
  const voiceoverPath = path.resolve(input.audioPath || input.voiceoverPath || '');
  const outputPath = path.resolve(input.outputPath || '');

  if (images.length === 0) {
    throw new Error('createViralVideo requires at least one image path.');
  }

  if (!voiceoverPath || !(await fs.pathExists(voiceoverPath))) {
    throw new Error(`Voiceover file not found: ${voiceoverPath}`);
  }

  if (!outputPath) {
    throw new Error('createViralVideo requires an outputPath.');
  }

  for (const imagePath of images) {
    if (!(await fs.pathExists(imagePath))) {
      throw new Error(`Image file not found: ${imagePath}`);
    }
  }

  const workspaceRoot = input.workspaceRoot ? path.resolve(input.workspaceRoot) : process.cwd();
  const openaiApiKey = input.openaiApiKey || process.env.OPENAI_API_KEY || '';
  const backgroundMusicCandidate = input.backgroundMusicPath
    ? path.resolve(input.backgroundMusicPath)
    : path.join(workspaceRoot, 'public', 'audio', 'background-music.mp3');
  const backgroundMusicPath = (await fs.pathExists(backgroundMusicCandidate)) ? backgroundMusicCandidate : null;
  const transcription = await transcribeAudioToWords(voiceoverPath, openaiApiKey, input.subtitleModel);
  const transitionDuration = Number(input.transitionDuration) || DEFAULTS.transitionDuration;
  const sceneDuration = Math.max(
    3,
    (transcription.duration + Math.max(0, images.length - 1) * transitionDuration) / images.length
  );
  const subtitlePath = path.resolve(
    input.subtitlePath || outputPath.replace(/\.mp4$/i, '.ass')
  );
  const transcriptPath = path.resolve(
    input.transcriptPath || outputPath.replace(/\.mp4$/i, '.transcript.json')
  );
  const fontsDir = path.join(workspaceRoot, 'public', 'fonts');
  const overlayFontPath = findSubtitleFontPath(workspaceRoot);
  const subtitleContents = buildAssSubtitle(transcription.words, {
    subtitleFontName: input.subtitleFontName || DEFAULTS.subtitleFontName,
  });

  await fs.ensureDir(path.dirname(subtitlePath));
  await fs.ensureDir(path.dirname(transcriptPath));
  await fs.writeFile(subtitlePath, subtitleContents, 'utf8');
  await fs.writeJson(
    transcriptPath,
    {
      ...transcription,
      generatedAt: new Date().toISOString(),
    },
    { spaces: 2 }
  );

  await renderWithFfmpeg({
    images,
    voiceoverPath,
    backgroundMusicPath,
    outputPath,
    subtitlePath,
    transcriptPath,
    fontsDir: (await fs.pathExists(fontsDir)) ? fontsDir : null,
    overlayFontPath,
    socialOverlayText: input.socialOverlayText || DEFAULTS.socialOverlayText,
    width: Number(input.width) || DEFAULTS.width,
    height: Number(input.height) || DEFAULTS.height,
    fps: Number(input.fps) || DEFAULTS.fps,
    transitionDuration,
    sceneDuration,
    audioDuration: transcription.duration,
  });

  return {
    outputPath,
    subtitlePath,
    transcriptPath,
    duration: transcription.duration,
    backgroundMusicPath,
  };
}

async function runFromCli() {
  const configArg = process.argv[2];

  if (!configArg) {
    throw new Error('Pass a JSON config file path to worker.js.');
  }

  const configPath = path.resolve(configArg);
  const config = await fs.readJson(configPath);
  const result = await createViralVideo(config);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  createViralVideo,
};
