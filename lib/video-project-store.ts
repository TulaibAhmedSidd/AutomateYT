'use client';

import { create } from 'zustand';
import type { StepModelSelections } from '@/lib/generation-config';
import { DEFAULT_MODEL_SELECTIONS } from '@/lib/generation-config';
import { normalizeProjectManifest, type TextOverlayLayer, type VideoProjectManifest } from '@/lib/video-project';

type SegmentField = 'text' | 'summaryText' | 'imagePrompt' | 'voiceId' | 'imageUrl' | 'voiceUrl';

type VideoProjectStore = {
  videoId: string;
  manifest: VideoProjectManifest | null;
  originalManifest: VideoProjectManifest | null;
  sourcePrompt: string;
  modelSelections: StepModelSelections;
  isDirty: boolean;
  selectedSceneId: string;
  loadProject: (input: {
    videoId: string;
    manifest: unknown;
    sourcePrompt?: string;
    modelSelections?: Partial<StepModelSelections>;
    fallback?: {
      title?: string;
      description?: string;
      tags?: string[];
      scenes?: Array<{
        text?: string;
        summaryText?: string;
        imagePrompt?: string;
        uploadedImagePath?: string;
        voiceUrl?: string;
      }>;
      creationMode?: VideoProjectManifest['creationMode'];
    };
  }) => void;
  setSourcePrompt: (value: string) => void;
  setCreationMode: (value: VideoProjectManifest['creationMode']) => void;
  setMetadataField: (field: 'title' | 'description' | 'youtubeDescription', value: string) => void;
  setTagString: (value: string) => void;
  updateSegment: (segmentId: string, field: SegmentField, value: string) => void;
  setSegmentSource: (segmentId: string, field: 'script' | 'image' | 'voice', value: 'ai' | 'user' | 'none') => void;
  setSegmentComponentStatus: (segmentId: string, field: 'script' | 'image' | 'voice', value: 'generated' | 'uploaded' | 'edited' | 'missing') => void;
  toggleMuteScene: (segmentId: string) => void;
  selectScene: (segmentId: string) => void;
  updateAudioConfig: (field: 'voiceVolume' | 'musicVolume', value: number) => void;
  setModelSelection: (field: keyof StepModelSelections, value: string) => void;
  updateOverlayLayer: (segmentId: string, layerId: string, updates: Partial<TextOverlayLayer>) => void;
  addOverlayLayer: (segmentId: string) => void;
  removeOverlayLayer: (segmentId: string, layerId: string) => void;
  removeScene: (segmentId: string) => void;
  resetProject: () => void;
  markSaved: () => void;
};

function cloneManifest(manifest: VideoProjectManifest | null) {
  return manifest ? JSON.parse(JSON.stringify(manifest)) as VideoProjectManifest : null;
}

function deriveSegmentState(segment: VideoProjectManifest['scriptSegments'][number]) {
  const nextScriptStatus = segment.text
    ? (segment.source.script === 'user' ? (segment.componentStatus.script === 'edited' ? 'edited' : 'uploaded') : 'generated')
    : 'missing';
  const nextImageStatus = segment.imageUrl
    ? (segment.source.image === 'user' ? 'uploaded' : 'generated')
    : segment.imagePrompt
      ? 'generated'
      : 'missing';
  const nextVoiceStatus = segment.voiceUrl
    ? (segment.source.voice === 'user' ? 'uploaded' : 'generated')
    : segment.text
      ? 'generated'
      : 'missing';

  const nextSegment = {
    ...segment,
    componentStatus: {
      script: nextScriptStatus,
      image: nextImageStatus,
      voice: nextVoiceStatus,
    },
  };

  return {
    ...nextSegment,
    status: [nextScriptStatus, nextImageStatus, nextVoiceStatus].every((value) => value !== 'missing') ? 'complete' : 'missing',
  };
}

function rebuildManifest(manifest: VideoProjectManifest) {
  const nextSegments = manifest.scriptSegments.map(deriveSegmentState);
  return {
    ...manifest,
    scriptSegments: nextSegments,
    assetMap: nextSegments.flatMap((segment) => ([
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
    savedPrompts: {
      ...manifest.savedPrompts,
      imagePrompts: nextSegments.map((segment) => segment.imagePrompt),
    },
    audioConfig: {
      ...manifest.audioConfig,
      muteSceneIds: nextSegments.filter((segment) => segment.muteScene).map((segment) => segment.id),
    },
  };
}

export const useVideoProjectStore = create<VideoProjectStore>((set, get) => ({
  videoId: '',
  manifest: null,
  originalManifest: null,
  sourcePrompt: '',
  modelSelections: DEFAULT_MODEL_SELECTIONS,
  isDirty: false,
  selectedSceneId: '',
  loadProject: ({ videoId, manifest, sourcePrompt, modelSelections, fallback }) => {
    const normalized = normalizeProjectManifest(manifest, {
      title: fallback?.title,
      description: fallback?.description,
      tags: fallback?.tags,
      sourcePrompt,
      scenes: fallback?.scenes,
      creationMode: fallback?.creationMode,
    });

    set({
      videoId,
      manifest: normalized,
      originalManifest: cloneManifest(normalized),
      sourcePrompt: sourcePrompt || normalized.savedPrompts.sourcePrompt,
      modelSelections: { ...DEFAULT_MODEL_SELECTIONS, ...modelSelections },
      isDirty: false,
      selectedSceneId: normalized.scriptSegments[0]?.id || '',
    });
  },
  setSourcePrompt: (value) => set((state) => ({
    sourcePrompt: value,
    isDirty: Boolean(state.manifest) || state.isDirty,
  })),
  setCreationMode: (value) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: {
        ...state.manifest,
        creationMode: value,
      },
      isDirty: true,
    };
  }),
  setMetadataField: (field, value) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: {
        ...state.manifest,
        metadata: {
          ...state.manifest.metadata,
          [field]: value,
        },
      },
      isDirty: true,
    };
  }),
  setTagString: (value) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: {
        ...state.manifest,
        metadata: {
          ...state.manifest.metadata,
          tags: value.split(',').map((tag) => tag.trim()).filter(Boolean),
        },
      },
      isDirty: true,
    };
  }),
  updateSegment: (segmentId, field, value) => set((state) => {
    if (!state.manifest) return state;
    const nextManifest = rebuildManifest({
      ...state.manifest,
      scriptSegments: state.manifest.scriptSegments.map((segment) => {
        if (segment.id !== segmentId) return segment;
        const nextSegment = {
          ...segment,
          [field]: value,
        };

        if (field === 'text' || field === 'summaryText') {
          nextSegment.source = {
            ...nextSegment.source,
            script: value ? 'user' : nextSegment.source.script,
          };
        }

        if (field === 'imageUrl') {
          nextSegment.source = {
            ...nextSegment.source,
            image: value ? 'user' : 'ai',
          };
        }

        if (field === 'voiceUrl') {
          nextSegment.source = {
            ...nextSegment.source,
            voice: value ? 'user' : (nextSegment.text ? 'ai' : 'none'),
          };
        }

        if (field === 'summaryText') {
          nextSegment.overlayLayers = nextSegment.overlayLayers.map((layer, index) => index === 0 ? { ...layer, text: value } : layer);
        }

        return nextSegment;
      }),
    });

    return {
      manifest: nextManifest,
      isDirty: true,
    };
  }),
  setSegmentSource: (segmentId, field, value) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: rebuildManifest({
        ...state.manifest,
        scriptSegments: state.manifest.scriptSegments.map((segment) =>
          segment.id === segmentId
            ? {
              ...segment,
              source: {
                ...segment.source,
                [field]: value,
              },
            }
            : segment
        ),
      }),
      isDirty: true,
    };
  }),
  setSegmentComponentStatus: (segmentId, field, value) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: rebuildManifest({
        ...state.manifest,
        scriptSegments: state.manifest.scriptSegments.map((segment) =>
          segment.id === segmentId
            ? {
              ...segment,
              componentStatus: {
                ...segment.componentStatus,
                [field]: value,
              },
            }
            : segment
        ),
      }),
      isDirty: true,
    };
  }),
  toggleMuteScene: (segmentId) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: rebuildManifest({
        ...state.manifest,
        scriptSegments: state.manifest.scriptSegments.map((segment) =>
          segment.id === segmentId ? { ...segment, muteScene: !segment.muteScene } : segment
        ),
      }),
      isDirty: true,
    };
  }),
  selectScene: (segmentId) => set({ selectedSceneId: segmentId }),
  updateAudioConfig: (field, value) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: {
        ...state.manifest,
        audioConfig: {
          ...state.manifest.audioConfig,
          [field]: value,
        },
      },
      isDirty: true,
    };
  }),
  setModelSelection: (field, value) => set((state) => ({
    modelSelections: {
      ...state.modelSelections,
      [field]: value,
    },
    isDirty: true,
  })),
  updateOverlayLayer: (segmentId, layerId, updates) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: {
        ...state.manifest,
        scriptSegments: state.manifest.scriptSegments.map((segment) =>
          segment.id === segmentId
            ? {
              ...segment,
              overlayLayers: segment.overlayLayers.map((layer) => layer.id === layerId ? { ...layer, ...updates } : layer),
            }
            : segment
        ),
      },
      isDirty: true,
    };
  }),
  addOverlayLayer: (segmentId) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: {
        ...state.manifest,
        scriptSegments: state.manifest.scriptSegments.map((segment) =>
          segment.id === segmentId
            ? {
              ...segment,
              overlayLayers: [
                ...segment.overlayLayers,
                {
                  id: `overlay-${segment.overlayLayers.length + 1}`,
                  text: segment.summaryText || 'New text layer',
                  fontFamily: 'Inter',
                  fontSize: 30,
                  color: '#ffffff',
                  animation: 'fade-in',
                  x: 12,
                  y: 78,
                  background: 'rgba(0, 0, 0, 0.4)',
                },
              ],
            }
            : segment
        ),
      },
      isDirty: true,
    };
  }),
  removeOverlayLayer: (segmentId, layerId) => set((state) => {
    if (!state.manifest) return state;
    return {
      manifest: {
        ...state.manifest,
        scriptSegments: state.manifest.scriptSegments.map((segment) =>
          segment.id === segmentId
            ? {
              ...segment,
              overlayLayers: segment.overlayLayers.filter((layer) => layer.id !== layerId),
            }
            : segment
        ),
      },
      isDirty: true,
    };
  }),
  removeScene: (segmentId) => set((state) => {
    if (!state.manifest) return state;
    const nextSegments = state.manifest.scriptSegments.filter((segment) => segment.id !== segmentId);
    const nextManifest = rebuildManifest({
      ...state.manifest,
      scriptSegments: nextSegments,
    });
    const nextSelectedSceneId = state.selectedSceneId === segmentId
      ? nextSegments[0]?.id || ''
      : state.selectedSceneId;

    return {
      manifest: nextManifest,
      selectedSceneId: nextSelectedSceneId,
      isDirty: true,
    };
  }),
  resetProject: () => {
    const original = cloneManifest(get().originalManifest);
    set((state) => ({
      manifest: original,
      sourcePrompt: original?.savedPrompts.sourcePrompt || state.sourcePrompt,
      isDirty: false,
      selectedSceneId: original?.scriptSegments[0]?.id || '',
    }));
  },
  markSaved: () => set((state) => ({
    originalManifest: cloneManifest(state.manifest),
    isDirty: false,
  })),
}));
