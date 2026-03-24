"use client";

import { useState, useEffect } from 'react';
import { Play, Plus, RefreshCw, Download, UploadCloud } from 'lucide-react';

export default function Dashboard() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkCount, setBulkCount] = useState(1);
  const [topic, setTopic] = useState('');

  const fetchVideos = async () => {
    const res = await fetch('/api/videos');
    const data = await res.json();
    setVideos(data);
  };

  useEffect(() => {
    fetchVideos();
    const int = setInterval(fetchVideos, 5000);
    return () => clearInterval(int);
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    await fetch('/api/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });
    setTopic('');
    await fetchVideos();
    setLoading(false);
  };


  const handleBulkGenerate = async () => {
    setLoading(true);
    await fetch('/api/bulk-generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: bulkCount })
    });
    await fetchVideos();
    setLoading(false);
  };
  
  const handleUpload = async (videoId: string) => {
    await fetch('/api/upload-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId })
    });
    await fetchVideos();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-8">
        Studio Dashboard
      </h1>

      {/* Control Panel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-slate-200">Single Generation</h2>
          <p className="text-slate-400 text-sm">Provide a specific script or topic, or leave blank for a random one.</p>
          <textarea 
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={'e.g.,\n🎬 Outline 1 — “The Country That Existed for 3 Days”\n0:00–0:05 — Hook...'}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow min-h-[100px] resize-y text-sm font-mono placeholder-slate-600"
          />
          <button 
            onClick={handleGenerate} 
            disabled={loading}
            className="mt-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 px-4 rounded-xl font-medium transition-all disabled:opacity-50"
          >
            {loading ? <RefreshCw className="animate-spin" /> : <Play />}
            Generate Single Video
          </button>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-slate-200">Bulk Generation</h2>
          <p className="text-slate-400 text-sm">Generate multiple videos to fill up your queue.</p>
          <div className="flex gap-4 mt-auto">
            <input 
              type="number" 
              min="1" max="10" 
              value={bulkCount}
              onChange={(e) => setBulkCount(Number(e.target.value))}
              className="bg-slate-800 border-none text-white px-4 py-3 rounded-xl w-24 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button 
              onClick={handleBulkGenerate} 
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white py-3 px-4 rounded-xl font-medium transition-all disabled:opacity-50"
            >
              {loading ? <RefreshCw className="animate-spin" /> : <Plus />}
              Bulk Generate
            </button>
          </div>
        </div>
      </div>

      {/* Video Grid */}
      <h2 className="text-xl font-semibold text-slate-200 mb-4">Recent Videos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video: any) => (
          <div key={video._id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl group">
            <div className="aspect-[9/16] bg-slate-800 relative">
              {video.thumbnail ? (
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  {video.status === 'generating' ? <RefreshCw className="animate-spin" size={32} /> : 'No Thumbnail'}
                </div>
              )}
              {/* Play Overlay */}
              {video.videoPath && (
                 <a href={video.videoPath} target="_blank" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <Play size={48} className="text-white drop-shadow-lg" />
                 </a>
              )}
            </div>
            <div className="p-4">
              <h3 className="font-semibold text-slate-200 truncate">{video.title || 'Generating...'}</h3>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  video.status === 'generated' ? 'bg-emerald-500/10 text-emerald-400' :
                  video.status === 'generating' ? 'bg-blue-500/10 text-blue-400' :
                  video.status === 'scheduled' ? 'bg-purple-500/10 text-purple-400' :
                  video.status === 'uploaded' ? 'bg-green-500/10 text-green-400' :
                  'bg-red-500/10 text-red-400'
                }`}>
                  {video.status.toUpperCase()}
                </span>
                
                {/* Actions */}
                <div className="flex gap-2">
                    {video.videoPath && (
                        <a href={video.videoPath} download className="p-2 text-slate-400 hover:text-white bg-slate-800 rounded-lg transition-colors">
                            <Download size={16} />
                        </a>
                    )}
                    {video.status === 'generated' && (
                        <button onClick={() => handleUpload(video._id)} className="p-2 text-slate-400 hover:text-[#FF0000] bg-slate-800 rounded-lg transition-colors" title="Upload to YouTube">
                            <UploadCloud size={16} />
                        </button>
                    )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {videos.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-500">
            No videos created yet. Click Generate to begin.
          </div>
        )}
      </div>
    </div>
  );
}
