'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, PlaySquare } from 'lucide-react';
import type { CartoonEpisode } from '@/lib/cartoon/spec';
import { api, field, jsonBody, label } from './ui';

type Upload = { id: string; url: string; privacy: string; at: string };

/** "Upload to YouTube" for a finished episode: title and description prefilled, private by default. */
export function YoutubeUpload({ episode, videoVersion }: { episode: CartoonEpisode; videoVersion: string }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [upload, setUpload] = useState<Upload | null>(null);
  const [title, setTitle] = useState(episode.title);
  const [description, setDescription] = useState(episode.description || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ connected: boolean }>('/api/youtube/status')
      .then((s) => setConnected(s.connected))
      .catch(() => setConnected(false));
    api<{ upload: Upload | null }>(`/api/cartoon/episodes/${episode.id}/youtube`)
      .then((d) => setUpload(d.upload))
      .catch(() => null);
  }, [episode.id, videoVersion]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const d = await api<{ upload: Upload }>(
        `/api/cartoon/episodes/${episode.id}/youtube`,
        jsonBody('POST', { title, description, tags: episode.tags || [], privacy: 'private' }),
      );
      setUpload(d.upload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (connected === null) return null;
  return (
    <div className="mt-3 rounded-xl border border-white/[0.07] bg-black/25 p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-white">
        <PlaySquare size={15} className="text-red-500" /> YouTube
      </p>
      {upload ? (
        <p className="mt-2 text-xs text-emerald-300">
          ✅ Uploaded ({upload.privacy}).{' '}
          <a href={upload.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
            Open <ExternalLink size={11} />
          </a>
        </p>
      ) : !connected ? (
        <p className="mt-2 text-xs text-slate-400">
          Not connected.{' '}
          <Link href="/connections" className="text-sky-300 underline">
            Connect YouTube
          </Link>{' '}
          once to upload with one click.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          <label className="block">
            <span className={label}>Title</span>
            <input dir="auto" className={field} value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span className={label}>Description</span>
            <textarea dir="auto" className={`${field} min-h-[64px]`} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <button
            onClick={send}
            disabled={busy || !title.trim()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-40"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <PlaySquare size={15} />} {busy ? 'Uploading…' : 'Upload to YouTube (private)'}
          </button>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>
      )}
    </div>
  );
}
