"use client";

import { useState, useEffect } from 'react';
import { Activity, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

type QueueJob = {
  _id: string;
  type: string;
  videoId?: {
    _id?: string;
  } | string;
  status: string;
  progress?: number;
  logs?: string[];
};

export default function QueuePage() {
  const [jobs, setJobs] = useState<QueueJob[]>([]);

  useEffect(() => {
    let active = true;

    const fetchJobs = async () => {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      if (active) {
        setJobs(Array.isArray(data) ? data : []);
      }
    };

    void fetchJobs();
    const int = setInterval(() => {
      void fetchJobs();
    }, 3000);

    return () => {
      active = false;
      clearInterval(int);
    };
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-8 flex items-center gap-3">
        <Activity className="text-emerald-400" />
        Processing Queue
      </h1>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-800/50 border-b border-slate-800 text-slate-400 text-sm">
              <th className="p-4 font-medium">Job Type</th>
              <th className="p-4 font-medium">Video ID</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium min-w-[200px]">Progress</th>
              <th className="p-4 font-medium">Logs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {jobs.map((job) => (
              <tr key={job._id} className="hover:bg-slate-800/20 transition-colors">
                <td className="p-4">
                  <span className="font-medium text-slate-200">{job.type}</span>
                </td>
                <td className="p-4 text-slate-400 text-sm font-mono truncate max-w-[120px]">
                  {job.videoId?._id || job.videoId}
                </td>
                <td className="p-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                    job.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' :
                    job.status === 'processing' ? 'bg-blue-500/10 text-blue-400' :
                    job.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                    'bg-slate-500/10 text-slate-400'
                  }`}>
                    {job.status === 'completed' && <CheckCircle2 size={12} />}
                    {job.status === 'processing' && <Loader2 size={12} className="animate-spin" />}
                    {job.status === 'failed' && <AlertCircle size={12} />}
                    {job.status.toUpperCase()}
                  </span>
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-full bg-slate-800 rounded-full h-2">
                        <div 
                        className={`h-full rounded-full ${job.status === 'failed' ? 'bg-red-500' : job.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                        style={{ width: `${job.progress}%` }} 
                        />
                    </div>
                    <span className="text-xs text-slate-400 min-w-[3ch]">{job.progress}%</span>
                  </div>
                </td>
                <td className="p-4 text-xs font-mono text-slate-500 truncate max-w-[250px]">
                  {job.logs?.[job.logs.length - 1] || 'Started...'}
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-500">No jobs in queue.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
