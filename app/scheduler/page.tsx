"use client";

import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, Trash2 } from 'lucide-react';

export default function SchedulerPage() {
  const [times, setTimes] = useState<string[]>([]);
  const [newTime, setNewTime] = useState('');
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setTimes(data.scheduleTimes || []);
          setEnabled(data.uploadEnabled || false);
        }
      });
  }, []);

  const handleToggle = async (val: boolean) => {
    setEnabled(val);
    await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadEnabled: val })
    });
  };

  const addTime = async () => {
    if (!newTime || times.includes(newTime)) return;
    
    const updated = [...times, newTime];
    setTimes(updated);
    setNewTime('');
    
    await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeStr: newTime })
    });
  };

  const removeTime = async (t: string) => {
    const updated = times.filter(x => x !== t);
    setTimes(updated);
    // Overriding all times requires a full settings post
    await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleTimes: updated })
    });
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-8 flex items-center gap-3">
        <CalendarIcon className="text-purple-400" />
        Upload Scheduler
      </h1>

      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-8">
        
        {/* Enable Toggle */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <h2 className="text-xl font-semibold text-slate-200">Auto-Upload</h2>
            <p className="text-sm text-slate-400 mt-1">Automatically upload generated videos at scheduled times.</p>
          </div>
          <button 
            onClick={() => handleToggle(!enabled)}
            className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-7' : 'translate-x-1'}`} />
          </button>
        </div>

        {/* Times List */}
        <div>
          <h2 className="text-xl font-semibold text-slate-200 mb-4">Daily Schedule Times</h2>
          <div className="space-y-3">
            {times.map((t, idx) => (
              <div key={idx} className="flex items-center justify-between bg-slate-950 border border-slate-800 p-4 rounded-xl">
                 <div className="flex items-center gap-3 text-slate-200 font-mono text-lg">
                    <Clock className="text-blue-400" size={20} /> {t}
                 </div>
                 <button onClick={() => removeTime(t)} className="text-slate-500 hover:text-red-400 transition-colors p-2">
                    <Trash2 size={20} />
                 </button>
              </div>
            ))}
            {times.length === 0 && (
                <div className="text-slate-500 py-4">No times scheduled. Add one below.</div>
            )}
          </div>
        </div>

        {/* Add new time */}
        <div className="flex gap-4 pt-4 border-t border-slate-800">
          <input 
            type="time" 
            value={newTime}
            onChange={e => setNewTime(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow font-mono text-lg"
          />
          <button 
            onClick={addTime}
            className="bg-purple-600 hover:bg-purple-500 text-white font-medium px-6 py-3 rounded-xl transition-colors"
          >
            Add Time
          </button>
        </div>

      </div>
    </div>
  );
}
