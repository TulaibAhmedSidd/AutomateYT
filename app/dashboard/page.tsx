'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  CheckCircle2,
  Clapperboard,
  Film,
  ImagePlus,
  Loader2,
  Mic,
  PenSquare,
  Plus,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DEFAULT_MODEL_SELECTIONS,
  normalizeModelSelections,
  type StepModelSelections,
} from '@/lib/generation-config';

type VideoItem = {
  _id: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  createdAt: string;
  status: string;
  videoPath?: string;
  scriptStatus?: string;
  voiceStatus?: string;
  imageStatus?: string;
  videoRenderStatus?: string;
  failedStep?: string;
  projectManifest?: {
    creationMode?: 'full-ai' | 'hybrid' | 'manual';
    scriptSegments?: Array<{
      status?: 'complete' | 'missing';
      componentStatus?: {
        script?: string;
        image?: string;
        voice?: string;
      };
    }>;
  };
};

type CreationMode = 'full-ai' | 'hybrid' | 'manual';

type UploadState = {
  scriptText: string;
  sourcePrompt: string;
  uploadedVoicePaths: string[];
  uploadedImagePaths: string[];
};

const CREATION_MODES: Array<{
  id: CreationMode;
  label: string;
  description: string;
}> = [
    { id: 'full-ai', label: 'Generate All Through AI', description: 'Start with an idea and let AI create the script, voice, and images.' },
    { id: 'hybrid', label: 'Hybrid', description: 'Provide some assets yourself and only use AI for missing pieces.' },
    { id: 'manual', label: 'Fully Manual', description: 'Bring your own assets and keep AI off until you choose otherwise.' },
  ];

const VIDEO_CACHE_KEY = 'dashboard-videos-cache-v1';

function parseScenesFromScript(scriptText: string) {
  const lines = scriptText.split('\n').map((line) => line.trim()).filter(Boolean);
  return (lines.length > 0 ? lines : ['']).map((line, index) => ({
    text: line,
    summaryText: line || `Scene ${index + 1}`,
    imagePrompt: line ? `Cinematic 9:16 visual for: ${line}` : '',
    uploadedImagePath: '',
    voiceUrl: '',
    source: {
      script: line ? 'user' as const : 'none' as const,
      image: 'none' as const,
      voice: 'none' as const,
    },
    componentStatus: {
      script: line ? 'uploaded' as const : 'missing' as const,
      image: 'missing' as const,
      voice: 'missing' as const,
    },
  }));
}

function mapVideoStatus(video: VideoItem) {
  if (video.status === 'generated' || video.status === 'uploaded' || video.status === 'scheduled') return 'Rendered';
  if (video.status === 'draft') return 'Draft';
  return 'Editing';
}

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(true);
  const [renderingId, setRenderingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createMode, setCreateMode] = useState<CreationMode>('hybrid');
  const [assetChoices, setAssetChoices] = useState({
    generateWithAI: true,
    uploadScript: false,
    uploadVoice: false,
    uploadImages: false,
  });
  const [uploadState, setUploadState] = useState<UploadState>({
    scriptText: '',
    sourcePrompt: '',
    uploadedVoicePaths: [],
    uploadedImagePaths: [],
  });
  const [createMessage, setCreateMessage] = useState('');
  const [modelSelections, setModelSelections] = useState<StepModelSelections>(DEFAULT_MODEL_SELECTIONS);

  const fetchVideos = async () => {
    setLoadingVideos(true);
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();
      const nextVideos = Array.isArray(data) ? data : [];
      setVideos(nextVideos);
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(nextVideos));
      }
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cachedVideos = window.sessionStorage.getItem(VIDEO_CACHE_KEY);
      if (cachedVideos) {
        try {
          const parsed = JSON.parse(cachedVideos);
          if (Array.isArray(parsed)) {
            setVideos(parsed);
          }
        } catch {
          window.sessionStorage.removeItem(VIDEO_CACHE_KEY);
        }
      }
    }

    void fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => setModelSelections(normalizeModelSelections(data?.generationDefaults, DEFAULT_MODEL_SELECTIONS)));
    void fetchVideos();
  }, []);

  useEffect(() => {
    setCreateOpen(searchParams.get('create') === '1');
  }, [searchParams]);

  useEffect(() => {
    if (!videos.some((video) => video.status === 'generating' || video.status === 'scheduled')) return;
    const interval = setInterval(() => {
      void fetchVideos();
    }, 4000);
    return () => clearInterval(interval);
  }, [videos]);

  const stats = useMemo(() => ({
    total: videos.length,
    drafts: videos.filter((video) => video.status === 'draft').length,
    editing: videos.filter((video) => video.status === 'generating' || video.status === 'failed').length,
    rendered: videos.filter((video) => video.status === 'generated' || video.status === 'uploaded').length,
  }), [videos]);

  const closeCreateModal = () => {
    setCreateOpen(false);
    setCreateStep(1);
    setCreateMessage('');
    setCreateMode('hybrid');
    setAssetChoices({
      generateWithAI: true,
      uploadScript: false,
      uploadVoice: false,
      uploadImages: false,
    });
    setUploadState({
      scriptText: '',
      sourcePrompt: '',
      uploadedVoicePaths: [],
      uploadedImagePaths: [],
    });
    router.replace('/dashboard');
  };

  const applyCreateMode = (mode: CreationMode) => {
    setCreateMode(mode);

    if (mode === 'full-ai') {
      setAssetChoices({
        generateWithAI: true,
        uploadScript: false,
        uploadVoice: false,
        uploadImages: false,
      });
      return;
    }

    if (mode === 'manual') {
      setAssetChoices((prev) => ({
        ...prev,
        generateWithAI: false,
      }));
      return;
    }

    setAssetChoices((prev) => ({
      ...prev,
      generateWithAI: true,
    }));
  };

  const updateAssetChoice = (field: keyof typeof assetChoices, value: boolean) => {
    setAssetChoices((prev) => ({
      ...prev,
      [field]: value,
      generateWithAI: field === 'generateWithAI' ? value : prev.generateWithAI,
    }));
  };

  const handleScriptFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setUploadState((prev) => ({ ...prev, scriptText: text }));
  };

  const uploadMany = async (files: FileList | null, endpoint: '/api/upload-scene-image' | '/api/upload-scene-audio') => {
    if (!files || files.length === 0) return [];
    const paths: string[] = [];
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Upload failed');
      }
      if (typeof data?.path === 'string') {
        paths.push(data.path);
      }
    }
    return paths;
  };

  const buildScenePayload = async () => {
    let scenes = parseScenesFromScript(uploadState.scriptText);

    if (!uploadState.scriptText.trim() && assetChoices.generateWithAI && uploadState.sourcePrompt.trim()) {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: uploadState.sourcePrompt,
          promptType: 'idea',
          modelSelections,
        }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data?.scriptData?.scenes)) {
        throw new Error(data?.error || 'Failed to generate the script draft');
      }
      scenes = data.scriptData.scenes.map((scene: { text?: string; imagePrompt?: string }, index: number) => ({
        text: scene.text || '',
        summaryText: scene.text || `Scene ${index + 1}`,
        imagePrompt: scene.imagePrompt || '',
        uploadedImagePath: '',
        voiceUrl: '',
        source: {
          script: 'ai' as const,
          image: 'ai' as const,
          voice: 'ai' as const,
        },
        componentStatus: {
          script: 'generated' as const,
          image: scene.imagePrompt ? 'generated' as const : 'missing' as const,
          voice: scene.text ? 'generated' as const : 'missing' as const,
        },
      }));
    }

    const sceneCount = Math.max(scenes.length, uploadState.uploadedImagePaths.length, uploadState.uploadedVoicePaths.length, 1);
    const nextScenes = Array.from({ length: sceneCount }, (_, index) => {
      const base = scenes[index] || {
        text: '',
        summaryText: `Scene ${index + 1}`,
        imagePrompt: '',
        uploadedImagePath: '',
        voiceUrl: '',
        source: {
          script: 'none' as const,
          image: 'none' as const,
          voice: 'none' as const,
        },
        componentStatus: {
          script: 'missing' as const,
          image: 'missing' as const,
          voice: 'missing' as const,
        },
      };
      const imagePath = uploadState.uploadedImagePaths[index] || '';
      const voicePath = uploadState.uploadedVoicePaths[index] || '';
      return {
        ...base,
        uploadedImagePath: imagePath,
        voiceUrl: voicePath,
        source: {
          script: base.source.script,
          image: imagePath ? 'user' as const : base.source.image,
          voice: voicePath ? 'user' as const : base.source.voice,
        },
        componentStatus: {
          script: base.text ? base.componentStatus.script : 'missing',
          image: imagePath ? 'uploaded' as const : base.componentStatus.image,
          voice: voicePath ? 'uploaded' as const : base.componentStatus.voice,
        },
      };
    });

    return nextScenes;
  };

  const handleCreateProject = async () => {
    setCreating(true);
    setCreateMessage('');
    try {
      const scenes = await buildScenePayload();
      const response = await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: uploadState.sourcePrompt,
          promptType: uploadState.scriptText.trim() ? 'script' : 'idea',
          modelSelections,
          creationMode: createMode,
          generationIntent: createMode === 'manual' ? 'draft' : 'generate',
          scriptData: {
            title: uploadState.sourcePrompt ? `${uploadState.sourcePrompt.slice(0, 70)}` : 'New Video Project',
            description: 'Created with the hybrid video workflow.',
            tags: [createMode, assetChoices.uploadScript ? 'user-script' : 'ai-script'],
            scenes,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to create the project');
      }

      closeCreateModal();
      await fetchVideos();
      if (data?.videoId) {
        router.push(`/videos/${data.videoId}`);
      }
    } catch (error: unknown) {
      setCreateMessage(error instanceof Error ? error.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  };

  const handleRender = async (videoId: string) => {
    setRenderingId(videoId);
    try {
      const res = await fetch(`/api/videos/${videoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generationIntent: 'render' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to queue render');
      }
      await fetchVideos();
    } catch (error: unknown) {
      alert(error instanceof Error ? error.message : 'Failed to queue render');
    } finally {
      setRenderingId('');
    }
  };

  const handleDelete = async (videoId: string) => {
    if (!confirm('Delete this video project and its current saved state?')) return;
    setDeletingId(videoId);
    try {
      await fetch(`/api/videos/${videoId}`, { method: 'DELETE' });
      await fetchVideos();
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-8">
      <section className="rounded-[32px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_28%),linear-gradient(180deg,_#0f172a,_#020617)] p-6 shadow-2xl md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Hybrid Video Workspace</p>
            <h1 className="mt-3 max-w-4xl text-3xl font-black tracking-tight text-white md:text-5xl">
              User-first assets, AI only where it actually helps.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
              Create fully manual, fully AI, or hybrid video projects. The system now keeps AI off for anything the user already provided, and the studio handles scene-level fallbacks only where needed.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
            >
              <Plus size={16} />
              Create New Video
            </button>
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
            >
              <Wand2 size={16} />
              Open Studio
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Projects', value: stats.total, tone: 'text-white' },
            { label: 'Drafts', value: stats.drafts, tone: 'text-amber-300' },
            { label: 'Editing', value: stats.editing, tone: 'text-cyan-300' },
            { label: 'Rendered', value: stats.rendered, tone: 'text-emerald-300' },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">{item.label}</p>
              <p className={`mt-2 text-2xl font-black ${item.tone}`}>{item.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Main Home</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Video List</h2>
          </div>
          <p className="max-w-2xl text-sm text-slate-400">
            Each project keeps its own hybrid inputs, scene statuses, and editor state. Render only when your manual or AI-assisted scenes are ready.
          </p>
        </div>

        {loadingVideos && videos.length === 0 ? (
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-10 text-center text-slate-300">
            <Loader2 className="mx-auto animate-spin" size={28} />
          </div>
        ) : videos.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
            <Clapperboard className="mx-auto text-slate-600" size={40} />
            <p className="mt-4 text-lg font-semibold text-slate-200">No video projects yet</p>
            <p className="mt-2 text-sm text-slate-500">Create your first manual, hybrid, or AI-assisted video from the button above.</p>
          </div>
        ) : (
          ""
        )}

        {loadingVideos && videos.length > 0 && (
          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            Refreshing projects in the background...
          </div>
        )}
      </section>
      <div className="grid gap-5 lg:grid-cols-2">
        {videos.map((video) => {
          const incompleteScenes = video.projectManifest?.scriptSegments?.filter((scene) => scene.status === 'missing').length || 0;
          return (
            <motion.article
              key={video._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[30px] border border-slate-800 bg-slate-900/80 shadow-xl"
            >
              <div className="grid gap-0 md:grid-cols-[220px_1fr]">
                <div className="border-b border-slate-800 bg-slate-950/70 p-4 md:border-b-0 md:border-r">
                  <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900">
                    {video.thumbnail ? (
                      <Image src={video.thumbnail} alt={video.title || 'Thumbnail preview'} fill unoptimized className="object-cover" />
                    ) : video.videoPath ? (
                      <video className="h-full w-full object-cover" src={video.videoPath} />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_36%),linear-gradient(180deg,_#111827,_#020617)] text-slate-600">
                        <Film size={42} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                        {video.projectManifest?.creationMode || 'hybrid'} workflow
                      </p>
                      <h3 className="mt-2 text-2xl font-bold text-white">{video.title || 'Untitled project'}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {video.description || 'Open the studio to finish scenes, upload assets, or generate only the missing parts.'}
                      </p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] ${mapVideoStatus(video) === 'Rendered' ? 'bg-emerald-500/10 text-emerald-300' : mapVideoStatus(video) === 'Draft' ? 'bg-amber-500/10 text-amber-200' : 'bg-cyan-500/10 text-cyan-200'}`}>
                      {mapVideoStatus(video)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Script', value: video.scriptStatus || 'pending' },
                      { label: 'Voice', value: video.voiceStatus || 'pending' },
                      { label: 'Images', value: video.imageStatus || 'pending' },
                      { label: 'Scenes Missing', value: String(incompleteScenes) },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                        <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">{item.label}</p>
                        <p className="mt-2 text-sm font-bold text-slate-100">{item.value}</p>
                      </div>
                    ))}
                  </div>

                  {video.failedStep && (
                    <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {video.failedStep}. Open Studio to fix the scene inputs or render again.
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/videos/${video._id}`}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
                    >
                      <PenSquare size={15} />
                      Edit In Studio
                    </Link>
                    <button
                      onClick={() => void handleRender(video._id)}
                      disabled={renderingId === video._id}
                      className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"
                    >
                      {renderingId === video._id ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                      Render
                    </button>
                    <button
                      onClick={() => void handleDelete(video._id)}
                      disabled={deletingId === video._id}
                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-40"
                    >
                      {deletingId === video._id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>
      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 p-0 md:items-center md:p-6"
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              className="max-h-[96vh] w-full max-w-4xl overflow-y-auto rounded-t-[28px] border border-slate-800 bg-slate-900 p-5 shadow-2xl md:rounded-[30px] md:p-7"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-cyan-300/80">Create New Video</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Hybrid creation flow</h2>
                </div>
                <button onClick={closeCreateModal} className="rounded-2xl border border-slate-700 bg-slate-950 p-3 text-slate-300 transition hover:bg-slate-800">
                  <X size={16} />
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {[1, 2, 3].map((step) => (
                  <div key={step} className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.25em] ${createStep === step ? 'bg-cyan-400 text-slate-950' : 'bg-slate-950 text-slate-400'}`}>
                    Step {step}
                  </div>
                ))}
              </div>

              {createStep === 1 && (
                <div className="mt-6 grid gap-4 md:grid-cols-3">
                  {CREATION_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => applyCreateMode(mode.id)}
                      className={`rounded-[28px] border p-5 text-left transition ${createMode === mode.id ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/60 hover:bg-slate-950'}`}
                    >
                      <p className="text-lg font-bold text-white">{mode.label}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{mode.description}</p>
                    </button>
                  ))}
                </div>
              )}

              {createStep === 2 && (
                <div className="mt-6 space-y-6">
                  {createMode === 'full-ai' && (
                    <div className="rounded-[26px] border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-50">
                      <p className="font-semibold">Generate all through AI is active.</p>
                      <p className="mt-2 text-emerald-100/90">
                        Add the project brief below and the app will generate the script, narration, and scene images for you.
                      </p>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2">
                    <label className={`rounded-[26px] border p-5 transition ${assetChoices.generateWithAI ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={assetChoices.generateWithAI} onChange={(event) => updateAssetChoice('generateWithAI', event.target.checked)} />
                        <span className="font-semibold text-white">Generate all through AI</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">Use AI for the whole starting draft. User assets still override later in Studio.</p>
                    </label>
                    <label className={`rounded-[26px] border p-5 transition ${assetChoices.uploadScript ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={assetChoices.uploadScript} disabled={createMode === 'full-ai'} onChange={(event) => updateAssetChoice('uploadScript', event.target.checked)} />
                        <span className="font-semibold text-white">Upload your own Script</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">Paste it or upload a text file to seed the scene list.</p>
                    </label>
                    <label className={`rounded-[26px] border p-5 transition ${assetChoices.uploadVoice ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={assetChoices.uploadVoice} disabled={createMode === 'full-ai'} onChange={(event) => updateAssetChoice('uploadVoice', event.target.checked)} />
                        <span className="font-semibold text-white">Upload your own Voice</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">Add scene-level audio now, or finish it later inside the studio.</p>
                    </label>
                    <label className={`rounded-[26px] border p-5 transition ${assetChoices.uploadImages ? 'border-cyan-400/40 bg-cyan-500/10' : 'border-slate-800 bg-slate-950/60'}`}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={assetChoices.uploadImages} disabled={createMode === 'full-ai'} onChange={(event) => updateAssetChoice('uploadImages', event.target.checked)} />
                        <span className="font-semibold text-white">Upload your own Images</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">These get saved permanently and prevent duplicate image generation costs.</p>
                    </label>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">Idea or project brief</label>
                    <textarea
                      value={uploadState.sourcePrompt}
                      onChange={(event) => setUploadState((prev) => ({ ...prev, sourcePrompt: event.target.value }))}
                      placeholder="Describe the video goal, topic, or campaign."
                      className="min-h-[120px] w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/40"
                    />
                  </div>

                  {assetChoices.uploadScript && createMode !== 'full-ai' && (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div>
                        <label className="mb-2 block text-sm font-semibold text-slate-200">Script textarea</label>
                        <textarea
                          value={uploadState.scriptText}
                          onChange={(event) => setUploadState((prev) => ({ ...prev, scriptText: event.target.value }))}
                          placeholder="One line per scene..."
                          className="min-h-[180px] w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-cyan-400/40"
                        />
                      </div>
                      <div className="rounded-[26px] border border-slate-800 bg-slate-950/60 p-5">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                          <PenSquare size={15} />
                          Upload Script File
                          <input type="file" accept=".txt,.md" className="hidden" onChange={(event) => void handleScriptFile(event.target.files?.[0] || null)} />
                        </label>
                        <p className="mt-3 text-sm text-slate-400">Every non-empty line becomes a scene. You can refine the structure later in Studio.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {createStep === 3 && (
                <div className="mt-6 space-y-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[26px] border border-slate-800 bg-slate-950/60 p-5">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                        <Mic size={15} />
                        Upload Voice Files
                        <input
                          type="file"
                          accept="audio/*"
                          multiple
                          className="hidden"
                          onChange={async (event) => {
                            if (!event.target.files) return;
                            const paths = await uploadMany(event.target.files, '/api/upload-scene-audio');
                            setUploadState((prev) => ({ ...prev, uploadedVoicePaths: paths }));
                          }}
                        />
                      </label>
                      <p className="mt-3 text-sm text-slate-400">Scene voice files are mapped by order. Missing scenes can still use AI later.</p>
                      <p className="mt-3 text-sm text-slate-200">{uploadState.uploadedVoicePaths.length} voice files ready</p>
                    </div>

                    <div className="rounded-[26px] border border-slate-800 bg-slate-950/60 p-5">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-slate-800">
                        <ImagePlus size={15} />
                        Upload Image Files
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async (event) => {
                            if (!event.target.files) return;
                            const paths = await uploadMany(event.target.files, '/api/upload-scene-image');
                            setUploadState((prev) => ({ ...prev, uploadedImagePaths: paths }));
                          }}
                        />
                      </label>
                      <p className="mt-3 text-sm text-slate-400">Images are normalized to 9:16 and saved permanently for reuse.</p>
                      <p className="mt-3 text-sm text-slate-200">{uploadState.uploadedImagePaths.length} images ready</p>
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-cyan-500/20 bg-cyan-500/10 p-5 text-sm text-cyan-50">
                    <p className="font-semibold">Creation summary</p>
                    <div className="mt-3 space-y-2 text-cyan-100/90">
                      <p>Mode: {createMode}</p>
                      <p>Script source: {assetChoices.uploadScript && uploadState.scriptText.trim() ? 'user provided' : createMode === 'full-ai' ? 'AI will create everything' : assetChoices.generateWithAI ? 'AI fallback enabled' : 'manual blank scenes'}</p>
                      <p>Voice files: {uploadState.uploadedVoicePaths.length}</p>
                      <p>Image files: {uploadState.uploadedImagePaths.length}</p>
                      <p>
                        AI behavior: {createMode === 'manual'
                          ? 'No automatic AI generation on create. You will finish assets in Studio.'
                          : 'Only missing components will be generated after project creation.'}
                      </p>
                    </div>
                  </div>

                  {createMessage && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                      {createMessage}
                    </div>
                  )}
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => setCreateStep((prev) => Math.max(1, prev - 1))}
                  disabled={createStep === 1 || creating}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
                >
                  Back
                </button>
                <div className="flex flex-wrap gap-3">
                  {createStep < 3 ? (
                    <button
                      onClick={() => setCreateStep((prev) => Math.min(3, prev + 1))}
                      className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
                    >
                      Next
                      <CheckCircle2 size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={() => void handleCreateProject()}
                      disabled={creating}
                      className="inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-40"
                    >
                      {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      {createMode === 'manual' ? 'Create Draft Project' : 'Create And Fill Missing'}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
