'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Wand2 } from 'lucide-react';

type StudioVideo = {
  _id: string;
  title?: string;
  status: string;
  projectManifest?: {
    creationMode?: string;
    scriptSegments?: Array<{ status?: string }>;
  };
};

export default function StudioLandingPage() {
  const [videos, setVideos] = useState<StudioVideo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch('/api/videos')
      .then((res) => res.json())
      .then((data) => setVideos(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-[30px] border border-slate-800 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.14),_transparent_28%),linear-gradient(180deg,_#0f172a,_#020617)] p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/80">Studio</p>
        <h1 className="mt-3 text-3xl font-black text-white md:text-4xl">Pick a project to continue editing</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          The Studio is where you manage scene assets, decide which missing parts should use AI, and prepare final renders without wasting generation cost.
        </p>
      </section>

      {loading ? (
        <div className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-10 text-center text-slate-300">
          <Loader2 className="mx-auto animate-spin" size={28} />
        </div>
      ) : videos.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
          <Wand2 className="mx-auto text-slate-600" size={40} />
          <p className="mt-4 text-lg font-semibold text-slate-200">No projects yet</p>
          <p className="mt-2 text-sm text-slate-500">Create a new video from the dashboard to start using the studio.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {videos.map((video) => (
            <Link
              key={video._id}
              href={`/videos/${video._id}`}
              className="rounded-[28px] border border-slate-800 bg-slate-900/70 p-5 transition hover:border-cyan-400/40 hover:bg-slate-900"
            >
              <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                {video.projectManifest?.creationMode || 'hybrid'} workflow
              </p>
              <h2 className="mt-2 text-xl font-bold text-white">{video.title || 'Untitled project'}</h2>
              <p className="mt-3 text-sm text-slate-400">Status: {video.status}</p>
              <p className="mt-2 text-sm text-slate-400">
                Scenes: {video.projectManifest?.scriptSegments?.length || 0}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
