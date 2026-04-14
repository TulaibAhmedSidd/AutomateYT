export type StepModelSelections = {
  script: string;
  voice: string;
  image: string;
  video: string;
};

export const DEFAULT_MODEL_SELECTIONS: StepModelSelections = {
  script: 'gpt-4o-mini',
  voice: 'eleven_multilingual_v2',
  image: 'leonardo-sdxl-basic',
  video: 'ffmpeg-basic-vertical',
};

export const SCRIPT_MODEL_OPTIONS = [
  { id: 'gpt-4o-mini', name: '(gpt-4o-mini) OpenAI Flash', tool: 'OpenAI' },
  { id: 'gpt-4o', name: '(gpt-4o) OpenAI Pro', tool: 'OpenAI' },
  { id: 'gemini-1.5-flash', name: '(gemini-1.5-flash) Gemini Flash', tool: 'Google Gemini' },
  { id: 'gemini-1.5-pro', name: '(gemini-1.5-pro) Gemini Pro', tool: 'Google Gemini' },
];

export const VOICE_MODEL_OPTIONS = [
  { id: 'eleven_multilingual_v2', name: '(eleven_multilingual_v2) ElevenLabs Multilingual v2', tool: 'ElevenLabs' },
  { id: 'eleven_turbo_v2_5', name: '(eleven_turbo_v2_5) ElevenLabs Turbo v2.5', tool: 'ElevenLabs' },
];

export const IMAGE_MODEL_OPTIONS = [
  {
    id: 'leonardo-sdxl-basic',
    name: 'Leonardo SDXL 1.0',
    tool: 'Leonardo API',
    note: 'Basic legacy model with safe 9:16 defaults',
  },
  {
    id: 'leonardo-kino-xl',
    name: 'Leonardo Kino XL',
    tool: 'Leonardo API',
    note: 'More cinematic look',
  },
  {
    id: 'leonardo-vision-xl',
    name: 'Leonardo Vision XL',
    tool: 'Leonardo API',
    note: 'Sharper photoreal output',
  },
];

export const VIDEO_MODEL_OPTIONS = [
  { id: 'ffmpeg-basic-vertical', name: 'FFmpeg Vertical 9:16', tool: 'FFmpeg' },
  { id: 'ffmpeg-basic-landscape', name: 'FFmpeg Landscape 16:9', tool: 'FFmpeg' },
];

const IMAGE_MODEL_CONFIGS: Record<string, { modelId: string; width: number; height: number; presetStyle?: string }> = {
  // Leonardo docs: legacy width/height must stay between 512 and 1536. We use a safe 9:16 size.
  'leonardo-sdxl-basic': {
    modelId: '16e7060a-803e-4df3-97ee-edcfa5dc9cc8',
    width: 768,
    height: 1376,
  },
  'leonardo-kino-xl': {
    modelId: 'aa77f04e-3eec-4034-9c07-d0f619684628',
    width: 768,
    height: 1376,
  },
  'leonardo-vision-xl': {
    modelId: '5c232a9e-9061-4777-980a-ddc8e65647c6',
    width: 768,
    height: 1376,
  },
};

export function normalizeModelSelections(
  input?: Partial<StepModelSelections> | null,
  defaults?: Partial<StepModelSelections> | null
): StepModelSelections {
  return {
    script: input?.script || defaults?.script || DEFAULT_MODEL_SELECTIONS.script,
    voice: input?.voice || defaults?.voice || DEFAULT_MODEL_SELECTIONS.voice,
    image: input?.image || defaults?.image || DEFAULT_MODEL_SELECTIONS.image,
    video: input?.video || defaults?.video || DEFAULT_MODEL_SELECTIONS.video,
  };
}

export function getImageModelConfig(imageModel: string) {
  return IMAGE_MODEL_CONFIGS[imageModel] || IMAGE_MODEL_CONFIGS[DEFAULT_MODEL_SELECTIONS.image];
}

export function getVideoRenderConfig(videoModel: string) {
  if (videoModel === 'ffmpeg-basic-landscape') {
    return {
      width: 1280,
      height: 720,
      thumbnailSize: '1280x720',
    };
  }

  return {
    width: 1080,
    height: 1920,
    thumbnailSize: '1080x1920',
  };
}
