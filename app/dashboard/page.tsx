'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Cpu,
  Database,
  Film,
  Loader2,
  RefreshCw,
  Telescope,
  Wand2,
  XCircle,
} from 'lucide-react';
import { FormatCard, PageHeader } from '@/components/format-ui';
import { RECOMMENDED_ORDER, VIDEO_FORMATS } from '@/lib/video-formats';
import { REEL_INSIGHTS, VERDICT_LABEL } from '@/lib/research';

type VideoItem = {
  _id: string;
  title?: string;
  thumbnail?: string;
  status: string;
  uploadStatus?: string;
  youtubeId?: string;
  createdAt: string;
  failedStep?: string;
};

type Health = {
  database: { ok: boolean; error?: string };
  keys: Record<'openai' | 'gemini' | 'elevenlabs' | 'leonardo' | 'youtube', boolean>;
  videoCount: number | null;
};

const STATUS_STYLE: Record<string, string> = {
  generated: 'bg-emerald-400/10 text-emerald-300',
  uploaded: 'bg-sky-400/10 text-sky-300',
  scheduled: 'bg-amber-400/10 text-amber-300',
  generating: 'bg-violet-400/10 text-violet-300',
  failed: 'bg-rose-400/10 text-rose-300',
};

const VERDICT_STYLE: Record<string, string> = {
  useful: 'text-emerald-300',
  'partly-true': 'text-amber-300',
  misleading: 'text-rose-300',
  'not-reviewed': 'text-slate-500',
};

// A render never takes hours: anything still "generating" after 2h died with its server process.
const STALL_MS = 2 * 60 * 60 * 1000;
const isStalled = (v: { status: string; createdAt: string }) =>
  v.status === 'generating' && Date.now() - new Date(v.createdAt).getTime() > STALL_MS;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export default function OverviewPage() {
  const [videos, setVideos] = useState<VideoItem[] | null>(null);
  const [videoError, setVideoError] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const [videoRes, healthRes] = await Promise.allSettled([
        fetch('/api/videos').then(async (res) => ({ ok: res.ok, data: await res.json() })),
        fetch('/api/health').then((res) => res.json()),
      ]);
      if (videoRes.status === 'fulfilled' && videoRes.value.ok && Array.isArray(videoRes.value.data)) {
        setVideos(videoRes.value.data);
        setVideoError('');
      } else {
        setVideos([]);
        setVideoError(
          videoRes.status === 'fulfilled' ? videoRes.value.data?.error || 'Could not load videos' : 'Could not load videos'
        );
      }
      if (healthRes.status === 'fulfilled') setHealth(healthRes.value);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const stats = useMemo(() => {
    const list = videos || [];
    return {
      total: list.length,
      rendered: list.filter((v) => ['generated', 'uploaded', 'scheduled'].includes(v.status)).length,
      uploaded: list.filter((v) => v.uploadStatus === 'uploaded' || Boolean(v.youtubeId)).length,
      attention: list.filter((v) => v.status === 'failed' || isStalled(v)).length,
      inProgress: list.filter((v) => v.status === 'generating' && !isStalled(v)).length,
    };
  }, [videos]);

  const formats = RECOMMENDED_ORDER.map((id) => VIDEO_FORMATS.find((f) => f.id === id)!).filter(Boolean);

  const readiness = [
    { label: 'Database', ok: health?.database.ok, icon: Database, hint: health?.database.ok ? 'MongoDB connected' : health?.database.error || 'Checking' },
    { label: 'Script AI (OpenAI)', ok: health?.keys.openai, icon: CheckCircle2, hint: 'Scripts + Whisper captions' },
    { label: 'Voice (ElevenLabs)', ok: health?.keys.elevenlabs, icon: CheckCircle2, hint: 'Narration for every format' },
    { label: 'Images (Leonardo)', ok: health?.keys.leonardo, icon: CheckCircle2, hint: 'Image + Voiceover format' },
    { label: 'YouTube upload', ok: health?.keys.youtube, icon: CheckCircle2, hint: 'OAuth refresh token' },
    { label: 'Video GPU (animation)', ok: false, icon: Cpu, hint: 'This PC: Intel graphics only. Use cloud GPU or API.' },
  ];

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Overview"
        title="Your channel engine"
        description="Pick a video format, produce it in the Studio, and track every Short from script to YouTube. Strategy is based on the reels we studied."
      >
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
        <Link
          href="/studio"
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:brightness-110"
        >
          <Wand2 size={15} />
          New video
        </Link>
      </PageHeader>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: 'All videos', value: stats.total, tone: 'text-white' },
          { label: 'Rendered', value: stats.rendered, tone: 'text-emerald-300' },
          { label: 'On YouTube', value: stats.uploaded, tone: 'text-sky-300' },
          { label: 'In progress', value: stats.inProgress, tone: 'text-violet-300' },
          { label: 'Failed / stalled', value: stats.attention, tone: 'text-rose-300' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl border border-white/[0.07] bg-[var(--panel)] px-4 py-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{kpi.label}</p>
            <p className={`mt-2 font-display text-3xl font-bold ${kpi.tone}`}>
              {videos === null ? <Loader2 size={22} className="animate-spin text-slate-600" /> : kpi.value}
            </p>
          </div>
        ))}
      </section>

      {/* Format strategy cards */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Choose a video format</h2>
            <p className="mt-1 text-sm text-slate-400">One card per type of Short. Each has its own pipeline, tools, cost and setup plan.</p>
          </div>
          <Link href="/formats" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline">
            Compare all formats <ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {formats.map((format, index) => (
            <FormatCard key={format.id} format={format} recommended={index === 0} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        {/* Recent videos */}
        <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-white">Recent videos</h2>
            <Link href="/studio?tab=library" className="text-sm font-semibold text-slate-300 hover:text-white">
              Open library
            </Link>
          </div>

          {videoError && (
            <div className="mt-4 flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{videoError}</span>
            </div>
          )}

          {videos === null ? (
            <div className="mt-6 space-y-3">
              {[0, 1, 2].map((n) => (
                <div key={n} className="h-16 animate-pulse rounded-2xl bg-white/[0.03]" />
              ))}
            </div>
          ) : videos.length === 0 && !videoError ? (
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-8 text-center">
              <Film size={24} className="mx-auto text-slate-600" />
              <p className="mt-3 text-sm text-slate-400">No videos yet. Create the first one in the Studio.</p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.05]">
              {videos.slice(0, 6).map((video) => (
                <li key={video._id} className="flex items-center gap-4 py-3">
                  <div className="h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-white/[0.04]">
                    {video.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={video.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Film size={16} className="m-auto mt-4 text-slate-600" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/videos/${video._id}`} className="block truncate text-sm font-semibold text-slate-100 hover:text-white">
                      {video.title || 'Untitled video'}
                    </Link>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {timeAgo(video.createdAt)}
                      {video.status === 'failed' && video.failedStep ? ` · failed at ${video.failedStep}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${
                      isStalled(video) ? STATUS_STYLE.failed : STATUS_STYLE[video.status] || 'bg-white/[0.05] text-slate-300'
                    }`}
                    title={isStalled(video) ? 'Stuck: the server stopped before this render finished. Retry it in the Library.' : undefined}
                  >
                    {video.uploadStatus === 'uploaded' ? 'on YouTube' : isStalled(video) ? 'stalled' : video.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Readiness */}
        <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5">
          <h2 className="font-display text-lg font-bold text-white">System readiness</h2>
          <p className="mt-1 text-xs text-slate-500">Checks keys exist (values are never shown).</p>
          <ul className="mt-4 space-y-2">
            {readiness.map((row) => (
              <li key={row.label} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-black/20 px-3 py-2.5">
                {row.ok === undefined ? (
                  <Circle size={16} className="shrink-0 text-slate-600" />
                ) : row.ok ? (
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
                ) : (
                  <XCircle size={16} className="shrink-0 text-rose-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-200">{row.label}</p>
                  <p className="truncate text-xs text-slate-500">{row.hint}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Strategy + research */}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="rounded-3xl border border-white/[0.07] bg-gradient-to-br from-[var(--accent-soft)] to-transparent p-5">
          <h2 className="font-display text-lg font-bold text-white">The plan</h2>
          <ol className="mt-4 space-y-4">
            {[
              { t: 'Fix the script first', d: 'Hook in the first 2 seconds, one idea per beat, an on-screen note for every beat (yt-script method). Helps every format.' },
              { t: 'Motion Graphics is live', d: 'Motion Studio: AI script, free voice, live preview and MP4 render on this PC. Pick the channel voice and post daily.' },
              { t: 'Add Animation with a GPU', d: 'Wan2GP is free but needs an NVIDIA GPU: rent one by the hour, or use a video API per clip.' },
              { t: 'Keep Image + Voiceover for tests', d: 'Faster cuts (an image every 2-3 s), more scenes. Use it to test a niche cheaply.' },
            ].map((step, i) => (
              <li key={step.t} className="flex gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-slate-950">{i + 1}</span>
                <div>
                  <p className="text-sm font-semibold text-white">{step.t}</p>
                  <p className="mt-0.5 text-sm leading-6 text-slate-400">{step.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-3xl border border-white/[0.07] bg-[var(--panel)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
              <Telescope size={18} className="text-[var(--accent)]" /> What the reels taught us
            </h2>
            <Link href="/research" className="text-sm font-semibold text-slate-300 hover:text-white">
              All research
            </Link>
          </div>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {REEL_INSIGHTS.filter((r) => r.verdict !== 'not-reviewed').slice(0, 3).map((reel) => (
              <li key={reel.id} className="flex flex-col rounded-2xl border border-white/[0.06] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-semibold text-slate-300">{reel.creator}</span>
                  <span className={`shrink-0 text-[11px] font-bold ${VERDICT_STYLE[reel.verdict]}`}>{VERDICT_LABEL[reel.verdict]}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-300">{reel.takeaway}</p>
                <a
                  href={reel.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-auto inline-flex items-center gap-1 pt-3 text-xs font-semibold text-slate-500 hover:text-slate-200"
                >
                  Open reel <ArrowUpRight size={12} />
                </a>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
