'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Download, FilePlus2, FolderOpen, Info, Loader2, Pencil, Plus, RefreshCw, Trash2, Wand2, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/format-ui';
import { SCRIPT_MODEL_INFO, fmtCost, scriptEstimate } from '@/lib/cartoon/models';
import { ShotCard } from '@/components/cartoon/ShotCard';
import { VoiceStep, defaultVoiceChoice, type VoiceMode } from '@/components/cartoon/VoiceStep';
import { ModeStep, type ComfyStatus } from '@/components/cartoon/ModeStep';
import { YoutubeUpload } from '@/components/cartoon/YoutubeUpload';
import { SeriesEditor } from '@/components/cartoon/SeriesEditor';
import { useRecorder } from '@/components/cartoon/useRecorder';
import { api, card, field, fmtSeconds, ghostBtn, jsonBody, label } from '@/components/cartoon/ui';
import {
  episodeFrames,
  isTransition,
  keyShotIds,
  TRANSITION_SECONDS,
  newShotId,
  FPS,
  type CartoonEpisode,
  type CartoonSeries,
  type CartoonShot,
  type EpisodeRenderProps,
  type RenderMode,
} from '@/lib/cartoon/spec';
import type { EpisodeStatus, EpisodeSummary } from '@/lib/cartoon/store';

const EpisodePlayer = dynamic(() => import('@/components/cartoon/EpisodePlayer'), {
  ssr: false,
  loading: () => <div className="grid aspect-[9/16] w-full place-items-center rounded-[28px] bg-black/40 text-sm text-slate-500">Loading preview…</div>,
});

const STAGE_LABEL: Record<string, string> = {
  idle: 'Not rendered yet',
  queued: 'Starting',
  voice: 'Preparing voices',
  visuals: 'Preparing pictures',
  bundle: 'Preparing',
  render: 'Rendering frames',
  done: 'Ready',
  failed: 'Failed',
};
const FILES = '/api/cartoon/files';
/** Copy of `obj` without `key`. */
const omit = (obj: Record<string, string>, key: string) => Object.fromEntries(Object.entries(obj).filter(([k]) => k !== key));
const running = (s: EpisodeStatus | null) => Boolean(s && !['idle', 'done', 'failed'].includes(s.stage));

export default function CartoonStudioPage() {
  const [seriesList, setSeriesList] = useState<CartoonSeries[]>([]);
  const [seriesId, setSeriesId] = useState('');
  const [editingSeries, setEditingSeries] = useState(false);
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [episode, setEpisode] = useState<CartoonEpisode | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<EpisodeStatus | null>(null);
  const [topic, setTopic] = useState('');
  const [model, setModel] = useState('gpt-6.1-sol');
  const [writing, setWriting] = useState(false);
  const [busy, setBusy] = useState<Record<string, string>>({});
  const [bust, setBust] = useState<Record<string, number>>({});
  const [allowAi, setAllowAi] = useState(false);
  // Step 1 voice choices; null = use the series default.
  const [voiceMode, setVoiceMode] = useState<VoiceMode | null>(null);
  const [aiChoice, setAiChoice] = useState<string | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  // Step 2 video type and what this PC's ComfyUI can do.
  const [renderMode, setRenderMode] = useState<RenderMode>('pictures');
  const [comfy, setComfy] = useState<ComfyStatus | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editVersion = useRef(0);
  const episodeId = useRef<string | null>(null);

  const series = seriesList.find((s) => s.id === (episode?.seriesId || seriesId)) || null;
  const urdu = series?.language === 'ur';
  const fail = (e: unknown) => setError(e instanceof Error ? e.message : String(e));

  const refreshEpisodes = useCallback(() => {
    api<{ episodes: EpisodeSummary[] }>('/api/cartoon/episodes').then((d) => setEpisodes(d.episodes)).catch(fail);
  }, []);

  // First load: series (presets are created on first use) and saved episodes.
  useEffect(() => {
    const t = window.setTimeout(() => {
      api<{ series: CartoonSeries[] }>('/api/cartoon/series')
        .then((d) => {
          setSeriesList(d.series);
          const wanted = new URLSearchParams(window.location.search).get('series');
          setSeriesId((prev) => (wanted && d.series.some((s) => s.id === wanted) ? wanted : prev || d.series[0]?.id || ''));
        })
        .catch(fail);
      refreshEpisodes();
      // Opened from a series page: /cartoon/studio?series=x&episode=y opens that episode straight away.
      const wantedEpisode = new URLSearchParams(window.location.search).get('episode');
      if (wantedEpisode) {
        api<{ episode: CartoonEpisode; status: EpisodeStatus }>(`/api/cartoon/episodes/${encodeURIComponent(wantedEpisode)}`)
          .then((d) => {
            setEpisode(d.episode);
            setSavedIds(new Set(d.episode.shots.map((s) => s.id)));
            setStatus(d.status);
            setSeriesId(d.episode.seriesId);
          })
          .catch(fail);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [refreshEpisodes]);

  useEffect(() => {
    episodeId.current = episode?.id || null;
  }, [episode?.id]);

  // Autosave edits 0.7 s after the last change. Recordings and pictures are saved by their own uploads.
  useEffect(() => {
    if (!dirty || !episode) return;
    const version = editVersion.current;
    const t = window.setTimeout(() => {
      setSaving(true);
      api<{ episode: CartoonEpisode }>(`/api/cartoon/episodes/${episode.id}`, jsonBody('PUT', { episode }))
        .then((d) => {
          setSavedIds(new Set(d.episode.shots.map((s) => s.id)));
          if (editVersion.current === version) setDirty(false);
        })
        .catch(fail)
        .finally(() => setSaving(false));
    }, 700);
    return () => window.clearTimeout(t);
  }, [episode, dirty]);

  // Poll the render status every 2 s while a render runs.
  const isRunning = running(status);
  useEffect(() => {
    if (!episode || !isRunning) return;
    const id = episode.id;
    const t = window.setInterval(() => {
      api<{ status: EpisodeStatus }>(`/api/cartoon/episodes/${id}`)
        .then((d) => {
          setStatus(d.status);
          if (!running(d.status)) refreshEpisodes();
        })
        .catch(fail);
    }, 2000);
    return () => window.clearInterval(t);
  }, [episode, isRunning, refreshEpisodes]);

  function edit(fn: (e: CartoonEpisode) => CartoonEpisode) {
    editVersion.current += 1;
    setEpisode((e) => (e ? fn(e) : e));
    setDirty(true);
  }
  const editShot = (i: number, patch: Partial<CartoonShot>) => edit((e) => ({ ...e, shots: e.shots.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  /** Applies a server-side change (recording, picture) to one shot without touching the owner's unsaved text. */
  const mergeShot = (shotId: string, from: CartoonEpisode) =>
    setEpisode((e) =>
      e
        ? {
            ...e,
            shots: e.shots.map((s) => {
              if (s.id !== shotId) return s;
              const server = from.shots.find((x) => x.id === shotId);
              return { ...s, recording: server?.recording, keyframe: server?.keyframe };
            }),
          }
        : e,
    );

  function openLoaded(d: { episode: CartoonEpisode; status: EpisodeStatus }) {
    setEpisode(d.episode);
    setSavedIds(new Set(d.episode.shots.map((s) => s.id)));
    setStatus(d.status);
    setSeriesId(d.episode.seriesId);
    setDirty(false);
    setEditingSeries(false);
    setVoiceMode(null);
    setAiChoice(null);
    setAiModel(null);
  }

  async function openEpisode(id: string) {
    try {
      openLoaded(await api<{ episode: CartoonEpisode; status: EpisodeStatus }>(`/api/cartoon/episodes/${id}`));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      fail(e);
    }
  }

  async function create(draft: unknown) {
    const { episode: created } = await api<{ episode: CartoonEpisode }>('/api/cartoon/episodes', jsonBody('POST', { seriesId, episode: draft }));
    openLoaded({ episode: created, status: { stage: 'idle', progress: 0 } });
    refreshEpisodes();
  }

  async function writeEpisode() {
    setError(null);
    setWriting(true);
    try {
      const { episode: draft } = await api<{ episode: CartoonEpisode }>('/api/cartoon/script', jsonBody('POST', { seriesId, topic, model }));
      await create(draft);
    } catch (e) {
      fail(e);
    } finally {
      setWriting(false);
    }
  }

  async function blankEpisode() {
    setError(null);
    try {
      await create({ title: topic.trim() || 'New episode', endHook: '', shots: [{ narration: '', scene: 'Scene 1', action: '', camera: 'static', characters: [] }] });
    } catch (e) {
      fail(e);
    }
  }

  async function deleteEpisode(id: string) {
    if (!window.confirm('Delete this episode, its recordings and its video? This cannot be undone.')) return;
    try {
      await api(`/api/cartoon/episodes/${id}`, { method: 'DELETE' });
      if (episode?.id === id) setEpisode(null);
      refreshEpisodes();
    } catch (e) {
      fail(e);
    }
  }

  const onRecorded = useCallback(
    (shotId: string, blob: Blob) => {
      const id = episodeId.current;
      if (!id) return;
      setBusy((b) => ({ ...b, [shotId]: 'voice' }));
      api<{ episode: CartoonEpisode }>(`/api/cartoon/episodes/${id}/record?shot=${shotId}`, {
        method: 'POST',
        headers: { 'content-type': blob.type || 'audio/webm' },
        body: blob,
      })
        .then((d) => {
          mergeShot(shotId, d.episode);
          refreshEpisodes();
        })
        .catch(fail)
        .finally(() => setBusy((b) => omit(b, shotId)));
    },
    [refreshEpisodes],
  );
  const recorder = useRecorder(onRecorded);

  const mode: VoiceMode = voiceMode ?? (series?.voice.provider === 'recorded' ? 'own' : 'ai');
  const choice = aiChoice ?? (series ? defaultVoiceChoice(series) : '');
  const aiModelValue = aiModel ?? series?.voice.elevenModel ?? 'eleven_v4';

  /** Makes (or remakes) one line with the AI voice chosen in Step 1. */
  async function makeLine(shotId: string) {
    if (!episode) return;
    const [kind, voiceId] = choice.split(':');
    setBusy((b) => ({ ...b, [shotId]: 'voice' }));
    try {
      const d = await api<{ episode: CartoonEpisode }>(
        `/api/cartoon/episodes/${episode.id}/voice?shot=${shotId}`,
        jsonBody('POST', { provider: kind === 'eleven' ? 'elevenlabs' : 'edge', voiceId, model: aiModelValue }),
      );
      mergeShot(shotId, d.episode);
      refreshEpisodes();
    } catch (e) {
      fail(e);
    } finally {
      setBusy((b) => omit(b, shotId));
    }
  }

  async function deleteRecording(shotId: string) {
    if (!episode) return;
    try {
      mergeShot(shotId, (await api<{ episode: CartoonEpisode }>(`/api/cartoon/episodes/${episode.id}/record?shot=${shotId}`, { method: 'DELETE' })).episode);
      refreshEpisodes();
    } catch (e) {
      fail(e);
    }
  }

  async function uploadPicture(shotId: string, file: File) {
    if (!episode) return;
    setBusy((b) => ({ ...b, [shotId]: 'picture' }));
    try {
      const d = await api<{ episode: CartoonEpisode }>(`/api/cartoon/episodes/${episode.id}/keyframe?shot=${shotId}`, {
        method: 'POST',
        headers: { 'content-type': file.type },
        body: file,
      });
      mergeShot(shotId, d.episode);
      setBust((b) => ({ ...b, [shotId]: Date.now() }));
    } catch (e) {
      fail(e);
    } finally {
      setBusy((b) => omit(b, shotId));
    }
  }

  async function removePicture(shotId: string) {
    if (!episode) return;
    try {
      mergeShot(shotId, (await api<{ episode: CartoonEpisode }>(`/api/cartoon/episodes/${episode.id}/keyframe?shot=${shotId}`, { method: 'DELETE' })).episode);
    } catch (e) {
      fail(e);
    }
  }

  async function render() {
    if (!episode) return;
    setError(null);
    setStarting(true);
    try {
      await api(`/api/cartoon/episodes/${episode.id}/render`, jsonBody('POST', { allowAiVoice: allowAi, mode: renderMode }));
      setStatus({ stage: 'queued', progress: 0 });
      refreshEpisodes();
    } catch (e) {
      fail(e);
    } finally {
      setStarting(false);
    }
  }

  const pictureUrl = useCallback(
    (shot: CartoonShot) => {
      if (!episode || !series) return undefined;
      if (shot.keyframe) return `episodes/${episode.id}/keyframes/${shot.keyframe}?v=${bust[shot.id] || 0}`;
      for (const cid of shot.characters) {
        const c = series.characters.find((x) => x.id === cid);
        if (c?.reference) return `series/${series.id}/refs/${c.reference}`;
      }
      return undefined;
    },
    [episode, series, bust],
  );

  const preview: EpisodeRenderProps | null = useMemo(() => {
    if (!episode || !series) return null;
    return {
      assetBase: FILES,
      series: { name: series.name, language: series.language, palette: series.palette, format: series.format },
      episode: {
        ...episode,
        shots: episode.shots.map((s) => ({
          ...s,
          audio: s.recording ? `episodes/${episode.id}/recordings/${s.recording.file}?v=${encodeURIComponent(s.recording.at)}` : undefined,
          image: pictureUrl(s),
        })),
      },
    };
  }, [episode, series, pictureUrl]);

  const seriesEpisodes = episodes
    .filter((e) => e.seriesId === series?.id)
    .sort((a, b) => (a.number ?? 1e6) - (b.number ?? 1e6) || b.createdAt.localeCompare(a.createdAt));
  const counts = {
    done: seriesEpisodes.filter((e) => e.status.stage === 'done').length,
    recording: seriesEpisodes.filter((e) => e.status.stage !== 'done' && e.recorded > 0).length,
    toRecord: seriesEpisodes.filter((e) => e.status.stage !== 'done' && e.recorded === 0).length,
  };
  const recorded = episode?.shots.filter((s) => s.recording).length || 0;
  const total = episode ? episodeFrames(episode) / FPS : 0;
  const needsVoice = episode && !isTransition(series) ? episode.shots.filter((s) => s.narration.trim() && !s.recording).length : 0;
  const pct = Math.round((status?.progress || 0) * 100);
  const shownError = error || recorder.error;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Animated cartoon · Phase 1 (pictures)"
        title="Cartoon Studio"
        description="Pick a series, let AI write the episode, record every line in your own voice, then render. On this PC each shot is a picture with a camera move; on the GPU PC the same shots become animated clips."
      />

      {shownError && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <XCircle size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{shownError}</span>
          <button
            className="text-xs font-semibold text-rose-100 underline"
            onClick={() => {
              setError(null);
              recorder.clearError();
            }}
          >
            Close
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 space-y-6">
          {/* Series */}
          <section className={card}>
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[200px] flex-1">
                <span className={label}>Series</span>
                <select
                  className={field}
                  value={series?.id || ''}
                  disabled={Boolean(episode)}
                  onChange={(e) => {
                    setSeriesId(e.target.value);
                    window.history.replaceState(null, '', `/cartoon/studio?series=${e.target.value}`);
                    setEditingSeries(false);
                  }}
                >
                  {seriesList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} · {s.language === 'ur' ? 'Urdu' : 'English'} · {s.audience === 'kids' ? 'kids' : 'everyone'}
                    </option>
                  ))}
                </select>
              </label>
              <button className={ghostBtn} onClick={() => setEditingSeries((v) => !v)} disabled={!series}>
                <Pencil size={14} /> {editingSeries ? 'Close editor' : 'Edit series'}
              </button>
              <button
                className={ghostBtn}
                onClick={() => {
                  const fresh: CartoonSeries = {
                    ...(series || seriesList[0]),
                    id: '',
                    name: 'My new series',
                    characters: [],
                    rules: [],
                  };
                  api<{ series: CartoonSeries }>('/api/cartoon/series', jsonBody('POST', { series: fresh }))
                    .then((d) => {
                      setSeriesList((l) => [...l, d.series]);
                      setSeriesId(d.series.id);
                      setEpisode(null);
                      setEditingSeries(true);
                    })
                    .catch(fail);
                }}
              >
                <Plus size={14} /> New series
              </button>
            </div>
            {episode && <p className="mt-2 text-xs text-slate-500">Close the episode to switch series.</p>}
            {series && !editingSeries && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {series.characters.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 py-1 pe-3 ps-1 text-xs text-slate-300">
                    {c.reference ? (
                      // eslint-disable-next-line @next/next/no-img-element -- local reference picture
                      <img src={`${FILES}/series/${series.id}/refs/${c.reference}`} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[10px]">{c.name.charAt(0)}</span>
                    )}
                    {c.name}
                  </span>
                ))}
                <span className="text-xs text-slate-500">
                  {series.voice.provider === 'recorded' ? '🎙 Your own voice' : 'AI voice'} · {series.episodeSeconds}s episodes
                </span>
              </div>
            )}
            {series && editingSeries && (
              <SeriesEditor
                key={series.id}
                series={series}
                onError={setError}
                onSaved={(s) => setSeriesList((l) => l.map((x) => (x.id === s.id ? s : x)))}
              />
            )}
          </section>

          {/* Write */}
          {!episode && (
            <section className={`${card} bg-gradient-to-br from-amber-500/[0.08] to-transparent`}>
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
                <Wand2 size={18} className="text-amber-300" /> New episode
              </h2>
              <p className="mt-1 text-sm text-slate-400">One line about the story. AI writes the shots and the lines you will record.</p>
              <textarea
                dir="auto"
                className={`${field} mt-4 min-h-[84px] resize-y`}
                placeholder={urdu ? 'e.g. Ahmed ko bazaar mein ek gumshuda batwa milta hai' : 'e.g. Mimi learns to share her umbrella on a rainy day'}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
              />
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="min-w-[180px] flex-1">
                  <span className={label}>Model</span>
                  <select className={field} value={model} onChange={(e) => setModel(e.target.value)}>
                    {SCRIPT_MODEL_INFO.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}: {fmtCost(scriptEstimate(m.id, 1).cost)} per episode
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={writeEpisode}
                  disabled={writing || !topic.trim() || !series}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-40 sm:flex-none"
                >
                  {writing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                  {writing ? 'Writing…' : 'Write episode'}
                </button>
                <button className={ghostBtn} onClick={blankEpisode} disabled={!series}>
                  <FilePlus2 size={14} /> Start blank
                </button>
              </div>
            </section>
          )}

          {/* Episode */}
          {episode && series && (
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-lg font-bold text-white">Episode</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">{saving ? 'Saving…' : dirty ? 'Unsaved' : 'Saved'}</span>
                  <button className={ghostBtn} onClick={() => setEpisode(null)}>
                    Close
                  </button>
                </div>
              </div>
              {isTransition(series) ? (
                <p className="mt-4 rounded-2xl border border-[var(--accent)]/30 bg-[var(--accent)]/[0.05] p-4 text-sm text-slate-300">
                  <b className="text-white">Transition reel · no voice.</b> Each picture shows for {TRANSITION_SECONDS} s with a flash cut and its label. After
                  uploading, add a trending sound in the Instagram or YouTube app: that is what makes transition reels travel.
                </p>
              ) : (
              <div className="mt-4">
                <VoiceStep
                  episode={episode}
                  series={series}
                  mode={mode}
                  onMode={setVoiceMode}
                  disabled={dirty || saving || isRunning || !episode.shots.every((s) => savedIds.has(s.id))}
                  choice={choice}
                  model={aiModelValue}
                  onChoice={setAiChoice}
                  onModel={setAiModel}
                  onLineDone={(shotId, updated) => {
                    mergeShot(shotId, updated);
                    refreshEpisodes();
                  }}
                  onError={setError}
                />
              </div>
              )}
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-white">Title and last card</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className={label}>Title</span>
                  <input dir="auto" className={field} value={episode.title} onChange={(e) => edit((x) => ({ ...x, title: e.target.value }))} />
                </label>
                <label className="block sm:col-span-2">
                  <span className={label}>Last card (teases the next episode)</span>
                  <input dir="auto" className={field} value={episode.endHook} onChange={(e) => edit((x) => ({ ...x, endHook: e.target.value }))} />
                </label>
              </div>
              </details>

              <div className="mt-4">
                <ModeStep
                  episode={episode}
                  mode={renderMode}
                  onMode={setRenderMode}
                  onStatus={setComfy}
                  hasPicture={(shotId) => {
                    const s = episode.shots.find((x) => x.id === shotId);
                    return Boolean(s && pictureUrl(s));
                  }}
                  onToggleAnimate={(shotId) => {
                    const keys = new Set(keyShotIds(episode));
                    const ticked = episode.shots.some((s) => s.animate);
                    edit((x) => ({
                      ...x,
                      shots: x.shots.map((s) => {
                        // The first tap turns the default picks into real ticks, then toggles the tapped line.
                        const on = ticked ? Boolean(s.animate) : keys.has(s.id);
                        return { ...s, animate: s.id === shotId ? !on : on };
                      }),
                    }));
                  }}
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  Lines with voice: {recorded}/{episode.shots.length}
                  <span className="ms-2 text-xs font-normal text-slate-500">{fmtSeconds(total)} total</span>
                </p>
                {mode === 'own' && (
                <details className="text-xs text-slate-400">
                  <summary className="inline-flex cursor-pointer items-center gap-1 hover:text-white">
                    <Info size={13} /> Recording tips
                  </summary>
                  <ul className="mt-2 max-w-md list-disc space-y-1 ps-5">
                    <li>Quiet room, no fan. Soft things around you (bed, curtains) remove echo.</li>
                    <li>Headset or phone-style mic about one hand away from your mouth.</li>
                    <li>Press Record, wait half a second, then speak like you are telling a child a story. Smile while you talk.</li>
                    <li>Not happy? Press Record again. The app removes noise, evens the volume and cuts the silence.</li>
                  </ul>
                </details>
                )}
              </div>

              <ol className="mt-3 space-y-3">
                {episode.shots.map((shot, i) => {
                  const pic = pictureUrl(shot);
                  return (
                    <ShotCard
                      key={shot.id}
                      shot={shot}
                      index={i}
                      total={episode.shots.length}
                      series={series}
                      urdu={urdu}
                      canRecord={savedIds.has(shot.id) && !isRunning}
                      recording={recorder.activeKey === shot.id}
                      recSeconds={recorder.seconds}
                      busy={busy[shot.id] || null}
                      audioUrl={shot.recording ? `${FILES}/episodes/${episode.id}/recordings/${shot.recording.file}?v=${encodeURIComponent(shot.recording.at)}` : undefined}
                      pictureUrl={pic ? `${FILES}/${pic}` : undefined}
                      onChange={(patch) => editShot(i, patch)}
                      onMove={(dir) =>
                        edit((x) => {
                          const shots = [...x.shots];
                          const j = i + dir;
                          [shots[i], shots[j]] = [shots[j], shots[i]];
                          return { ...x, shots };
                        })
                      }
                      onDelete={() => {
                        if (shot.recording && !window.confirm('Delete this shot and its recording?')) return;
                        edit((x) => ({ ...x, shots: x.shots.filter((s) => s.id !== shot.id) }));
                      }}
                      onRecord={() => recorder.start(shot.id)}
                      onStop={recorder.stop}
                      onDeleteRecording={() => deleteRecording(shot.id)}
                      onPicture={(f) => uploadPicture(shot.id, f)}
                      onRemovePicture={() => removePicture(shot.id)}
                      mode={mode}
                      onRegenerate={() => makeLine(shot.id)}
                      onUploadAudio={(f) => onRecorded(shot.id, f)}
                    />
                  );
                })}
              </ol>
              <button
                onClick={() => edit((x) => ({ ...x, shots: [...x.shots, { id: newShotId(), narration: '', characters: [], scene: 'New scene', action: '', camera: 'static' }] }))}
                disabled={episode.shots.length >= 20}
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm font-semibold text-slate-400 transition hover:border-white/30 hover:text-white disabled:opacity-40"
              >
                <Plus size={15} /> Add a shot
              </button>
            </section>
          )}
        </div>

        {/* Preview + render */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className={`${card} p-4`}>
            {preview ? (
              <>
                <div className="mx-auto max-w-[340px]">
                  <EpisodePlayer {...preview} />
                </div>
                <p className="mt-3 text-center text-xs text-slate-500">The preview plays every line that has a voice. Lines without a voice are silent.</p>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Length', fmtSeconds(total)],
                    ['Shots', String(episode?.shots.length || 0)],
                    ['Voice', `${recorded}/${episode?.shots.length || 0}`],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-black/25 px-2 py-2">
                      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
                      <dd className="text-sm font-semibold text-white">{v}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--accent)]">Step 3 · Make the video</p>
                <p className="mt-1 text-xs text-slate-400">Joins the voice, pictures and captions into one MP4 file, ready for YouTube.</p>
                {needsVoice > 0 && mode === 'own' && (
                  <label className="mt-3 flex items-start gap-2 text-xs text-slate-400">
                    <input type="checkbox" className="mt-0.5 h-4 w-4" checked={allowAi} onChange={(e) => setAllowAi(e.target.checked)} />
                    Use the AI voice for the {needsVoice} line(s) I did not record
                  </label>
                )}
                <button
                  onClick={render}
                  disabled={
                    starting ||
                    isRunning ||
                    dirty ||
                    saving ||
                    recorder.activeKey !== null ||
                    (needsVoice > 0 && !(mode === 'own' && allowAi)) ||
                    (renderMode !== 'pictures' && !(comfy && (comfy.reachable || comfy.canAutoStart)))
                  }
                  className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-4 text-sm font-bold text-slate-950 shadow-[0_10px_40px_-10px_var(--accent)] transition hover:brightness-110 disabled:opacity-40"
                >
                  {starting || isRunning ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
                  {isRunning ? 'Making the video…' : 'Make the video (MP4)'}
                </button>
                {needsVoice > 0 && !(mode === 'own' && allowAi) && (
                  <p className="mt-2 text-center text-[11px] text-amber-300">Finish Step 1 first: {needsVoice} line(s) have no voice yet.</p>
                )}
                {status && status.stage !== 'idle' && (
                  <div className="mt-4 rounded-2xl bg-black/25 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className={status.stage === 'failed' ? 'text-rose-300' : 'text-slate-300'}>{STAGE_LABEL[status.stage] || status.stage}</span>
                      {isRunning && <span className="text-slate-400">{pct}%</span>}
                    </div>
                    {isRunning && (
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full bg-[var(--accent)] transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                    {status.stage === 'failed' && status.error && <p className="mt-2 text-xs text-rose-200">{status.error}</p>}
                    {status.stage === 'done' && episode && (
                      <>
                        <video
                          className="mt-3 w-full rounded-xl"
                          controls
                          preload="metadata"
                          src={`${FILES}/episodes/${episode.id}/video.mp4?v=${encodeURIComponent(status.finishedAt || '')}`}
                        />
                        <a
                          href={`${FILES}/episodes/${episode.id}/video.mp4?download=1`}
                          className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-white text-sm font-bold text-slate-950"
                        >
                          <Download size={15} /> Download MP4
                        </a>
                        <YoutubeUpload episode={episode} videoVersion={status.finishedAt || ''} />
                      </>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="px-2 py-10 text-center text-sm text-slate-500">Write or open an episode to see the preview here.</p>
            )}
          </div>
        </aside>
      </div>

      {/* Episodes of this series */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-white">Episodes of {series?.name || 'this series'}</h2>
            <p className="mt-1 text-xs text-slate-400">
              ✅ {counts.done} video ready · 🎙 {counts.recording} recording · 📝 {counts.toRecord} to record
            </p>
          </div>
          <div className="flex gap-2">
            <Link href={series ? `/cartoon/${series.id}` : '/cartoon'} className={ghostBtn}>
              All series
            </Link>
            <button onClick={refreshEpisodes} className={ghostBtn}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>
        </div>
        {seriesEpisodes.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-500">
            No episodes in this series yet. Write one above.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07]">
            {seriesEpisodes.map((ep) => {
              const st = episodeState(ep);
              return (
                <li key={ep.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${episode?.id === ep.id ? 'bg-[var(--accent)]/10' : 'bg-black/20'}`}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-xs font-bold text-slate-300">{ep.number ?? '•'}</span>
                  <div className="min-w-0 flex-1">
                    <p dir="auto" className="truncate text-sm font-semibold text-white">
                      {ep.title}
                    </p>
                    <p className={`mt-0.5 text-xs ${st.tone}`}>{st.label}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className={ghostBtn} onClick={() => openEpisode(ep.id)}>
                      <FolderOpen size={14} /> {st.action}
                    </button>
                    <button className={`${ghostBtn} hover:text-rose-300`} onClick={() => deleteEpisode(ep.id)} aria-label="Delete episode">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Plain status of one episode for the list: what is done and what to do next. */
function episodeState(ep: EpisodeSummary) {
  if (running(ep.status)) return { label: `⏳ Rendering ${Math.round(ep.status.progress * 100)}%`, tone: 'text-sky-300', action: 'Open' };
  if (ep.status.stage === 'done') return { label: `✅ Video ready · ${ep.recorded}/${ep.shots} lines in your voice`, tone: 'text-emerald-300', action: 'Open' };
  if (ep.status.stage === 'failed') return { label: '⚠️ Render failed, open to see why', tone: 'text-rose-300', action: 'Open' };
  if (ep.shots > 0 && ep.recorded === ep.shots) return { label: '🎙 All lines recorded · render next', tone: 'text-amber-300', action: 'Render' };
  if (ep.recorded > 0) return { label: `🎙 ${ep.recorded}/${ep.shots} lines recorded`, tone: 'text-amber-200', action: 'Record' };
  return { label: `📝 Script ready · ${ep.shots} lines to record`, tone: 'text-slate-400', action: 'Record' };
}
