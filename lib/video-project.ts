export type AssetSource = 'ai' | 'user' | 'none';
export type ComponentStatus = 'generated' | 'uploaded' | 'edited' | 'missing';
export type CreationMode = 'full-ai' | 'hybrid' | 'manual';

export type SceneAnimationType = 'fade-in' | 'slide-up' | 'zoom-in' | 'typewriter';

export type TextOverlayLayer = {
  id: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  animation: SceneAnimationType;
  x: number;
  y: number;
  background: string;
};

export type ProjectScriptSegment = {
  id: string;
  text: string;
  summaryText: string;
  imagePrompt: string;
  startTime: number;
  endTime: number;
  duration: number;
  voiceId: string;
  muteScene: boolean;
  imageUrl: string;
  voiceUrl: string;
  source: {
    script: AssetSource;
    image: AssetSource;
    voice: AssetSource;
  };
  componentStatus: {
    script: ComponentStatus;
    image: ComponentStatus;
    voice: ComponentStatus;
  };
  status: 'complete' | 'missing';
  overlayLayers: TextOverlayLayer[];
};

export type ProjectAssetMapItem = {
  segmentId: string;
  assetType: 'image' | 'voice';
  assetUrl: string;
  source: AssetSource;
  prompt: string;
};

export type ProjectAudioConfig = {
  voiceVolume: number;
  musicVolume: number;
  muteSceneIds: string[];
};

export type ProjectMetadata = {
  title: string;
  description: string;
  tags: string[];
  youtubeDescription: string;
  aiTitle: string;
};

export type SavedPromptState = {
  sourcePrompt: string;
  lastAIGenerationPrompt: string;
  imagePrompts: string[];
  promptHistory: string[];
};

export type ProjectEditorState = {
  lastSavedAt: string;
  lastGenerationIntent: 'save' | 'render' | 'regenerate';
};

export type VideoProjectManifest = {
  creationMode: CreationMode;
  scriptSegments: ProjectScriptSegment[];
  assetMap: ProjectAssetMapItem[];
  audioConfig: ProjectAudioConfig;
  metadata: ProjectMetadata;
  savedPrompts: SavedPromptState;
  editorState: ProjectEditorState;
};

export type ScriptSceneInput = {
  text?: string;
  summaryText?: string;
  imagePrompt?: string;
  uploadedImagePath?: string;
  voiceUrl?: string;
  source?: Partial<ProjectScriptSegment['source']>;
  componentStatus?: Partial<ProjectScriptSegment['componentStatus']>;
  overlayLayers?: TextOverlayLayer[];
  duration?: number;
};

const DEFAULT_VOICE_ID = 'CwhRBWXzGAHq8TQ4Fs17';
const DEFAULT_OVERLAY_BG = 'rgba(0, 0, 0, 0.4)';

function clampVolume(value: unknown, fallback: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function safeString(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function safeNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeString(item).trim()).filter(Boolean);
}

function createSegmentId(index: number) {
  return `scene-${index + 1}`;
}

function deriveSummaryText(text: string, fallback: string) {
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  return trimmed.length > 72 ? `${trimmed.slice(0, 69).trim()}...` : trimmed;
}

function normalizeOverlayLayers(value: unknown, fallbackText: string, existing?: TextOverlayLayer[]) {
  const candidate = Array.isArray(value) ? value : existing;
  if (Array.isArray(candidate) && candidate.length > 0) {
    return candidate.map((layer, index) => ({
      id: safeString(layer?.id) || `overlay-${index + 1}`,
      text: safeString(layer?.text) || fallbackText,
      fontFamily: safeString(layer?.fontFamily) || 'Inter',
      fontSize: safeNumber(layer?.fontSize, 34),
      color: safeString(layer?.color) || '#ffffff',
      animation: (safeString(layer?.animation) as SceneAnimationType) || 'fade-in',
      x: safeNumber(layer?.x, 12),
      y: safeNumber(layer?.y, 78),
      background: safeString(layer?.background) || DEFAULT_OVERLAY_BG,
    }));
  }

  return [{
    id: 'overlay-1',
    text: fallbackText,
    fontFamily: 'Inter',
    fontSize: 34,
    color: '#ffffff',
    animation: 'fade-in',
    x: 12,
    y: 78,
    background: DEFAULT_OVERLAY_BG,
  }];
}

function inferStatus(source: AssetSource, hasValue: boolean, wasEdited: boolean) {
  if (!hasValue) return 'missing';
  if (source === 'user') return 'uploaded';
  if (wasEdited) return 'edited';
  return 'generated';
}

function inferOverallStatus(componentStatus: ProjectScriptSegment['componentStatus']) {
  return Object.values(componentStatus).every((value) => value !== 'missing') ? 'complete' : 'missing';
}

export function createProjectManifest(input: {
  title?: string;
  description?: string;
  tags?: string[];
  sourcePrompt?: string;
  scenes?: ScriptSceneInput[];
  voiceId?: string;
  existing?: Partial<VideoProjectManifest> | null;
  generationIntent?: 'save' | 'render' | 'regenerate';
  creationMode?: CreationMode;
}): VideoProjectManifest {
  const scenes = Array.isArray(input.scenes) ? input.scenes : [];
  const existingSegments = Array.isArray(input.existing?.scriptSegments) ? input.existing.scriptSegments : [];
  const existingAudio = input.existing?.audioConfig;
  const existingPrompts = input.existing?.savedPrompts;
  const existingMetadata = input.existing?.metadata;
  const now = new Date().toISOString();

  const scriptSegments = scenes.map((scene, index) => {
    const existingSegment = existingSegments[index];
    const segmentId = safeString(existingSegment?.id) || createSegmentId(index);
    const text = safeString(scene.text || existingSegment?.text);
    const summaryText = safeString(scene.summaryText || existingSegment?.summaryText) || deriveSummaryText(text, `Scene ${index + 1}`);
    const imagePrompt = safeString(scene.imagePrompt || existingSegment?.imagePrompt);
    const imageUrl = safeString(scene.uploadedImagePath || existingSegment?.imageUrl);
    const voiceUrl = safeString(scene.voiceUrl || existingSegment?.voiceUrl);
    const source = {
      script: (scene.source?.script || existingSegment?.source?.script || (text ? 'user' : 'none')) as AssetSource,
      image: (scene.source?.image || existingSegment?.source?.image || (imageUrl ? 'user' : imagePrompt ? 'ai' : 'none')) as AssetSource,
      voice: (scene.source?.voice || existingSegment?.source?.voice || (voiceUrl ? 'user' : text ? 'ai' : 'none')) as AssetSource,
    };
    const componentStatus = {
      script: (scene.componentStatus?.script || existingSegment?.componentStatus?.script || inferStatus(source.script, Boolean(text), source.script === 'user' && Boolean(existingSegment?.text && existingSegment.text !== text))) as ComponentStatus,
      image: (scene.componentStatus?.image || existingSegment?.componentStatus?.image || inferStatus(source.image, Boolean(imageUrl || imagePrompt), source.image === 'user' && Boolean(existingSegment?.imageUrl && existingSegment.imageUrl !== imageUrl))) as ComponentStatus,
      voice: (scene.componentStatus?.voice || existingSegment?.componentStatus?.voice || inferStatus(source.voice, Boolean(voiceUrl || text), source.voice === 'user' && Boolean(existingSegment?.voiceUrl && existingSegment.voiceUrl !== voiceUrl))) as ComponentStatus,
    };

    return {
      id: segmentId,
      text,
      summaryText,
      imagePrompt,
      startTime: safeNumber(existingSegment?.startTime, 0),
      endTime: safeNumber(existingSegment?.endTime, 0),
      duration: safeNumber(scene.duration || existingSegment?.duration, 5),
      voiceId: safeString(existingSegment?.voiceId) || input.voiceId || DEFAULT_VOICE_ID,
      muteScene: Boolean(existingSegment?.muteScene),
      imageUrl,
      voiceUrl,
      source,
      componentStatus,
      status: inferOverallStatus(componentStatus),
      overlayLayers: normalizeOverlayLayers(scene.overlayLayers, summaryText, existingSegment?.overlayLayers),
    };
  });

  return {
    creationMode: (input.creationMode || input.existing?.creationMode || 'hybrid') as CreationMode,
    scriptSegments,
    assetMap: scriptSegments.flatMap((segment) => ([
      {
        segmentId: segment.id,
        assetType: 'image' as const,
        assetUrl: segment.imageUrl,
        source: segment.source.image,
        prompt: segment.imagePrompt,
      },
      {
        segmentId: segment.id,
        assetType: 'voice' as const,
        assetUrl: segment.voiceUrl,
        source: segment.source.voice,
        prompt: segment.text,
      },
    ])).filter((item) => item.assetUrl || item.prompt),
    audioConfig: {
      voiceVolume: clampVolume(existingAudio?.voiceVolume, 1),
      musicVolume: clampVolume(existingAudio?.musicVolume, 0.2),
      muteSceneIds: Array.isArray(existingAudio?.muteSceneIds)
        ? existingAudio.muteSceneIds.map((item) => safeString(item)).filter(Boolean)
        : [],
    },
    metadata: {
      title: safeString(input.title || existingMetadata?.title),
      description: safeString(input.description || existingMetadata?.description),
      tags: safeTags(input.tags || existingMetadata?.tags),
      youtubeDescription: safeString(existingMetadata?.youtubeDescription || input.description),
      aiTitle: safeString(existingMetadata?.aiTitle || input.title),
    },
    savedPrompts: {
      sourcePrompt: safeString(input.sourcePrompt || existingPrompts?.sourcePrompt),
      lastAIGenerationPrompt: safeString(input.sourcePrompt || existingPrompts?.lastAIGenerationPrompt),
      imagePrompts: scriptSegments.map((segment) => segment.imagePrompt),
      promptHistory: Array.from(new Set([
        ...((Array.isArray(existingPrompts?.promptHistory) ? existingPrompts.promptHistory : []).map((item) => safeString(item)).filter(Boolean)),
        safeString(input.sourcePrompt),
      ].filter(Boolean))),
    },
    editorState: {
      lastSavedAt: now,
      lastGenerationIntent: input.generationIntent || 'save',
    },
  };
}

export function manifestToScriptScenes(manifest: Partial<VideoProjectManifest> | null | undefined) {
  const segments = Array.isArray(manifest?.scriptSegments) ? manifest.scriptSegments : [];
  return segments.map((segment) => ({
    text: safeString(segment.text),
    summaryText: safeString(segment.summaryText),
    imagePrompt: safeString(segment.imagePrompt),
    uploadedImagePath: safeString(segment.imageUrl),
    voiceUrl: safeString(segment.voiceUrl),
    source: segment.source,
    componentStatus: segment.componentStatus,
    overlayLayers: Array.isArray(segment.overlayLayers) ? segment.overlayLayers : [],
    duration: safeNumber(segment.duration, 5),
  }));
}

export function normalizeProjectManifest(
  manifest: unknown,
  fallback?: {
    title?: string;
    description?: string;
    tags?: string[];
    sourcePrompt?: string;
    scenes?: ScriptSceneInput[];
    creationMode?: CreationMode;
  }
): VideoProjectManifest {
  if (manifest && typeof manifest === 'object') {
    const candidate = manifest as Partial<VideoProjectManifest>;
    const fallbackScenes = manifestToScriptScenes(candidate);
    if (fallbackScenes.length > 0) {
      return createProjectManifest({
        title: candidate.metadata?.title || fallback?.title,
        description: candidate.metadata?.description || fallback?.description,
        tags: candidate.metadata?.tags || fallback?.tags,
        sourcePrompt: candidate.savedPrompts?.sourcePrompt || fallback?.sourcePrompt,
        scenes: fallbackScenes,
        existing: candidate,
        generationIntent: candidate.editorState?.lastGenerationIntent,
        creationMode: candidate.creationMode || fallback?.creationMode,
      });
    }
  }

  return createProjectManifest({
    title: fallback?.title,
    description: fallback?.description,
    tags: fallback?.tags,
    sourcePrompt: fallback?.sourcePrompt,
    scenes: fallback?.scenes,
    creationMode: fallback?.creationMode,
  });
}
