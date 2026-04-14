"use client";

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Download,
  Film,
  ImageIcon,
  Loader2,
  Mic,
  PencilLine,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  Wand2,
  XCircle,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  DEFAULT_MODEL_SELECTIONS,
  IMAGE_MODEL_OPTIONS,
  SCRIPT_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
  VOICE_MODEL_OPTIONS,
  normalizeModelSelections,
  type StepModelSelections,
} from '@/lib/generation-config';

type SceneItem = {
  text: string;
  imagePrompt: string;
};

type ScriptDraft = {
  title: string;
  description: string;
  tags: string[];
  scenes: SceneItem[];
};

type VideoItem = {
  _id: string;
  title?: string;
  description?: string;
  tags?: string[];
  thumbnail?: string;
  videoPath?: string;
  audioPath?: string;
  imagePaths?: string[];
  createdAt: string;
  status: string;
  youtubeId?: string;
  scriptStatus?: string;
  voiceStatus?: string;
  imageStatus?: string;
  videoRenderStatus?: string;
  failedStep?: string;
  failedTool?: string;
  errorSummary?: string;
  errorDetails?: string;
  sourcePrompt?: string;
  voiceoverText?: string;
  audioGenerated?: boolean;
  modelSelections?: StepModelSelections;
  scenes?: SceneItem[];
};

const MODEL_GROUPS = [
  { key: 'script', label: 'Script Model', icon: PencilLine, options: SCRIPT_MODEL_OPTIONS },
  { key: 'voice', label: 'Voice Model', icon: Mic, options: VOICE_MODEL_OPTIONS },
  { key: 'image', label: 'Image Model', icon: ImageIcon, options: IMAGE_MODEL_OPTIONS },
  { key: 'video', label: 'Video Render', icon: Film, options: VIDEO_MODEL_OPTIONS },
] as const;

function createManualDraft(content: string): ScriptDraft {
  const lines = content.split('\n').map((line) => line.trim()).filter(Boolean);
  const scenes = (lines.length > 0 ? lines : ['Add your first scene here.']).map((line) => ({
    text: line,
    imagePrompt: `Cinematic visual for: ${line}`,
  }));

  return {
    title: 'Manual Script Draft',
    description: 'Edited manually before media generation.',
    tags: ['manual-script'],
    scenes,
  };
}

function getRetryStep(video: VideoItem) {
  if (video.failedStep === 'Script generation') return 'script';
  if (video.failedStep === 'Voiceover generation') return 'voice';
  if (video.failedStep === 'Image generation') return 'image';
  return 'video';
}

export default function Dashboard() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<'idea' | 'script' | 'bulk'>('idea');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'composer' | 'library'>('composer');
  const [libraryFilter, setLibraryFilter] = useState<'all' | 'generated' | 'failed' | 'processing'>('all');
  const [content, setContent] = useState('');
  const [bulkCount, setBulkCount] = useState(1);
  const [modelSelections, setModelSelections] = useState<StepModelSelections>(DEFAULT_MODEL_SELECTIONS);
  const [draft, setDraft] = useState<ScriptDraft | null>(null);
  const [draftSourcePrompt, setDraftSourcePrompt] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryingKey, setRetryingKey] = useState('');
  const [uploadingVideoId, setUploadingVideoId] = useState('');

  const fetchVideos = async () => {
    const res = await fetch('/api/videos');
    const data = await res.json();
    setVideos(Array.isArray(data) ? data : []);
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/settings');
    const data = await res.json();
    setModelSelections(normalizeModelSelections(data?.generationDefaults, DEFAULT_MODEL_SELECTIONS));
  };

  useEffect(() => {
    void Promise.all([fetchVideos(), fetchSettings()]);
  }, []);

  useEffect(() => {
    if (!videos.some((video) => video.status === 'generating' || video.status === 'scheduled')) return;
    const interval = setInterval(() => {
      void fetchVideos();
    }, 4000);
    return () => clearInterval(interval);
  }, [videos]);

  const generatedVideos = useMemo(() => videos.filter((video) => video.videoPath), [videos]);
  const filteredVideos = useMemo(() => {
    if (libraryFilter === 'generated') return videos.filter((video) => video.status === 'generated' || video.status === 'uploaded' || video.status === 'scheduled');
    if (libraryFilter === 'failed') return videos.filter((video) => video.status === 'failed');
    if (libraryFilter === 'processing') return videos.filter((video) => video.status === 'generating' || video.status === 'scheduled');
    return videos;
  }, [libraryFilter, videos]);

  const handleModelChange = (key: keyof StepModelSelections, value: string) => {
    setModelSelections((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerateDraft = async () => {
    if (!content.trim()) return;

    if (activeInputTab === 'script') {
      setDraft(createManualDraft(content));
      setDraftSourcePrompt(content);
      return;
    }

    setDraftLoading(true);
    try {
      const res = await fetch('/api/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          promptType: activeInputTab,
          aiModel: modelSelections.script,
          modelSelections,
        }),
      });
      const data = await res.json();
      if (data?.scriptData) {
        setDraft({
          title: data.scriptData.title || 'Untitled video',
          description: data.scriptData.description || '',
          tags: Array.isArray(data.scriptData.tags) ? data.scriptData.tags : [],
          scenes: Array.isArray(data.scriptData.scenes) ? data.scriptData.scenes : [],
        });
        setDraftSourcePrompt(content);
      }
    } finally {
      setDraftLoading(false);
    }
  };

  const handleApproveAndGenerate = async () => {
    if (!draft || draft.scenes.length === 0) return;

    setLoading(true);
    try {
      await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: draftSourcePrompt || content,
          promptType: activeInputTab,
          aiModel: modelSelections.script,
          modelSelections,
          scriptData: draft,
        }),
      });

      setContent('');
      setDraft(null);
      setDraftSourcePrompt('');
      setActiveWorkspaceTab('library');
      await fetchVideos();
    } finally {
      setLoading(false);
    }
  };

  const handleBulkGenerate = async () => {
    setLoading(true);
    try {
      await fetch('/api/bulk-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: bulkCount, modelSelections }),
      });
      setActiveWorkspaceTab('library');
      await fetchVideos();
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = async (videoId: string, step: 'script' | 'voice' | 'image' | 'video') => {
    setRetryingKey(`${videoId}:${step}`);
    try {
      await fetch(`/api/videos/${videoId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
      await fetchVideos();
    } finally {
      setRetryingKey('');
    }
  };

  const handleUpload = async (videoId: string) => {
    setUploadingVideoId(videoId);
    try {
      await fetch('/api/upload-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId }),
      });
      await fetchVideos();
    } finally {
      setUploadingVideoId('');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure? This will delete all videos and generated media files.')) return;
    setIsDeleting(true);
    try {
      await fetch('/api/videos/delete-all', { method: 'DELETE' });
      setVideos([]);
    } finally {
      setIsDeleting(false);
    }
  };

  const updateDraftField = (field: keyof Omit<ScriptDraft, 'tags' | 'scenes'>, value: string) => {
    setDraft((prev) => prev ? { ...prev, [field]: value } : prev);
  };

  const updateDraftTagString = (value: string) => {
    setDraft((prev) => prev ? { ...prev, tags: value.split(',').map((tag) => tag.trim()).filter(Boolean) } : prev);
  };

  const updateDraftScene = (index: number, field: keyof SceneItem, value: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextScenes = [...prev.scenes];
      nextScenes[index] = { ...nextScenes[index], [field]: value };
      return { ...prev, scenes: nextScenes };
    });
  };

  const addScene = () => {
    setDraft((prev) => prev ? {
      ...prev,
      scenes: [...prev.scenes, { text: 'New scene text', imagePrompt: 'Describe the image for this scene' }],
    } : prev);
  };

  const removeScene = (index: number) => {
    setDraft((prev) => {
      if (!prev || prev.scenes.length <= 1) return prev;
      return { ...prev, scenes: prev.scenes.filter((_, sceneIndex) => sceneIndex !== index) };
    });
  };

  const getModelName = (groupKey: keyof StepModelSelections, modelId?: string) => {
    const group = MODEL_GROUPS.find((item) => item.key === groupKey);
    return group?.options.find((option) => option.id === modelId)?.name || modelId || 'Not set';
  };

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_34%),linear-gradient(180deg,_#0f172a_0%,_#020617_100%)] p-8 shadow-2xl">
        <div className="absolute -right-20 -top-16 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Automated Video Ops</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">Build, review, and ship short-form videos with control.</h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-300">
              Draft the script first, let the user review it, retry only the failed production step, and manage finished videos with proper media previews and YouTube actions.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">All Jobs</p>
              <p className="mt-2 text-2xl font-bold text-white">{videos.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Generated</p>
              <p className="mt-2 text-2xl font-bold text-emerald-400">{generatedVideos.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Failed</p>
              <p className="mt-2 text-2xl font-bold text-rose-400">{videos.filter((video) => video.status === 'failed').length}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Scheduled</p>
              <p className="mt-2 text-2xl font-bold text-amber-300">{videos.filter((video) => video.status === 'scheduled').length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-3">
        {[
          { id: 'composer', label: 'Composer', icon: Wand2 },
          { id: 'library', label: 'Generated Videos', icon: Clapperboard },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveWorkspaceTab(tab.id as 'composer' | 'library')}
            className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${activeWorkspaceTab === tab.id ? 'border-cyan-400/40 bg-cyan-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
        <button
          onClick={handleDeleteAll}
          disabled={isDeleting}
          className="ml-auto inline-flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
        >
          <Trash2 size={16} />
          Clear Studio
        </button>
      </section>

      {activeWorkspaceTab === 'composer' ? (
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-slate-950 p-1">
                {[
                  { id: 'idea', label: 'Idea to Script' },
                  { id: 'script', label: 'Manual Script' },
                  { id: 'bulk', label: 'Bulk Factory' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveInputTab(tab.id as 'idea' | 'script' | 'bulk')}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeInputTab === tab.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {activeInputTab !== 'bulk' ? (
                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-200">
                      {activeInputTab === 'idea' ? 'Describe the video idea' : 'Paste or write your script draft'}
                    </label>
                    <textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      placeholder={activeInputTab === 'idea'
                        ? 'Example: The strange reason molasses flooded Boston in 1919.'
                        : 'Scene 1...\nScene 2...\nScene 3...'}
                      className="min-h-[180px] w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-4 text-slate-200 outline-none transition focus:border-blue-500/40 focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {MODEL_GROUPS.map((group) => (
                      <div key={group.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                          <group.icon size={14} />
                          {group.label}
                        </p>
                        <select
                          value={modelSelections[group.key]}
                          onChange={(event) => handleModelChange(group.key, event.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-100 outline-none focus:border-cyan-400/40"
                        >
                          {group.options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 px-4 py-3 text-sm text-amber-100/85">
                    Script is reviewed before media generation. The user can edit title, scenes, prompts, and tags before voice, images, and render begin.
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={handleGenerateDraft}
                      disabled={draftLoading || !content.trim()}
                      className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-40"
                    >
                      {draftLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                      {activeInputTab === 'script' ? 'Open Script Editor' : 'Generate Script Draft'}
                    </button>
                    {draft && (
                      <button
                        onClick={() => setDraft(null)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
                      >
                        <XCircle size={16} />
                        Discard Draft
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-5">
                    <p className="text-lg font-bold text-white">Bulk generation with your current defaults</p>
                    <p className="mt-2 text-sm text-slate-400">Use this for unattended runs. Individual videos still keep their own model selections and runtime states.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {MODEL_GROUPS.map((group) => (
                      <div key={group.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">{group.label}</p>
                        <select
                          value={modelSelections[group.key]}
                          onChange={(event) => handleModelChange(group.key, event.target.value)}
                          className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-3 text-sm text-slate-100 outline-none"
                        >
                          {group.options.map((option) => (
                            <option key={option.id} value={option.id}>{option.name}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <label className="mb-2 block text-sm font-semibold text-slate-200">Number of videos</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={bulkCount}
                        onChange={(event) => setBulkCount(Number(event.target.value))}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                      />
                    </div>
                    <button
                      onClick={handleBulkGenerate}
                      disabled={loading}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-40"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Start Bulk Run
                    </button>
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Script Approval</p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Review and edit before generation</h2>
                </div>
                {draft && (
                  <button
                    onClick={handleApproveAndGenerate}
                    disabled={loading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-40"
                  >
                    {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    Approve Script & Generate Media
                  </button>
                )}
              </div>

              {!draft ? (
                <div className="mt-6 rounded-3xl border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center">
                  <Wand2 className="mx-auto text-slate-600" size={36} />
                  <p className="mt-4 text-lg font-semibold text-slate-300">No script draft yet</p>
                  <p className="mt-2 text-sm text-slate-500">Generate a draft first, then edit scenes and approve it before voice, images, and video rendering start.</p>
                </div>
              ) : (
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Video Title</label>
                      <input
                        value={draft.title}
                        onChange={(event) => updateDraftField('title', event.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Tags</label>
                      <input
                        value={draft.tags.join(', ')}
                        onChange={(event) => updateDraftTagString(event.target.value)}
                        className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Description</label>
                    <textarea
                      value={draft.description}
                      onChange={(event) => updateDraftField('description', event.target.value)}
                      className="min-h-[90px] w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-slate-100 outline-none"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Scene Editor</p>
                    <button
                      onClick={addScene}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                    >
                      <Plus size={14} />
                      Add Scene
                    </button>
                  </div>

                  <div className="space-y-4">
                    {draft.scenes.map((scene, index) => (
                      <div key={`draft-scene-${index}`} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-bold text-white">Scene {index + 1}</p>
                          <button
                            onClick={() => removeScene(index)}
                            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                          >
                            Remove
                          </button>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Script Text</label>
                            <textarea
                              value={scene.text}
                              onChange={(event) => updateDraftScene(index, 'text', event.target.value)}
                              className="min-h-[140px] w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Image Prompt</label>
                            <textarea
                              value={scene.imagePrompt}
                              onChange={(event) => updateDraftScene(index, 'imagePrompt', event.target.value)}
                              className="min-h-[140px] w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>

          <section className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">Operational View</p>
            <h2 className="mt-2 text-2xl font-bold text-white">Current production state</h2>
            <div className="mt-6 space-y-4">
              {videos.slice(0, 4).map((video) => (
                <div key={video._id} className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-bold text-white">{video.title || 'Processing video'}</p>
                      <p className="text-xs text-slate-500">{new Date(video.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] ${video.status === 'generated' ? 'bg-emerald-500/10 text-emerald-300' : video.status === 'failed' ? 'bg-rose-500/10 text-rose-300' : 'bg-blue-500/10 text-blue-300'}`}>
                      {video.status}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-300">Script: {video.scriptStatus}</div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-300">Voice: {video.voiceStatus}</div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-300">Images: {video.imageStatus}</div>
                    <div className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2 text-slate-300">Render: {video.videoRenderStatus}</div>
                  </div>
                  {video.failedStep && (
                    <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
                      {video.failedStep} via {video.failedTool || 'Unknown tool'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            {[
              { id: 'all', label: 'All Videos' },
              { id: 'generated', label: 'Generated' },
              { id: 'failed', label: 'Failed' },
              { id: 'processing', label: 'Processing' },
            ].map((filter) => (
              <button
                key={filter.id}
                onClick={() => setLibraryFilter(filter.id as 'all' | 'generated' | 'failed' | 'processing')}
                className={`rounded-2xl border px-4 py-2 text-sm font-semibold transition ${libraryFilter === filter.id ? 'border-cyan-400/40 bg-cyan-500/10 text-white' : 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <AnimatePresence>
              {filteredVideos.map((video, index) => {
                const retryStep = getRetryStep(video);
                const retryLabel = retryStep === 'image'
                  ? 'Retry Image Step'
                  : retryStep === 'video'
                    ? 'Retry Video Render'
                    : retryStep === 'voice'
                      ? 'Retry Voice Step'
                      : 'Retry Script Step';

                return (
                  <motion.article
                    key={video._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ delay: index * 0.03 }}
                    className="overflow-hidden rounded-[30px] border border-slate-800 bg-slate-900/80 shadow-2xl"
                  >
                    <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="border-b border-slate-800 bg-slate-950/80 p-4 lg:border-b-0 lg:border-r">
                        <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900">
                          {video.videoPath ? (
                            <video controls className="h-full w-full object-cover" src={video.videoPath} />
                          ) : video.thumbnail ? (
                            <Image src={video.thumbnail} alt={video.title || 'Video preview'} fill unoptimized className="object-cover" />
                          ) : (
                            <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.14),_transparent_36%),linear-gradient(180deg,_#0f172a,_#020617)] text-slate-500">
                              <Film size={44} />
                            </div>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] ${video.status === 'generated' || video.status === 'uploaded' ? 'bg-emerald-500/10 text-emerald-300' : video.status === 'failed' ? 'bg-rose-500/10 text-rose-300' : 'bg-blue-500/10 text-blue-300'}`}>
                            {video.status}
                          </span>
                          {video.youtubeId && (
                            <span className="rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-red-300">
                              Uploaded
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {video.videoPath && (
                            <a
                              href={video.videoPath}
                              download
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                            >
                              <Download size={16} />
                              Download Video
                            </a>
                          )}
                          <Link
                            href={`/videos/${video._id}`}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
                          >
                            Open Details
                          </Link>
                          {(video.status === 'generated' || video.status === 'uploaded') && !video.youtubeId && (
                            <button
                              onClick={() => handleUpload(video._id)}
                              disabled={uploadingVideoId === video._id}
                              className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-40"
                            >
                              {uploadingVideoId === video._id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                              Upload to YouTube
                            </button>
                          )}
                          {video.status === 'scheduled' && (
                            <span className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200">
                              <CalendarClock size={16} />
                              Upload in progress
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <Link href={`/videos/${video._id}`} className="text-2xl font-bold text-white transition hover:text-cyan-300">
                              {video.title || 'Untitled video'}
                            </Link>
                            <p className="mt-2 text-sm leading-6 text-slate-400">{video.description || 'No description yet.'}</p>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {(video.tags || []).map((tag) => (
                            <span key={`${video._id}-${tag}`} className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-300">
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          {[
                            { label: 'Script', value: video.scriptStatus, icon: PencilLine },
                            { label: 'Voice', value: video.voiceStatus, icon: Mic },
                            { label: 'Images', value: video.imageStatus, icon: ImageIcon },
                            { label: 'Render', value: video.videoRenderStatus, icon: Film },
                          ].map((item) => (
                            <div key={`${video._id}-${item.label}`} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                              <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-slate-500">
                                <item.icon size={13} />
                                {item.label}
                              </p>
                              <p className={`mt-2 text-sm font-bold ${item.value === 'done' ? 'text-emerald-300' : item.value === 'failed' ? 'text-rose-300' : 'text-slate-300'}`}>
                                {item.value || 'pending'}
                              </p>
                            </div>
                          ))}
                        </div>

                        {video.failedStep && (
                          <div className="mt-5 rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4">
                            <p className="text-sm font-bold text-rose-100">{video.failedStep}</p>
                            <p className="mt-1 text-xs text-rose-200/90">Tool: {video.failedTool || 'Unknown'}{video.errorSummary ? ` | ${video.errorSummary}` : ''}</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => handleRetry(video._id, retryStep)}
                                disabled={retryingKey === `${video._id}:${retryStep}`}
                                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-40"
                              >
                                {retryingKey === `${video._id}:${retryStep}` ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                                {retryLabel}
                              </button>
                            </div>
                          </div>
                        )}

                        <details className="mt-5 overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/50">
                          <summary className="cursor-pointer px-4 py-4 text-sm font-bold text-white">Open production details</summary>
                          <div className="space-y-5 border-t border-slate-800 px-4 py-4">
                            <div className="grid gap-4 xl:grid-cols-2">
                              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Original Prompt</p>
                                <p className="mt-2 text-sm leading-6 text-slate-300">{video.sourcePrompt || 'No original prompt saved.'}</p>
                              </div>
                              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Model Stack</p>
                                <div className="mt-2 space-y-1 text-sm text-slate-300">
                                  <p>Script: {getModelName('script', video.modelSelections?.script)}</p>
                                  <p>Voice: {getModelName('voice', video.modelSelections?.voice)}</p>
                                  <p>Image: {getModelName('image', video.modelSelections?.image)}</p>
                                  <p>Video: {getModelName('video', video.modelSelections?.video)}</p>
                                </div>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Voiceover Preview</p>
                              <p className="mt-2 text-sm text-slate-300">Status: {video.audioGenerated ? 'Generated and ready to preview' : 'Not generated yet'}</p>
                              {video.audioPath && (
                                <audio controls className="mt-3 w-full">
                                  <source src={video.audioPath} type="audio/mpeg" />
                                </audio>
                              )}
                              <div className="mt-3 max-h-36 overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-3 text-sm leading-6 text-slate-300">
                                {video.voiceoverText || 'No voiceover transcript available yet.'}
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Generated Images</p>
                              {video.imagePaths && video.imagePaths.length > 0 ? (
                                <div className="mt-3 grid grid-cols-2 gap-3 xl:grid-cols-4">
                                  {video.imagePaths.map((imagePath, imageIndex) => (
                                    <a
                                      key={`${video._id}-image-${imageIndex}`}
                                      href={imagePath}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 transition hover:border-cyan-400/40"
                                    >
                                      <div className="relative aspect-[9/16]">
                                        <Image src={imagePath} alt={`Scene ${imageIndex + 1}`} fill unoptimized className="object-cover" />
                                      </div>
                                      <div className="px-3 py-2 text-[11px] text-slate-400">Scene {imageIndex + 1}</div>
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-3 text-sm text-slate-400">No generated images are available yet.</p>
                              )}
                            </div>

                            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Script And Prompts</p>
                              <div className="mt-3 space-y-3">
                                {(video.scenes || []).map((scene, sceneIndex) => (
                                  <div key={`${video._id}-scene-${sceneIndex}`} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-3">
                                    <p className="text-xs font-bold text-white">Scene {sceneIndex + 1}</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-200">{scene.text}</p>
                                    <p className="mt-3 text-xs uppercase tracking-[0.25em] text-slate-500">Image Prompt</p>
                                    <p className="mt-2 text-sm leading-6 text-slate-400">{scene.imagePrompt}</p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {video.errorDetails && (
                              <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                                <p className="text-[11px] uppercase tracking-[0.25em] text-rose-200/80">Full Error Log</p>
                                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-rose-100/90">{video.errorDetails}</pre>
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredVideos.length === 0 && (
            <div className="rounded-[30px] border border-dashed border-slate-800 bg-slate-950/30 p-12 text-center">
              <CheckCircle2 className="mx-auto text-slate-600" size={40} />
              <p className="mt-4 text-lg font-bold text-slate-300">No videos in this view yet</p>
              <p className="mt-2 text-sm text-slate-500">Switch filters or generate a new draft from the composer tab.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
