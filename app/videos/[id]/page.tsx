'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  ImageIcon,
  Loader2,
  Mic,
  Move,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Video as VideoIcon,
  Wand2,
} from 'lucide-react';
import {
  IMAGE_MODEL_OPTIONS,
  SCRIPT_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
  VOICE_MODEL_OPTIONS,
  type StepModelSelections,
} from '@/lib/generation-config';
import { useVideoProjectStore } from '@/lib/video-project-store';
import type { SceneAnimationType } from '@/lib/video-project';

type SceneItem = {
  text: string;
  summaryText?: string;
  imagePrompt: string;
  uploadedImagePath?: string;
  voiceUrl?: string;
};

type VideoDetail = {
  _id: string;
  title?: string;
  description?: string;
  tags?: string[];
  status: string;
  uploadStatus?: string;
  uploadError?: string;
  storageMode?: string;
  scriptStatus?: string;
  voiceStatus?: string;
  imageStatus?: string;
  videoRenderStatus?: string;
  videoPath?: string;
  audioPath?: string;
  imagePaths?: string[];
  voiceoverText?: string;
  scenes?: SceneItem[];
  sourcePrompt?: string;
  failedStep?: string;
  errorSummary?: string;
  modelSelections?: Partial<StepModelSelections>;
  projectManifest?: unknown;
};

const MODEL_GROUPS = [
  { key: 'script', label: 'Script AI', options: SCRIPT_MODEL_OPTIONS },
  { key: 'voice', label: 'Voice AI', options: VOICE_MODEL_OPTIONS },
  { key: 'image', label: 'Image AI', options: IMAGE_MODEL_OPTIONS },
  { key: 'video', label: 'Render Engine', options: VIDEO_MODEL_OPTIONS },
] as const;

const ANIMATION_OPTIONS: SceneAnimationType[] = ['fade-in', 'slide-up', 'zoom-in', 'typewriter'];

function getBadgeTone(value: string) {
  if (value === 'missing') return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
  if (value === 'uploaded') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
  if (value === 'edited') return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-100';
  return 'border-blue-500/20 bg-blue-500/10 text-blue-100';
}

export default function VideoStudioPage() {
  const params = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveMessage, setSaveMessage] = useState('');
  const [workingKey, setWorkingKey] = useState('');
  const {
    manifest,
    sourcePrompt,
    modelSelections,
    isDirty,
    selectedSceneId,
    loadProject,
    setSourcePrompt,
    setCreationMode,
    setMetadataField,
    setTagString,
    updateSegment,
    setSegmentSource,
    setSegmentComponentStatus,
    toggleMuteScene,
    selectScene,
    updateAudioConfig,
    setModelSelection,
    updateOverlayLayer,
    addOverlayLayer,
    removeOverlayLayer,
    removeScene,
    resetProject,
    markSaved,
  } = useVideoProjectStore();

  const selectedScene = useMemo(
    () => manifest?.scriptSegments.find((segment) => segment.id === selectedSceneId) || manifest?.scriptSegments[0] || null,
    [manifest, selectedSceneId]
  );

  const selectedSceneIndex = useMemo(
    () => manifest?.scriptSegments.findIndex((segment) => segment.id === selectedScene?.id) ?? 0,
    [manifest, selectedScene]
  );

  const previewImage = selectedScene?.imageUrl || video?.imagePaths?.[selectedSceneIndex] || '';

  const clearSceneField = (sceneId: string, field: 'text' | 'summaryText' | 'imagePrompt' | 'imageUrl' | 'voiceUrl') => {
    updateSegment(sceneId, field, '');
    if (field === 'text') {
      setSegmentComponentStatus(sceneId, 'script', 'missing');
    }
    if (field === 'imageUrl') {
      setSegmentComponentStatus(sceneId, 'image', 'missing');
    }
    if (field === 'voiceUrl') {
      setSegmentComponentStatus(sceneId, 'voice', 'missing');
    }
  };

  const refreshVideo = async () => {
    const res = await fetch(`/api/videos/${params.id}`);
    const data = await res.json();
    setVideo(data);
    loadProject({
      videoId: data._id,
      manifest: data.projectManifest,
      sourcePrompt: data.sourcePrompt,
      modelSelections: data.modelSelections,
      fallback: {
        title: data.title,
        description: data.description,
        tags: data.tags,
        scenes: data.scenes,
        creationMode: data.projectManifest?.creationMode,
      },
    });
    setLoading(false);
  };

  useEffect(() => {
    const loadVideo = async () => {
      const res = await fetch(`/api/videos/${params.id}`);
      const data = await res.json();
      setVideo(data);
      loadProject({
        videoId: data._id,
        manifest: data.projectManifest,
        sourcePrompt: data.sourcePrompt,
        modelSelections: data.modelSelections,
        fallback: {
          title: data.title,
          description: data.description,
          tags: data.tags,
          scenes: data.scenes,
          creationMode: data.projectManifest?.creationMode,
        },
      });
      setLoading(false);
    };

    void loadVideo();
  }, [params.id, loadProject]);

  const uploadFile = async (file: File | null, endpoint: '/api/upload-scene-image' | '/api/upload-scene-audio') => {
    if (!file) return '';
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(endpoint, { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data?.error || 'Upload failed');
    }
    return typeof data?.path === 'string' ? data.path : '';
  };

  const persistProject = async (generationIntent: 'save' | 'render' | 'regenerate') => {
    if (!video || !manifest) return;
    setWorkingKey(`project:${generationIntent}`);
    setSaveMessage(generationIntent === 'save' ? 'Saving changes...' : generationIntent === 'render' ? 'Rendering only from current assets and prompts...' : 'Saving and generating only missing AI components...');
    try {
      const res = await fetch(`/api/videos/${video._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePrompt,
          projectManifest: manifest,
          modelSelections,
          generationIntent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to update project');
      }
      markSaved();
      setSaveMessage(
        generationIntent === 'save'
          ? 'Project saved. AI stayed off.'
          : generationIntent === 'render'
            ? 'Render queued using current project assets.'
            : 'Project saved and queued to generate only the missing parts.'
      );
      await refreshVideo();
    } catch (error: unknown) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to update project');
    } finally {
      setWorkingKey('');
    }
  };

  const handleGenerateSceneScript = async (sceneId: string) => {
    const scene = manifest?.scriptSegments.find((segment) => segment.id === sceneId);
    if (!scene) return;
    setWorkingKey(`${sceneId}:script`);
    try {
      const res = await fetch('/api/generate-scene-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: scene.imagePrompt || scene.summaryText,
          sourcePrompt,
          model: modelSelections.script,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate scene script');
      updateSegment(sceneId, 'text', data.scene?.text || '');
      updateSegment(sceneId, 'summaryText', data.scene?.summaryText || data.scene?.text || '');
      updateSegment(sceneId, 'imagePrompt', data.scene?.imagePrompt || scene.imagePrompt);
      setSegmentSource(sceneId, 'script', 'ai');
      setSegmentComponentStatus(sceneId, 'script', 'generated');
    } catch (error: unknown) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to generate scene script');
    } finally {
      setWorkingKey('');
    }
  };

  const handleGenerateSceneImage = async (sceneId: string) => {
    const scene = manifest?.scriptSegments.find((segment) => segment.id === sceneId);
    if (!scene) return;
    setWorkingKey(`${sceneId}:image`);
    try {
      const res = await fetch('/api/generate-scene-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: scene.imagePrompt || scene.summaryText,
          model: modelSelections.image,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate scene image');
      updateSegment(sceneId, 'imageUrl', data.path || '');
      setSegmentSource(sceneId, 'image', 'ai');
      setSegmentComponentStatus(sceneId, 'image', 'generated');
    } catch (error: unknown) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to generate scene image');
    } finally {
      setWorkingKey('');
    }
  };

  const handleGenerateSceneVoice = async (sceneId: string) => {
    const scene = manifest?.scriptSegments.find((segment) => segment.id === sceneId);
    if (!scene) return;
    setWorkingKey(`${sceneId}:voice`);
    try {
      const res = await fetch('/api/generate-scene-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: scene.text,
          model: modelSelections.voice,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to generate scene voice');
      updateSegment(sceneId, 'voiceUrl', data.path || '');
      setSegmentSource(sceneId, 'voice', 'ai');
      setSegmentComponentStatus(sceneId, 'voice', 'generated');
    } catch (error: unknown) {
      setSaveMessage(error instanceof Error ? error.message : 'Failed to generate scene voice');
    } finally {
      setWorkingKey('');
    }
  };

  if (loading || !video || !manifest) {
    return <div className="flex items-center gap-3 text-slate-300"><Loader2 className="animate-spin" size={18} />Loading studio...</div>;
  }

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <section className="rounded-[30px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(180deg,_#0f172a,_#020617)] p-5 shadow-2xl md:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900">
                <ArrowLeft size={16} />
                Dashboard
              </Link>
              <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-cyan-200">
                {manifest.creationMode} mode
              </span>
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.35em] text-cyan-300/80">Studio Editor</p>
            <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">{manifest.metadata.title || video.title || 'Untitled project'}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
              Scene-level editing is active here. Uploaded assets are always preserved, and when you choose full AI the remaining script, narration, and visuals can all be generated from the stored brief.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <button
              onClick={() => void persistProject('save')}
              disabled={workingKey !== ''}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-40"
            >
              {workingKey === 'project:save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </button>
            <button
              onClick={() => void persistProject('render')}
              disabled={workingKey !== ''}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/20 disabled:opacity-40"
            >
              {workingKey === 'project:render' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Render
            </button>
            <button
              onClick={() => void persistProject('regenerate')}
              disabled={workingKey !== ''}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:opacity-90 disabled:opacity-40"
            >
              {workingKey === 'project:regenerate' ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Generate With AI
            </button>
            <button
              onClick={resetProject}
              disabled={!isDirty || workingKey !== ''}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-900 disabled:opacity-40"
            >
              <Wand2 size={16} />
              Reset Unsaved
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300">
          <span>{saveMessage || (isDirty ? 'Unsaved editor changes detected.' : 'Project synced.')}</span>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">Script: {video.scriptStatus || 'pending'}</span>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">Voice: {video.voiceStatus || 'pending'}</span>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">Images: {video.imageStatus || 'pending'}</span>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs text-slate-400">Render: {video.videoRenderStatus || 'pending'}</span>
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-xl md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Project Control</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Metadata and cost-control settings</h2>
              </div>
              <select
                value={manifest.creationMode}
                onChange={(event) => setCreationMode(event.target.value as typeof manifest.creationMode)}
                className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none"
              >
                <option value="full-ai">Full AI</option>
                <option value="hybrid">Hybrid</option>
                <option value="manual">Fully Manual</option>
              </select>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Title</label>
                <input value={manifest.metadata.title} onChange={(event) => setMetadataField('title', event.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none" />
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Tags</label>
                <input value={manifest.metadata.tags.join(', ')} onChange={(event) => setTagString(event.target.value)} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none" />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Description</label>
              <textarea value={manifest.metadata.description} onChange={(event) => setMetadataField('description', event.target.value)} className="min-h-[100px] w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none" />
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Prompt Memory</label>
              <textarea value={sourcePrompt} onChange={(event) => setSourcePrompt(event.target.value)} className="min-h-[100px] w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none" />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
                <label className="block text-sm font-semibold text-white">Voice Volume: {Math.round(manifest.audioConfig.voiceVolume * 100)}%</label>
                <input type="range" min="0" max="1" step="0.05" value={manifest.audioConfig.voiceVolume} onChange={(event) => updateAudioConfig('voiceVolume', Number(event.target.value))} className="mt-3 w-full" />
                <label className="mt-4 block text-sm font-semibold text-white">Music Volume: {Math.round(manifest.audioConfig.musicVolume * 100)}%</label>
                <input type="range" min="0" max="1" step="0.05" value={manifest.audioConfig.musicVolume} onChange={(event) => updateAudioConfig('musicVolume', Number(event.target.value))} className="mt-3 w-full" />
              </div>
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="text-sm font-semibold text-white">Cost logic</p>
                <div className="mt-3 space-y-2 text-sm text-slate-400">
                  <p>Uploaded script, image, or voice assets are always preferred.</p>
                  <p>Per-scene AI can be triggered only for missing components.</p>
                  <p>Render validates scene completeness before spending resources.</p>
                </div>
              </div>
            </div>

            {manifest.creationMode === 'full-ai' && (
              <div className="mt-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-50">
                <p className="font-semibold">Generate all through AI is enabled for this project.</p>
                <p className="mt-2 text-emerald-100/90">
                  Keep the prompt memory updated, then use <span className="font-semibold">Generate With AI</span> to build the remaining script, narration, and imagery from that brief.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-xl md:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Timeline</p>
                <h2 className="mt-2 text-2xl font-bold text-white">Swipeable scene awareness editor</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-4">
                {MODEL_GROUPS.map((group) => (
                  <select
                    key={group.key}
                    value={modelSelections[group.key]}
                    onChange={(event) => setModelSelection(group.key, event.target.value)}
                    className="rounded-2xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
                  >
                    {group.options.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                ))}
              </div>
            </div>

            <div className="mt-6 -mx-5 flex snap-x gap-4 overflow-x-auto px-5 pb-2 md:-mx-6 md:px-6 xl:block xl:space-y-4 xl:overflow-visible xl:px-0">
              {manifest.scriptSegments.map((scene, index) => (
                <article
                  key={scene.id}
                  className={`min-w-[88%] snap-center rounded-[28px] border p-4 transition xl:min-w-0 ${selectedScene?.id === scene.id ? 'border-cyan-400/40 bg-cyan-500/5' : 'border-slate-800 bg-slate-950/60'}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <button onClick={() => selectScene(scene.id)} className="flex flex-1 items-start justify-between gap-4 text-left">
                      <div>
                        <p className="text-sm font-bold text-white">Scene {index + 1}</p>
                        <p className="mt-1 text-xs text-slate-400">Duration {scene.duration}s</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] ${scene.status === 'complete' ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-500/10 text-amber-200'}`}>
                        {scene.status}
                      </span>
                    </button>
                    <button
                      onClick={() => removeScene(scene.id)}
                      disabled={manifest.scriptSegments.length <= 1}
                      className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
                      title="Delete scene"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <div className={`rounded-2xl border px-3 py-3 text-xs ${getBadgeTone(scene.componentStatus.script)}`}>
                      Script: {scene.componentStatus.script}
                    </div>
                    <div className={`rounded-2xl border px-3 py-3 text-xs ${getBadgeTone(scene.componentStatus.image)}`}>
                      Image: {scene.componentStatus.image}
                    </div>
                    <div className={`rounded-2xl border px-3 py-3 text-xs ${getBadgeTone(scene.componentStatus.voice)}`}>
                      Voice: {scene.componentStatus.voice}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Scene Text</label>
                        <button
                          onClick={() => clearSceneField(scene.id, 'text')}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                        >
                          <Trash2 size={13} />
                          Delete Text
                        </button>
                      </div>
                      <textarea
                        value={scene.text}
                        onChange={(event) => {
                          updateSegment(scene.id, 'text', event.target.value);
                          setSegmentSource(scene.id, 'script', 'user');
                          setSegmentComponentStatus(scene.id, 'script', event.target.value ? 'edited' : 'missing');
                        }}
                        className="min-h-[140px] w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                      />
                      {!scene.text.trim() && (
                        <button
                          onClick={() => void handleGenerateSceneScript(scene.id)}
                          disabled={workingKey !== ''}
                          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"
                        >
                          {workingKey === `${scene.id}:script` ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                          Generate Script AI
                        </button>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Scene Summary / Overlay Seed</label>
                        <button
                          onClick={() => clearSceneField(scene.id, 'summaryText')}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                        >
                          <Trash2 size={13} />
                          Delete Summary
                        </button>
                      </div>
                      <textarea
                        value={scene.summaryText}
                        onChange={(event) => updateSegment(scene.id, 'summaryText', event.target.value)}
                        className="min-h-[140px] w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                      />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Image Layer</p>
                        <button
                          onClick={() => {
                            clearSceneField(scene.id, 'imagePrompt');
                            clearSceneField(scene.id, 'imageUrl');
                          }}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                        >
                          <Trash2 size={13} />
                          Delete Image
                        </button>
                      </div>
                      <textarea
                        value={scene.imagePrompt}
                        onChange={(event) => updateSegment(scene.id, 'imagePrompt', event.target.value)}
                        className="mt-3 min-h-[100px] w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                          <Upload size={15} />
                          Upload Image
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (event) => {
                              try {
                                setWorkingKey(`${scene.id}:image-upload`);
                                const path = await uploadFile(event.target.files?.[0] || null, '/api/upload-scene-image');
                                if (path) {
                                  updateSegment(scene.id, 'imageUrl', path);
                                  setSegmentSource(scene.id, 'image', 'user');
                                  setSegmentComponentStatus(scene.id, 'image', 'uploaded');
                                }
                              } catch (error: unknown) {
                                setSaveMessage(error instanceof Error ? error.message : 'Image upload failed');
                              } finally {
                                setWorkingKey('');
                              }
                            }}
                          />
                        </label>
                        <button onClick={() => void handleGenerateSceneImage(scene.id)} disabled={workingKey !== ''} className="rounded-2xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40">
                          {workingKey === `${scene.id}:image` ? <Loader2 size={15} className="animate-spin" /> : 'Generate Image'}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">Voice Layer</p>
                        <button
                          onClick={() => clearSceneField(scene.id, 'voiceUrl')}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                        >
                          <Trash2 size={13} />
                          Delete Voice
                        </button>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                          <Mic size={15} />
                          Upload Voice
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={async (event) => {
                              try {
                                setWorkingKey(`${scene.id}:voice-upload`);
                                const path = await uploadFile(event.target.files?.[0] || null, '/api/upload-scene-audio');
                                if (path) {
                                  updateSegment(scene.id, 'voiceUrl', path);
                                  setSegmentSource(scene.id, 'voice', 'user');
                                  setSegmentComponentStatus(scene.id, 'voice', 'uploaded');
                                }
                              } catch (error: unknown) {
                                setSaveMessage(error instanceof Error ? error.message : 'Voice upload failed');
                              } finally {
                                setWorkingKey('');
                              }
                            }}
                          />
                        </label>
                        <button onClick={() => void handleGenerateSceneVoice(scene.id)} disabled={workingKey !== '' || !scene.text.trim()} className="rounded-2xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40">
                          {workingKey === `${scene.id}:voice` ? <Loader2 size={15} className="animate-spin" /> : 'Generate Voice'}
                        </button>
                        <button onClick={() => toggleMuteScene(scene.id)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                          {scene.muteScene ? 'Unmute Scene' : 'Mute Scene'}
                        </button>
                      </div>
                      {scene.voiceUrl && (
                        <audio controls className="mt-4 w-full">
                          <source src={scene.voiceUrl} />
                        </audio>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                    <span className="rounded-full bg-slate-900 px-3 py-1">Source script: {scene.source.script}</span>
                    <span className="rounded-full bg-slate-900 px-3 py-1">Source image: {scene.source.image}</span>
                    <span className="rounded-full bg-slate-900 px-3 py-1">Source voice: {scene.source.voice}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Live Preview</p>
            <div className="mt-4 overflow-hidden rounded-[24px] border border-slate-800 bg-slate-950">
              <div className="relative aspect-[9/16]">
                {video.videoPath ? (
                  <video controls className="h-full w-full object-cover" src={video.videoPath} />
                ) : previewImage ? (
                  <Image src={previewImage} alt={selectedScene?.summaryText || 'Scene preview'} fill unoptimized className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_34%),linear-gradient(180deg,_#0f172a,_#020617)] text-slate-600">
                    <VideoIcon size={44} />
                  </div>
                )}

                {selectedScene?.overlayLayers.map((layer) => (
                  <div
                    key={layer.id}
                    className="absolute max-w-[84%] rounded-[22px] border border-emerald-300/20 px-4 py-3 font-black shadow-2xl"
                    style={{
                      left: `${layer.x}%`,
                      top: `${layer.y}%`,
                      background: layer.background,
                      color: layer.color,
                      fontSize: `${layer.fontSize}px`,
                      fontFamily: layer.fontFamily,
                      transform: 'translate(-0%, -0%)',
                    }}
                  >
                    {layer.text}
                  </div>
                ))}
              </div>
            </div>

            {video.videoPath && (
              <a href={video.videoPath} download className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                <Download size={16} />
                Download Current Video
              </a>
            )}
          </div>

          {selectedScene && (
            <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Overlay Text System</p>
                  <h2 className="mt-2 text-xl font-bold text-white">Text layers for the selected scene</h2>
                </div>
                <button onClick={() => addOverlayLayer(selectedScene.id)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                  <Plus size={15} />
                  Add Layer
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {selectedScene.overlayLayers.map((layer) => (
                  <div key={layer.id} className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">Layer {layer.id}</p>
                      <button
                        onClick={() => removeOverlayLayer(selectedScene.id, layer.id)}
                        disabled={selectedScene.overlayLayers.length <= 1}
                        className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
                      >
                        <Trash2 size={13} />
                        Delete Layer
                      </button>
                    </div>
                    <div className="grid gap-4">
                      <textarea
                        value={layer.text}
                        onChange={(event) => updateOverlayLayer(selectedScene.id, layer.id, { text: event.target.value })}
                        className="min-h-[90px] w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <input
                            value={layer.fontFamily}
                            onChange={(event) => updateOverlayLayer(selectedScene.id, layer.id, { fontFamily: event.target.value })}
                            className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                            placeholder="Font family"
                          />
                          <input
                            type="color"
                            value={layer.color}
                            onChange={(event) => updateOverlayLayer(selectedScene.id, layer.id, { color: event.target.value })}
                            className="h-12 rounded-2xl border border-slate-800 bg-slate-900"
                          />
                          <input
                            type="color"
                            value={layer.background}
                            onChange={(event) => updateOverlayLayer(selectedScene.id, layer.id, { background: event.target.value })}
                            className="h-12 rounded-2xl border border-slate-800 bg-slate-900"
                          />
                        </div>
                        <label className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100">
                          Size
                          <input type="range" min="18" max="64" value={layer.fontSize} onChange={(event) => updateOverlayLayer(selectedScene.id, layer.id, { fontSize: Number(event.target.value) })} className="mt-2 w-full" />
                        </label>
                        <select
                          value={layer.animation}
                          onChange={(event) => updateOverlayLayer(selectedScene.id, layer.id, { animation: event.target.value as SceneAnimationType })}
                          className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                        >
                          {ANIMATION_OPTIONS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        <label className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100">
                          X Position
                          <input type="range" min="0" max="70" value={layer.x} onChange={(event) => updateOverlayLayer(selectedScene.id, layer.id, { x: Number(event.target.value) })} className="mt-2 w-full" />
                        </label>
                        <label className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100">
                          Y Position
                          <input type="range" min="0" max="90" value={layer.y} onChange={(event) => updateOverlayLayer(selectedScene.id, layer.id, { y: Number(event.target.value) })} className="mt-2 w-full" />
                        </label>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                      <Type size={13} />
                      Text overlay uses the green caption card by default and stays editable per scene.
                      <Move size={13} className="ml-2" />
                      Position updates are stored numerically for later render integration.
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Asset Sidebar</p>
            <div className="mt-4 space-y-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-white"><ImageIcon size={15} />Scene images</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {(video.imagePaths && video.imagePaths.length > 0 ? video.imagePaths : manifest.scriptSegments.map((scene) => scene.imageUrl).filter(Boolean)).map((imagePath, index) => (
                    <button key={`${imagePath}-${index}`} onClick={() => selectScene(manifest.scriptSegments[index]?.id || '')} className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 transition hover:border-cyan-400/40">
                      <div className="relative aspect-[9/16]">
                        <Image src={imagePath} alt={`Scene ${index + 1}`} fill unoptimized className="object-cover" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-white"><Mic size={15} />Narration track</p>
                {video.audioPath ? (
                  <audio controls className="mt-4 w-full">
                    <source src={video.audioPath} />
                  </audio>
                ) : (
                  <p className="mt-3 text-sm text-slate-400">Combined narration will appear here after render preparation.</p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
