"use client";

import { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Play, Plus, RefreshCw, Download, UploadCloud,
  Trash2, Wand2, Type, Sparkles, AlertCircle,
  Clock, CheckCircle2, XCircle, LayoutGrid, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DEFAULT_MODEL_SELECTIONS,
  IMAGE_MODEL_OPTIONS,
  SCRIPT_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
  VOICE_MODEL_OPTIONS,
  normalizeModelSelections,
  type StepModelSelections,
} from '@/lib/generation-config';

type VideoItem = {
  _id: string;
  title?: string;
  thumbnail?: string;
  videoPath?: string;
  audioPath?: string;
  createdAt: string;
  status: string;
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
  scenes?: Array<{ text: string; imagePrompt: string }>;
};

const MODEL_GROUPS = [
  { key: 'script', label: 'Script Model', options: SCRIPT_MODEL_OPTIONS },
  { key: 'voice', label: 'Voice Model', options: VOICE_MODEL_OPTIONS },
  { key: 'image', label: 'Image Model', options: IMAGE_MODEL_OPTIONS },
  { key: 'video', label: 'Video Render', options: VIDEO_MODEL_OPTIONS },
] as const;

export default function Dashboard() {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'idea' | 'bulk'>('idea');
  const [content, setContent] = useState('');
  const [bulkCount, setBulkCount] = useState(1);
  const [modelSelections, setModelSelections] = useState<StepModelSelections>(DEFAULT_MODEL_SELECTIONS);
  const [isDeleting, setIsDeleting] = useState(false);
  const [retryingVideoId, setRetryingVideoId] = useState('');
  const [mounted, setMounted] = useState(false);

  const fetchVideos = async () => {
    try {
      const res = await fetch('/api/videos');
      const data = await res.json();
      setVideos(Array.isArray(data) ? data : []);
    } catch {
      console.error('Failed to fetch videos');
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      const data = await res.json();
      setModelSelections(normalizeModelSelections(data?.generationDefaults, DEFAULT_MODEL_SELECTIONS));
    } catch {
      setModelSelections(DEFAULT_MODEL_SELECTIONS);
    }
  };

  useEffect(() => {
    setMounted(true);
    void Promise.all([fetchVideos(), fetchSettings()]);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    if (videos.some((video) => video.status === 'generating')) {
      interval = setInterval(fetchVideos, 5000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videos, mounted]);

  const handleModelChange = (key: keyof StepModelSelections, value: string) => {
    setModelSelections((prev) => ({ ...prev, [key]: value }));
  };

  const handleGenerate = async () => {
    if ((activeTab === 'script' || activeTab === 'idea') && !content.trim()) return;

    setLoading(true);
    try {
      await fetch('/api/generate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          promptType: activeTab,
          aiModel: modelSelections.script,
          modelSelections,
        })
      });
      setContent('');
      await fetchVideos();
    } catch (err) {
      console.error(err);
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
        body: JSON.stringify({ count: bulkCount, modelSelections })
      });
      await fetchVideos();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure? This will delete all videos AND media files permanently.')) return;
    setIsDeleting(true);
    try {
      await fetch('/api/videos/delete-all', { method: 'DELETE' });
      await fetchVideos();
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUpload = async (videoId: string) => {
    await fetch('/api/upload-youtube', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId })
    });
    await fetchVideos();
  };

  const handleRetry = async (videoId: string) => {
    setRetryingVideoId(videoId);
    try {
      await fetch(`/api/videos/${videoId}/retry`, { method: 'POST' });
      await fetchVideos();
    } catch (err) {
      console.error(err);
    } finally {
      setRetryingVideoId('');
    }
  };

  const isGenerating = videos.some((video) => video.status === 'generating');

  const getModelName = (groupKey: keyof StepModelSelections, modelId?: string) => {
    const group = MODEL_GROUPS.find((item) => item.key === groupKey);
    const option = group?.options.find((item) => item.id === modelId);
    return option?.name || modelId || 'Not set';
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-extrabold bg-gradient-to-br from-white via-slate-100 to-slate-500 bg-clip-text text-transparent flex items-center gap-3"
          >
            <Sparkles className="text-blue-500" />
            AI Video Studio
          </motion.h1>
          <p className="text-slate-400 mt-2">Professional automated short-form content factory.</p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={handleDeleteAll}
            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-5 py-2.5 rounded-xl border border-red-500/20 transition-all disabled:opacity-30"
            disabled={isDeleting}
          >
            <Trash2 size={18} />
            Clear Studio
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
        <div className="lg:col-span-2">
          <div className="bg-slate-900/50 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
              <Wand2 size={120} />
            </div>

            <div className="flex gap-1 bg-slate-950 p-1 rounded-2xl mb-8 w-fit border border-slate-800">
              {[
                { id: 'idea', label: 'Idea To Script', icon: Wand2 },
                { id: 'script', label: 'Manual Script', icon: Type },
                { id: 'bulk', label: 'Bulk Factory', icon: Plus },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'script' | 'idea' | 'bulk')}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                    }`}
                >
                  <tab.icon size={16} />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-6">
              {activeTab !== 'bulk' ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                      {activeTab === 'idea' ? 'Tell the AI what you want' : 'Paste your full script lines here'}
                      <AlertCircle size={14} className="text-slate-500" />
                    </label>
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder={activeTab === 'idea'
                        ? 'e.g., The lost civilization of Atlantis and why it might be real...'
                        : 'Line: Long ago in a distant land...\nLine: A hero rose to save the day...\nLine: But his journey was only beginning...'
                      }
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl px-5 py-4 text-slate-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all min-h-[160px] outline-none placeholder-slate-600 text-lg leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {MODEL_GROUPS.map((group) => (
                      <div key={group.key}>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                          {group.label}
                        </label>
                        <select
                          value={modelSelections[group.key]}
                          onChange={(e) => handleModelChange(group.key, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20"
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

                  <div className="rounded-2xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
                    Leonardo default is set to a basic SDXL 1.0 legacy profile with safe 9:16 dimensions so image generation stays within Leonardo API limits.
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={loading || !content.trim()}
                    className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white h-[48px] rounded-xl font-bold transition-all disabled:opacity-30 group shadow-lg shadow-blue-600/20"
                  >
                    {loading ? <RefreshCw className="animate-spin" /> : <Play size={20} className="group-hover:scale-110 transition-transform" />}
                    Start Generation
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-6">
                  <div className="bg-emerald-500/5 border border-emerald-500/10 p-6 rounded-2xl">
                    <h3 className="text-emerald-400 font-semibold mb-1 flex items-center gap-2">
                      <LayoutGrid size={18} />
                      Production Queue
                    </h3>
                    <p className="text-slate-400 text-sm">Automate your channel by generating a batch of videos at once using your selected defaults for every step.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {MODEL_GROUPS.map((group) => (
                      <div key={group.key}>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                          {group.label}
                        </label>
                        <select
                          value={modelSelections[group.key]}
                          onChange={(e) => handleModelChange(group.key, e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/20"
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

                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">Number of Videos</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={bulkCount}
                        onChange={(e) => setBulkCount(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 text-white px-5 py-3 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono text-xl"
                      />
                    </div>
                    <button
                      onClick={handleBulkGenerate}
                      disabled={loading}
                      className="flex-[2] mt-6 flex items-center justify-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white h-[52px] rounded-xl font-bold transition-all disabled:opacity-30 shadow-lg shadow-emerald-600/20"
                    >
                      {loading ? <RefreshCw className="animate-spin" /> : <Plus size={22} />}
                      Execute Bulk Run
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl h-full flex flex-col justify-center">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/10 text-blue-500 mb-6 border border-blue-500/20 shadow-inner">
                <RefreshCw className={loading ? 'animate-spin' : ''} size={32} />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">{videos.length} Videos</h3>
              <p className="text-slate-400 text-sm leading-relaxed px-4">
                Manage your production queue from one place. Retry failed stages, download rendered files, or upload directly to YouTube.
              </p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="bg-slate-950/50 p-4 rounded-2xl text-center border border-slate-800/50">
                <div className="text-emerald-500 font-mono text-xl font-bold">{videos.filter((video) => video.status === 'generated').length}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Ready</div>
              </div>
              <div className="bg-slate-950/50 p-4 rounded-2xl text-center border border-slate-800/50">
                <div className="text-blue-500 font-mono text-xl font-bold">{videos.filter((video) => video.status === 'generating').length}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Pending</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800/50 bg-slate-950/40 p-4 text-xs text-slate-400">
              Current defaults load from Settings, and you can still override all four steps here before each run.
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-slate-200 flex items-center gap-3">
          Your Production
          <div className="h-px bg-slate-800 flex-1 ml-4 min-w-[200px]" />
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        <AnimatePresence>
          {videos.map((video, index) => (
            <motion.div
              key={video._id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ delay: index * 0.05 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl group relative"
            >
              <div className="aspect-[9/16] bg-slate-800/50 relative">
                {video.thumbnail ? (
                  <Image src={video.thumbnail} alt={video.title || 'Generated video'} fill unoptimized className="object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all duration-500" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 bg-slate-950/30">
                    {video.status === 'generating' ? (
                      <div className="relative">
                        <RefreshCw className="animate-spin text-blue-500" size={48} />
                        <div className="absolute inset-0 blur-lg bg-blue-500/20 animate-pulse" />
                      </div>
                    ) : <XCircle size={48} className="text-slate-800" />}
                    <span className="text-xs font-semibold tracking-widest uppercase opacity-50">Rendering...</span>
                  </div>
                )}

                <div className="absolute top-4 left-4 z-10">
                  <div className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md border ${video.status === 'generated' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    video.status === 'generating' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>
                    <span className="flex items-center gap-1.5">
                      {video.status === 'generated' && <CheckCircle2 size={10} />}
                      {video.status === 'generating' && <Clock size={10} className="animate-pulse" />}
                      {video.status}
                    </span>
                  </div>
                </div>

                {video.videoPath && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    whileHover={{ opacity: 1 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center cursor-pointer"
                  >
                    <a href={video.videoPath} target="_blank" className="p-5 rounded-full bg-white text-black shadow-2xl hover:scale-110 transition-transform">
                      <Play size={24} fill="currentColor" />
                    </a>
                  </motion.div>
                )}
              </div>

              <div className="p-6 bg-gradient-to-b from-slate-900 to-slate-950">
                <h3 className="font-bold text-slate-100 truncate mb-1" title={video.title}>{video.title || 'Studio Processing...'}</h3>
                <p className="text-[10px] text-slate-500 flex items-center gap-1.5 mb-3">
                  <Clock size={10} />
                  {new Date(video.createdAt).toLocaleDateString()}
                </p>

                <div className="space-y-1 mb-4 border border-slate-800/50 rounded-xl p-3 bg-slate-950/30">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Script:</span>
                    <span className={video.scriptStatus === 'done' ? 'text-emerald-400' : video.scriptStatus === 'failed' ? 'text-red-400' : 'text-slate-500 uppercase tracking-wider'}>{video.scriptStatus || 'pending'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Voiceover:</span>
                    <span className={video.voiceStatus === 'done' ? 'text-emerald-400' : video.voiceStatus === 'failed' ? 'text-red-400' : 'text-slate-500 uppercase tracking-wider'}>{video.voiceStatus || 'pending'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Images:</span>
                    <span className={video.imageStatus === 'done' ? 'text-emerald-400' : video.imageStatus === 'failed' ? 'text-red-400' : 'text-slate-500 uppercase tracking-wider'}>{video.imageStatus || 'pending'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Video Render:</span>
                    <span className={video.videoRenderStatus === 'done' ? 'text-emerald-400' : video.videoRenderStatus === 'failed' ? 'text-red-400' : 'text-slate-500 uppercase tracking-wider'}>{video.videoRenderStatus || 'pending'}</span>
                  </div>
                </div>

                {video.status === 'failed' && (
                  <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300 break-words">
                    <p className="font-semibold text-red-200">{video.failedStep || video.errorSummary || 'Generation failed'}</p>
                    {video.errorSummary && video.errorSummary !== video.failedStep && (
                      <p className="mt-1 text-[11px] text-red-300/90">{video.errorSummary}</p>
                    )}
                    {(video.failedStep || video.failedTool) && (
                      <p className="mt-1 text-[11px] text-red-300/90">
                        Step: {video.failedStep || 'Unknown'} | Tool: {video.failedTool || 'Unknown'}
                      </p>
                    )}
                    {video.errorDetails && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] font-semibold">Show full error</summary>
                        <p className="mt-2 text-[10px] leading-relaxed whitespace-pre-wrap">{video.errorDetails}</p>
                      </details>
                    )}
                  </div>
                )}

                <details className="mb-4 rounded-xl border border-slate-800/70 bg-slate-950/40 p-3 text-xs text-slate-300">
                  <summary className="cursor-pointer font-semibold text-slate-200">More Details</summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Original Prompt</p>
                      <p className="text-[11px] leading-relaxed text-slate-300">{video.sourcePrompt || 'No prompt saved for this older video.'}</p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Selected Models</p>
                      <div className="space-y-1 text-[11px]">
                        <p>Script: {getModelName('script', video.modelSelections?.script)}</p>
                        <p>Voice: {getModelName('voice', video.modelSelections?.voice)}</p>
                        <p>Image: {getModelName('image', video.modelSelections?.image)}</p>
                        <p>Video: {getModelName('video', video.modelSelections?.video)}</p>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Voiceover</p>
                      <p className="text-[11px] mb-1">
                        Status: <span className={video.audioGenerated ? 'text-emerald-400' : 'text-slate-400'}>{video.audioGenerated ? 'Generated' : 'Not generated yet'}</span>
                      </p>
                      {video.audioPath && (
                        <audio controls className="w-full mb-2 h-9">
                          <source src={video.audioPath} type="audio/mpeg" />
                          Your browser does not support the audio element.
                        </audio>
                      )}
                      <p className="text-[11px] leading-relaxed text-slate-300 whitespace-pre-wrap max-h-24 overflow-y-auto">
                        {video.voiceoverText || 'No voiceover text available yet.'}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Script And Image Prompts</p>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {video.scenes?.length ? video.scenes.map((scene, sceneIndex) => (
                          <div key={`${video._id}-scene-${sceneIndex}`} className="rounded-lg border border-slate-800 bg-slate-900/60 p-2">
                            <p className="text-[10px] text-slate-500 mb-1">Scene {sceneIndex + 1}</p>
                            <p className="text-[11px] text-slate-200 leading-relaxed">{scene.text || 'No script text.'}</p>
                            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">{scene.imagePrompt || 'No image prompt.'}</p>
                          </div>
                        )) : (
                          <p className="text-[11px] text-slate-400">No scene details available yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </details>

                <div className="flex gap-2">
                  {video.videoPath && (
                    <a href={video.videoPath} download className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-all border border-slate-700 text-xs font-semibold">
                      <Download size={14} />
                      Download
                    </a>
                  )}
                  {video.status === 'generated' && (
                    <button
                      onClick={() => handleUpload(video._id)}
                      className="p-2.5 text-[#FF0000] bg-[#FF0000]/10 hover:bg-[#FF0000]/20 border border-[#FF0000]/20 rounded-xl transition-all"
                      title="Publish to YouTube"
                    >
                      <UploadCloud size={16} />
                    </button>
                  )}
                  {video.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(video._id)}
                      disabled={retryingVideoId === video._id || isGenerating}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl transition-all border border-amber-500/20 text-xs font-semibold disabled:opacity-40"
                    >
                      {retryingVideoId === video._id ? <RefreshCw size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                      Retry
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {videos.length === 0 && !loading && (
          <div className="col-span-full py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-950/20">
            <Sparkles size={48} className="mx-auto text-slate-700 mb-4" />
            <h3 className="text-xl font-bold text-slate-400">Your studio is empty</h3>
            <p className="text-slate-600 mt-2">Generate your first AI video to begin production.</p>
          </div>
        )}
      </div>
    </div>
  );
}
