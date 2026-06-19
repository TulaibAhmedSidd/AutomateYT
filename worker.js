/* eslint-disable @typescript-eslint/no-require-imports */
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
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

// resolved + reused below for direct child_process probes

function escapeFilterPath(inputPath) {
  return path
    .resolve(inputPath)
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'");
}

// Escape a string for use as an UNQUOTED filtergraph value (specifically drawtext text=).
// Wrapping the value in single quotes does NOT work on this ffmpeg-static build for content
// containing apostrophes — `\'` inside `'...'` closes the quote early and the rest of the
// filter chain gets re-interpreted. The reliable approach is unquoted with `\` escaping every
// metachar the filtergraph parser cares about. Backslash MUST be escaped first.
// Real newlines are preserved (wrapText inserts them so drawtext renders multi-line).
function escapeDrawtext(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/%/g, '\\%');
}

const FFMPEG_BIN_PATH = resolveFfmpegPath();
ffmpeg.setFfmpegPath(FFMPEG_BIN_PATH);

// `ffmpeg-static` only ships the `ffmpeg` binary (no `ffprobe`), so fluent-ffmpeg's
// `.ffprobe()` silently fails on most machines. We probe duration ourselves by
// running `ffmpeg -i <file>` and parsing the "Duration: HH:MM:SS.SS" line out of stderr.
// ffmpeg exits non-zero when given no output, which is expected — we still get the metadata.
function probeAudioDuration(filePath) {
  return new Promise((resolve) => {
    if (!filePath) return resolve(0);
    let stderr = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    try {
      const proc = spawn(FFMPEG_BIN_PATH, ['-hide_banner', '-i', filePath, '-f', 'null', '-'], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.on('error', () => finish(0));
      proc.on('close', () => {
        const match = stderr.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (!match) return finish(0);
        const hours = Number(match[1]) || 0;
        const minutes = Number(match[2]) || 0;
        const seconds = Number(match[3]) || 0;
        const total = hours * 3600 + minutes * 60 + seconds;
        finish(Number.isFinite(total) && total > 0 ? total : 0);
      });
    } catch {
      finish(0);
    }
  });
}

function normalizeOverlayFontFamily(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function findFontFileForFamily(fontsDir, family) {
  if (!fontsDir || !fs.existsSync(fontsDir)) return '';
  const wanted = normalizeOverlayFontFamily(family);
  if (!wanted) return '';

  const entries = fs.readdirSync(fontsDir).filter((name) => /\.(ttf|otf)$/i.test(name));
  const exact = entries.find((name) => normalizeOverlayFontFamily(path.parse(name).name) === wanted);
  if (exact) return path.join(fontsDir, exact);

  const partial = entries.find((name) => normalizeOverlayFontFamily(path.parse(name).name).includes(wanted));
  if (partial) return path.join(fontsDir, partial);

  return '';
}

function cssColorToFfmpeg(value, fallback) {
  const fallbackSpec = fallback || '0xFFFFFF';
  const raw = String(value || '').trim();
  if (!raw) return fallbackSpec;

  const rgba = raw.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (rgba) {
    const [, r, g, b, a] = rgba;
    const hex = [r, g, b]
      .map((channel) => Math.max(0, Math.min(255, Number(channel))).toString(16).padStart(2, '0'))
      .join('');
    const alpha = a === undefined ? 1 : Math.max(0, Math.min(1, Number(a)));
    return `0x${hex.toUpperCase()}@${alpha.toFixed(2)}`;
  }

  const hex3 = raw.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const [, h] = hex3;
    const expanded = h.split('').map((char) => char + char).join('');
    return `0x${expanded.toUpperCase()}`;
  }

  const hex6 = raw.match(/^#([0-9a-f]{6})$/i);
  if (hex6) {
    return `0x${hex6[1].toUpperCase()}`;
  }

  const hex8 = raw.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
  if (hex8) {
    const alpha = parseInt(hex8[2], 16) / 255;
    return `0x${hex8[1].toUpperCase()}@${alpha.toFixed(2)}`;
  }

  return raw;
}

// The studio preview shows fontSize as raw CSS pixels in a small 9:16 box (typically 600-900px tall),
// so 34px there looks substantial. The final video is 1080x1920 — the same 34 literal pixels would be
// a 1.7% sliver and look like junk. Scale fontSize and box padding by the ratio of the actual frame
// height to a reference of 720px so what the user sees in the studio is roughly what they get in MP4.
const FONT_SCALE_REFERENCE_HEIGHT = 720;
// Average proportional-font character width in em units. ~0.55 works for Arial/Inter/Helvetica
// well enough as a wrapping heuristic. Final box auto-sizes to actual text anyway.
const AVG_CHAR_WIDTH_EM = 0.55;

function splitWords(text) {
  return String(text)
    .replace(/\r?\n/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

// Greedy word-wrap. Returns the input as one string with embedded newlines so drawtext renders
// multi-line. drawtext respects literal `\n` inside the text value.
function wrapText(text, maxCharsPerLine) {
  const words = splitWords(text);
  if (words.length === 0) return '';
  const safeMax = Math.max(6, maxCharsPerLine);
  const lines = [];
  let current = '';
  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length <= safeMax) {
      current += ' ' + word;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

function buildOverlayDrawtextFilters(overlayScenes, sceneTimings, options) {
  const width = options.width || DEFAULTS.width;
  const height = options.height || DEFAULTS.height;
  const fontsDir = options.fontsDir || '';
  const defaultFontFile = options.overlayFontPath || '';
  const fontScale = height / FONT_SCALE_REFERENCE_HEIGHT;
  // Horizontal padding from the frame edges — keeps captions away from the screen border.
  const sidePadding = Math.round(width * 0.06);

  // First pass: build the karaoke-state list (one entry per "this state should be visible
  // from t_start to t_end") for every scene+layer, so we know the total count and can label
  // the very last entry [vout].
  const states = [];
  overlayScenes.forEach((scene, sceneIndex) => {
    const timing = sceneTimings[sceneIndex];
    if (!timing) return;
    const layers = Array.isArray(scene && scene.layers) ? scene.layers : [];
    if (layers.length === 0) return;

    const sceneStart = Number(timing.start) || 0;
    const sceneEnd = Number(timing.end) || sceneStart;
    if (sceneEnd <= sceneStart) return;
    const sceneDuration = sceneEnd - sceneStart;

    layers.forEach((layer, layerIndex) => {
      const rawText = String((layer && layer.text) || '').trim();
      if (!rawText) return;

      const userFontSize = Math.max(10, Number((layer && layer.fontSize) || 32));
      const fontSize = Math.max(18, Math.round(userFontSize * fontScale));
      const charWidthPx = Math.max(1, fontSize * AVG_CHAR_WIDTH_EM);
      const availableWidth = Math.max(1, width - 2 * sidePadding);
      const maxCharsPerLine = Math.max(8, Math.floor(availableWidth / charWidthPx));

      const words = splitWords(rawText);
      if (words.length === 0) return;
      // Per-word duration: divide the scene's audio evenly across the visible words. Without
      // Whisper timestamps this is the closest we can get to "moves with the voice".
      const perWord = sceneDuration / words.length;

      for (let w = 1; w <= words.length; w += 1) {
        const cumulative = words.slice(0, w).join(' ');
        const wrapped = wrapText(cumulative, maxCharsPerLine);
        const wordStart = sceneStart + (w - 1) * perWord;
        // The last state for the scene holds until sceneEnd so the final caption doesn't
        // disappear early.
        const wordEnd = w === words.length ? sceneEnd : sceneStart + w * perWord;
        states.push({
          sceneIndex,
          layerIndex,
          wordIndex: w - 1,
          isFirstWordOfLayer: w === 1,
          isFirstStateOverall: false, // patched below
          layer,
          sceneStart,
          sceneEnd,
          wordStart,
          wordEnd,
          fontSize,
          wrappedText: wrapped,
        });
      }
    });
  });

  if (states.length === 0) {
    return [`[${options.inputLabel || 'vbase'}]null[vout]`];
  }
  states[0].isFirstStateOverall = true;

  const filters = [];
  let inputLabel = options.inputLabel || 'vbase';

  states.forEach((state, stateIndex) => {
    const layer = state.layer;
    const boxBorder = Math.max(12, Math.round(28 * fontScale));
    const xPercent = Math.max(0, Math.min(100, Number((layer && layer.x) || 0)));
    const yPercent = Math.max(0, Math.min(100, Number((layer && layer.y) || 0)));
    // Anchor the text to user's percentage but clamp so it never extends past the right
    // edge — drawtext's x expression supports `min()` and `text_w`/`w` for that.
    const baseX = Math.round((width * xPercent) / 100);
    const baseY = Math.round((height * yPercent) / 100);
    const fontFile = findFontFileForFamily(fontsDir, layer && layer.fontFamily) || defaultFontFile;
    if (!fontFile) {
      throw new Error('No font file available for overlay rendering. Add a .ttf to public/fonts/.');
    }
    const fontColorSpec = cssColorToFfmpeg(layer && layer.color, '0xFFFFFF');
    const boxColorSpec = cssColorToFfmpeg(layer && layer.background, '0x000000@0.55');
    const animation = String((layer && layer.animation) || 'fade-in');
    const fadeIn = 0.3;

    let yOption = `y=${baseY}`;
    let alphaOption = '';

    // Fade/slide animations only on the FIRST word of each layer — subsequent words would
    // re-fade every word which looks twitchy. Hold full alpha for word 2..N.
    const fadeAlpha = `'if(lt(t-${state.sceneStart.toFixed(3)},${fadeIn}),(t-${state.sceneStart.toFixed(3)})/${fadeIn},1)'`;
    if (state.isFirstWordOfLayer) {
      if (animation === 'fade-in') {
        alphaOption = `:alpha=${fadeAlpha}`;
      } else if (animation === 'slide-up') {
        yOption = `y='${baseY}+max(0,(${fadeIn}-(t-${state.sceneStart.toFixed(3)}))/${fadeIn}*60)'`;
        alphaOption = `:alpha=${fadeAlpha}`;
      } else if (animation === 'zoom-in' || animation === 'typewriter') {
        alphaOption = `:alpha=${fadeAlpha}`;
      }
    }

    // Clamp x so multi-line text stays within the frame even if user's x% would push the
    // box off-right. `text_w` is drawtext's evaluated width of the rendered text.
    const xExpr = `'min(${baseX},${width - sidePadding}-text_w)'`;

    const isLast = stateIndex === states.length - 1;
    const outputLabel = isLast ? 'vout' : `vo_${state.sceneIndex}_${state.layerIndex}_${state.wordIndex}`;

    const drawtext =
      `[${inputLabel}]drawtext=text=${escapeDrawtext(state.wrappedText)}` +
      `:x=${xExpr}` +
      `:${yOption}` +
      `:fontsize=${state.fontSize}` +
      `:fontcolor=${fontColorSpec}` +
      alphaOption +
      `:box=1:boxcolor=${boxColorSpec}:boxborderw=${boxBorder}` +
      `:line_spacing=8` +
      `:fontfile=${escapeFilterPath(fontFile)}` +
      `:enable='between(t,${state.wordStart.toFixed(3)},${state.wordEnd.toFixed(3)})'` +
      `[${outputLabel}]`;

    filters.push(drawtext);
    inputLabel = outputLabel;
  });

  if (inputLabel !== 'vout') {
    filters.push(`[${inputLabel}]null[vout]`);
  }

  return filters;
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

// drawtext requires a usable font file — ffmpeg-static doesn't bundle fontconfig so the
// `font=` lookup fallback isn't available. Resolve in this priority order:
//   1. Any "Bold Font" variant the project historically used (kept for backwards-compat).
//   2. The first .ttf/.otf actually present in public/fonts/ (lets users drop in any font).
//   3. A well-known system font for the current OS (always present on a normal machine).
// Returns null only when literally nothing is available — caller should error with a clear
// message instead of silently producing a broken filter.
function findSubtitleFontPath(workspaceRoot) {
  const projectFontsDir = path.join(workspaceRoot, 'public', 'fonts');
  const projectCandidates = [
    path.join(projectFontsDir, 'TheBoldFont.ttf'),
    path.join(projectFontsDir, 'The Bold Font.ttf'),
    path.join(projectFontsDir, 'TheBoldFont.otf'),
    path.join(projectFontsDir, 'The Bold Font.otf'),
  ];

  for (const candidate of projectCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  if (fs.existsSync(projectFontsDir)) {
    try {
      const entries = fs.readdirSync(projectFontsDir).filter((name) => /\.(ttf|otf)$/i.test(name));
      if (entries.length > 0) {
        return path.join(projectFontsDir, entries[0]);
      }
    } catch {
      // Fall through to system font lookup.
    }
  }

  const systemCandidates = [];
  if (process.platform === 'win32') {
    const winDir = process.env.WINDIR || 'C:/Windows';
    systemCandidates.push(
      path.join(winDir, 'Fonts', 'arialbd.ttf'),
      path.join(winDir, 'Fonts', 'arial.ttf'),
      path.join(winDir, 'Fonts', 'segoeuib.ttf'),
      path.join(winDir, 'Fonts', 'segoeui.ttf'),
      path.join(winDir, 'Fonts', 'verdanab.ttf'),
      path.join(winDir, 'Fonts', 'verdana.ttf')
    );
  } else if (process.platform === 'darwin') {
    systemCandidates.push(
      '/System/Library/Fonts/Helvetica.ttc',
      '/System/Library/Fonts/HelveticaNeue.ttc',
      '/Library/Fonts/Arial Bold.ttf',
      '/Library/Fonts/Arial.ttf',
      '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
    );
  } else {
    systemCandidates.push(
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
      '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf'
    );
  }

  for (const candidate of systemCandidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function buildVideoFilters(images, options) {
  const width = options.width || DEFAULTS.width;
  const height = options.height || DEFAULTS.height;
  const fps = options.fps || DEFAULTS.fps;
  const transitionDuration = options.transitionDuration || DEFAULTS.transitionDuration;
  const perSceneDurations = options.perSceneDurations;
  const filters = [];
  const overscanHeight = Math.round(height * 1.2);

  for (let i = 0; i < images.length; i += 1) {
    const dur = perSceneDurations[i];
    const sceneFrames = Math.max(2, Math.round(dur * fps));
    filters.push(
      `[${i}:v]scale=${width}:${overscanHeight}:force_original_aspect_ratio=increase,crop=${width}:${overscanHeight},zoompan=z='min(zoom+0.0015,1.5)':d=${sceneFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps},trim=duration=${dur.toFixed(3)},setpts=PTS-STARTPTS[v${i}]`
    );
  }

  if (images.length === 1) {
    return {
      filters,
      finalVideoLabel: 'v0',
      totalDuration: perSceneDurations[0],
    };
  }

  let currentLabel = 'v0';
  let currentDuration = perSceneDurations[0];

  for (let i = 1; i < images.length; i += 1) {
    const nextLabel = `v${i}`;
    const outputLabel = `vx${i}`;
    const offset = Math.max(0, currentDuration - transitionDuration);
    filters.push(
      `[${currentLabel}][${nextLabel}]xfade=transition=fade:duration=${transitionDuration}:offset=${offset.toFixed(3)}[${outputLabel}]`
    );
    currentLabel = outputLabel;
    currentDuration += perSceneDurations[i] - transitionDuration;
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

function buildSceneTimings(perSceneDurations, transitionDuration) {
  const timings = [];
  let cursor = 0;
  for (let i = 0; i < perSceneDurations.length; i += 1) {
    const dur = perSceneDurations[i];
    const start = cursor;
    const end = start + dur;
    timings.push({ start, end });
    cursor += dur - transitionDuration;
  }
  return timings;
}

async function renderWithFfmpeg(config) {
  await fs.ensureDir(path.dirname(config.outputPath));

  return new Promise((resolve, reject) => {
    const command = ffmpeg();
    const perSceneDurations = config.perSceneDurations;

    for (let i = 0; i < config.images.length; i += 1) {
      command.input(config.images[i]).inputOptions(['-loop 1', `-t ${perSceneDurations[i].toFixed(3)}`]);
    }

    command.input(config.voiceoverPath);

    if (config.backgroundMusicPath) {
      command.input(config.backgroundMusicPath).inputOptions(['-stream_loop -1']);
    }

    const videoFilterResult = buildVideoFilters(config.images, {
      width: config.width,
      height: config.height,
      fps: config.fps,
      transitionDuration: config.transitionDuration,
      perSceneDurations,
    });
    const voiceInputIndex = config.images.length;
    const backgroundInputIndex = config.backgroundMusicPath ? voiceInputIndex + 1 : null;
    const filters = [
      ...videoFilterResult.filters,
      ...buildAudioFilters(voiceInputIndex, backgroundInputIndex, config.audioDuration),
    ];

    const hasLayeredOverlays = Array.isArray(config.overlayScenes) && config.overlayScenes.some(
      (scene) => scene && Array.isArray(scene.layers) && scene.layers.length > 0
    );

    if (config.disableAutoCaptions) {
      // Rename the final video stream so the overlay builder can chain off it.
      filters.push(`[${videoFilterResult.finalVideoLabel}]null[vbase]`);
      if (hasLayeredOverlays) {
        const sceneTimings = buildSceneTimings(
          perSceneDurations,
          config.transitionDuration || DEFAULTS.transitionDuration
        );
        const overlayFilters = buildOverlayDrawtextFilters(config.overlayScenes, sceneTimings, {
          width: config.width,
          height: config.height,
          fontsDir: config.fontsDir,
          overlayFontPath: config.overlayFontPath,
          inputLabel: 'vbase',
        });
        filters.push(...overlayFilters);
      } else {
        // No overlay text either — produce a clean video with no burned-in captions.
        filters.push('[vbase]null[vout]');
      }
    } else {
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
    }

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

  const overlayScenes = Array.isArray(input.overlayScenes) ? input.overlayScenes : [];
  const hasUserOverlays = overlayScenes.some(
    (scene) => scene && Array.isArray(scene.layers) && scene.layers.length > 0
  );
  // The user requested that we no longer burn Whisper word-by-word captions into the video.
  // Treat overlays as the source of truth and skip the legacy ASS path whenever any layers exist,
  // or whenever the caller opts in explicitly via disableAutoCaptions.
  const disableAutoCaptions = hasUserOverlays || Boolean(input.disableAutoCaptions);

  const transitionDuration = Number(input.transitionDuration) || DEFAULTS.transitionDuration;

  let transcription = null;
  // Caller-supplied per-scene durations win (these come from probing the per-segment audio files
  // in the generator). If absent, we evenly distribute the total audio duration across the images
  // so the rendered MP4 always matches the voiceover length instead of being clipped to 5s defaults.
  let perSceneDurations = Array.isArray(input.sceneDurations)
    ? input.sceneDurations.map((value) => Math.max(0.5, Number(value) || 0))
    : [];

  let audioDuration = Number(input.audioDuration) || 0;

  if (!disableAutoCaptions) {
    transcription = await transcribeAudioToWords(voiceoverPath, openaiApiKey, input.subtitleModel);
    audioDuration = transcription.duration;
  } else {
    if (!audioDuration) {
      audioDuration = await probeAudioDuration(voiceoverPath);
    }
    if (!audioDuration && perSceneDurations.length === images.length) {
      audioDuration = perSceneDurations.reduce((sum, value) => sum + value, 0);
    }
    if (!audioDuration) {
      audioDuration = Math.max(3, images.length * 5);
    }
  }

  if (perSceneDurations.length !== images.length) {
    // Fall back to an even spread of the (now correct) audio length. The +(n-1)*xfade accounts
    // for the visual time the crossfade transitions overlap two scenes.
    const evenDuration = Math.max(
      3,
      (audioDuration + Math.max(0, images.length - 1) * transitionDuration) / images.length
    );
    perSceneDurations = images.map(() => evenDuration);
  } else if (perSceneDurations.length > 1) {
    // Account for the time consumed by crossfades so total visual length matches the audio length.
    const padding = transitionDuration;
    perSceneDurations = perSceneDurations.map((dur, index) =>
      index === 0 || index === perSceneDurations.length - 1 ? dur + padding / 2 : dur + padding
    );
  }

  const fontsDir = path.join(workspaceRoot, 'public', 'fonts');
  const overlayFontPath = findSubtitleFontPath(workspaceRoot);
  const resolvedFontsDir = (await fs.pathExists(fontsDir)) ? fontsDir : null;

  if (disableAutoCaptions && hasUserOverlays && !overlayFontPath) {
    throw new Error(
      'Overlay text needs a font file. Drop any .ttf or .otf into public/fonts/ ' +
      '(e.g. Inter, Roboto, or copy arial.ttf from C:\\Windows\\Fonts) and render again.'
    );
  }

  let subtitlePath = '';
  let transcriptPath = '';

  if (!disableAutoCaptions && transcription) {
    subtitlePath = path.resolve(input.subtitlePath || outputPath.replace(/\.mp4$/i, '.ass'));
    transcriptPath = path.resolve(input.transcriptPath || outputPath.replace(/\.mp4$/i, '.transcript.json'));
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
  }

  await renderWithFfmpeg({
    images,
    voiceoverPath,
    backgroundMusicPath,
    outputPath,
    subtitlePath,
    transcriptPath,
    fontsDir: resolvedFontsDir,
    overlayFontPath,
    overlayScenes: disableAutoCaptions ? overlayScenes : null,
    disableAutoCaptions,
    socialOverlayText: input.socialOverlayText || DEFAULTS.socialOverlayText,
    width: Number(input.width) || DEFAULTS.width,
    height: Number(input.height) || DEFAULTS.height,
    fps: Number(input.fps) || DEFAULTS.fps,
    transitionDuration,
    perSceneDurations,
    audioDuration,
  });

  return {
    outputPath,
    subtitlePath,
    transcriptPath,
    duration: audioDuration,
    backgroundMusicPath,
    captionsBurnedIn: !disableAutoCaptions,
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
  probeAudioDuration,
};
