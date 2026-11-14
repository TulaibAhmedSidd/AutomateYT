'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ExternalLink, Camera, Link2, Loader2, Unplug, XCircle, PlaySquare } from 'lucide-react';
import { PageHeader } from '@/components/format-ui';
import { api, card, ghostBtn } from '@/components/cartoon/ui';

type YtStatus = { configured: boolean; connected: boolean; channelTitle: string | null; channelId: string | null; connectedAt: string | null; redirectUrl: string };

/** Connect social accounts once; then every finished video has an upload button. */
export default function ConnectionsPage() {
  const [yt, setYt] = useState<YtStatus | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<YtStatus>('/api/youtube/status')
      .then(setYt)
      .catch((e: unknown) => setMessage({ ok: false, text: e instanceof Error ? e.message : String(e) }));
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const q = new URLSearchParams(window.location.search);
      if (q.get('youtube') === 'connected') setMessage({ ok: true, text: 'YouTube connected.' });
      if (q.get('youtube_error')) setMessage({ ok: false, text: q.get('youtube_error') || 'YouTube connection failed.' });
      if (q.toString()) window.history.replaceState(null, '', '/connections');
      load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [load]);

  async function disconnect() {
    if (!window.confirm('Disconnect YouTube on this PC? Your channel and videos are not touched.')) return;
    setBusy(true);
    await api('/api/youtube/disconnect', { method: 'POST' }).catch(() => null);
    setBusy(false);
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="System" title="Connections" description="Connect your channels once. After that, every finished video gets an Upload button." />

      {message && (
        <div
          className={`flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
            message.ok ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/30 bg-rose-400/10 text-rose-200'
          }`}
        >
          {message.ok ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" /> : <XCircle size={16} className="mt-0.5 shrink-0" />} {message.text}
        </div>
      )}

      {/* YouTube */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <PlaySquare size={20} className="text-red-500" /> YouTube
          </h2>
          {yt?.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
              <CheckCircle2 size={13} /> Connected
            </span>
          ) : (
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-400">Not connected</span>
          )}
        </div>
        {!yt ? (
          <Loader2 className="mt-4 animate-spin text-slate-500" />
        ) : yt.connected ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-slate-300">
              Channel: <b className="text-white">{yt.channelTitle}</b>
              {yt.channelId && (
                <a className="ms-2 inline-flex items-center gap-1 text-xs text-sky-300 underline" href={`https://youtube.com/channel/${yt.channelId}`} target="_blank" rel="noreferrer">
                  open <ExternalLink size={11} />
                </a>
              )}
            </p>
            <p className="text-xs text-slate-500">
              Uploads go up as <b>private</b>. Check them in YouTube Studio, then make them public. (Google keeps uploads from new apps private until the app passes Google&apos;s check.)
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="/api/youtube/connect" className={ghostBtn}>
                <Link2 size={14} /> Connect a different channel
              </a>
              <button className={`${ghostBtn} hover:text-rose-300`} onClick={disconnect} disabled={busy}>
                <Unplug size={14} /> Disconnect
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {yt.configured ? (
              <a
                href="/api/youtube/connect"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-bold text-white transition hover:bg-red-500"
              >
                <PlaySquare size={18} /> Connect YouTube
              </a>
            ) : (
              <p className="text-sm text-amber-300">First add YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET to .env.local (see the steps below).</p>
            )}
            <details className="rounded-2xl bg-black/25 p-3 text-xs text-slate-400" open={!yt.configured}>
              <summary className="cursor-pointer font-semibold text-slate-200">One-time setup in Google Cloud (5 minutes)</summary>
              <ol className="mt-2 list-decimal space-y-1.5 ps-5">
                <li>console.cloud.google.com → your project → APIs &amp; Services → Library → enable <b>YouTube Data API v3</b>.</li>
                <li>OAuth consent screen → add your Gmail as a test user → then <b>Publish app</b> (In production), so the login does not expire after 7 days.</li>
                <li>
                  Credentials → your OAuth client (type <b>Web application</b>) → Authorised redirect URIs → add exactly:
                  <code className="mt-1 block select-all rounded bg-black/40 px-2 py-1 text-slate-200">{yt.redirectUrl}</code>
                </li>
                <li>Put the client ID and secret in .env.local as YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET, restart the app, then press Connect YouTube.</li>
              </ol>
            </details>
          </div>
        )}
      </section>

      {/* Instagram */}
      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-white">
            <Camera size={20} className="text-pink-400" /> Instagram Reels
          </h2>
          <span className="rounded-full bg-white/[0.06] px-3 py-1 text-xs text-slate-400">Next step</span>
        </div>
        <p className="mt-3 text-sm text-slate-300">
          Instagram can only post a video that is on the internet (it downloads it from a link), so it needs two free accounts first:
        </p>
        <ol className="mt-2 list-decimal space-y-1.5 ps-5 text-xs text-slate-400">
          <li>
            Switch your Instagram to a <b>Professional</b> account (Settings → Account type → Creator or Business).
          </li>
          <li>
            Make a free <b>Cloudinary</b> account (cloudinary.com) for the video link, and copy its cloud name, API key and secret.
          </li>
          <li>
            Make a free app on <b>developers.facebook.com</b> with “Instagram API with Instagram Login” and give it the content-publish permission.
          </li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">When you have these three, tell Claude and the Instagram Connect button will be added here, like YouTube.</p>
      </section>
    </div>
  );
}
