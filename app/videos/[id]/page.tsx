"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink, ImageIcon, Loader2, Mic, Send, Video as VideoIcon } from 'lucide-react';

type SceneItem = {
  text: string;
  imagePrompt: string;
};

type VideoDetail = {
  _id: string;
  title?: string;
  description?: string;
  tags?: string[];
  status: string;
  youtubeId?: string;
  videoPath?: string;
  audioPath?: string;
  imagePaths?: string[];
  voiceoverText?: string;
  scenes?: SceneItem[];
  sourcePrompt?: string;
  failedStep?: string;
  failedTool?: string;
  errorSummary?: string;
  errorDetails?: string;
};

export default function VideoDetailPage() {
  const params = useParams<{ id: string }>();
  const [video, setVideo] = useState<VideoDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchVideo = async () => {
      const res = await fetch(`/api/videos/${params.id}`);
      const data = await res.json();
      setVideo(data);
      setLoading(false);
    };

    void fetchVideo();
  }, [params.id]);

  const handleUpload = async () => {
    if (!video) return;
    setUploading(true);
    try {
      await fetch('/api/upload-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: video._id }),
      });
      const res = await fetch(`/api/videos/${video._id}`);
      const data = await res.json();
      setVideo(data);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-3 text-slate-300"><Loader2 className="animate-spin" size={18} />Loading video details...</div>;
  }

  if (!video) {
    return <div className="text-slate-300">Video not found.</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
        {(video.status === 'generated' || video.status === 'uploaded' || video.status === 'scheduled') && video.videoPath && !video.youtubeId && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-400 disabled:opacity-40"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Upload to YouTube
          </button>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-slate-800 bg-slate-900/80 p-4 shadow-xl">
            <div className="relative aspect-[9/16] overflow-hidden rounded-[24px] border border-slate-800 bg-slate-950">
              {video.videoPath ? (
                <video controls className="h-full w-full object-cover" src={video.videoPath} />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-600">
                  <VideoIcon size={44} />
                </div>
              )}
            </div>
            {video.videoPath && (
              <a href={video.videoPath} download className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800">
                <Download size={16} />
                Download video
              </a>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-5 shadow-xl">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Voiceover</p>
            {video.audioPath ? (
              <>
                <audio controls className="mt-4 w-full">
                  <source src={video.audioPath} type="audio/mpeg" />
                </audio>
                <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm leading-6 text-slate-300">
                  {video.voiceoverText || 'No transcript available.'}
                </div>
              </>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Voiceover not available.</p>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-300/80">Video Detail</p>
            <h1 className="mt-3 text-4xl font-black text-white">{video.title || 'Untitled video'}</h1>
            <p className="mt-4 text-sm leading-7 text-slate-300">{video.description || 'No description available.'}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(video.tags || []).map((tag) => (
                <span key={`${video._id}-${tag}`} className="rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-xs text-slate-300">#{tag}</span>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
              Status: <span className="font-bold text-white">{video.status}</span>
              {video.youtubeId && <span className="ml-3 text-red-300">YouTube ID: {video.youtubeId}</span>}
            </div>
            <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Original Prompt</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">{video.sourcePrompt || 'No original prompt saved.'}</p>
            </div>
            {video.failedStep && (
              <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
                <p className="text-sm font-bold text-rose-100">{video.failedStep}</p>
                <p className="mt-1 text-xs text-rose-200/90">Tool: {video.failedTool || 'Unknown'}{video.errorSummary ? ` | ${video.errorSummary}` : ''}</p>
              </div>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500"><ImageIcon size={14} />Generated Images</p>
            {video.imagePaths && video.imagePaths.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-4">
                {video.imagePaths.map((imagePath, index) => (
                  <a
                    key={`${video._id}-img-${index}`}
                    href={imagePath}
                    target="_blank"
                    rel="noreferrer"
                    className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 transition hover:border-cyan-400/40"
                  >
                    <div className="relative aspect-[9/16]">
                      <Image src={imagePath} alt={`Scene ${index + 1}`} fill unoptimized className="object-cover" />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2 text-xs text-slate-300">
                      <span>Scene {index + 1}</span>
                      <ExternalLink size={14} />
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-400">No generated images yet.</p>
            )}
          </div>

          <div className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-6 shadow-xl">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-slate-500"><Mic size={14} />Script And Prompts</p>
            <div className="mt-4 space-y-3">
              {(video.scenes || []).map((scene, index) => (
                <div key={`${video._id}-scene-${index}`} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <p className="text-sm font-bold text-white">Scene {index + 1}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-200">{scene.text}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-500">Image Prompt</p>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{scene.imagePrompt}</p>
                </div>
              ))}
            </div>
          </div>

          {video.errorDetails && (
            <div className="rounded-[28px] border border-rose-500/20 bg-rose-500/10 p-6 shadow-xl">
              <p className="text-xs uppercase tracking-[0.25em] text-rose-200/80">Error Details</p>
              <pre className="mt-4 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-rose-100/90">{video.errorDetails}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
