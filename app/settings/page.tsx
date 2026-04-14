"use client";

import { useEffect, useState } from 'react';
import { Save, KeyRound, SlidersHorizontal } from 'lucide-react';
import {
  DEFAULT_MODEL_SELECTIONS,
  IMAGE_MODEL_OPTIONS,
  SCRIPT_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
  VOICE_MODEL_OPTIONS,
  normalizeModelSelections,
  type StepModelSelections,
} from '@/lib/generation-config';

export default function SettingsPage() {
  const [keys, setKeys] = useState({
    openai: '',
    gemini: '',
    elevenlabs: '',
    leonardo: '',
    youtubeClientId: '',
    youtubeClientSecret: '',
    youtubeRefreshToken: ''
  });
  const [generationDefaults, setGenerationDefaults] = useState<StepModelSelections>(DEFAULT_MODEL_SELECTIONS);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((response) => response.json())
      .then((data) => {
        if (data?.apiKeys) {
          setKeys((prev) => ({ ...prev, ...data.apiKeys }));
        }
        setGenerationDefaults(normalizeModelSelections(data?.generationDefaults, DEFAULT_MODEL_SELECTIONS));
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setKeys((prev) => ({ ...prev, [name]: value }));
  };

  const handleDefaultChange = (key: keyof StepModelSelections, value: string) => {
    setGenerationDefaults((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKeys: keys,
        generationDefaults,
      })
    });
    setLoading(false);
    if (res.ok) {
      setMessage('Settings saved successfully!');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  return (
    <div className="max-w-4xl">
      <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent mb-8 flex items-center gap-3">
        <KeyRound className="text-amber-400" />
        API Configuration
      </h1>

      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl space-y-8">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">AI Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">OpenAI API Key</label>
              <input
                type="password"
                name="openai"
                value={keys.openai}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                placeholder="sk-..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">Gemini API Key</label>
              <input
                type="password"
                name="gemini"
                value={keys.gemini}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                placeholder="..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">ElevenLabs API Key</label>
              <input
                type="password"
                name="elevenlabs"
                value={keys.elevenlabs}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                placeholder="..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">Leonardo.ai API Key</label>
              <input
                type="password"
                name="leonardo"
                value={keys.leonardo}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                placeholder="..."
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2 flex items-center gap-2">
            <SlidersHorizontal className="text-cyan-400" size={18} />
            Default Models
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">Script Model</label>
              <select
                value={generationDefaults.script}
                onChange={(e) => handleDefaultChange('script', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                {SCRIPT_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">Voice Model</label>
              <select
                value={generationDefaults.voice}
                onChange={(e) => handleDefaultChange('voice', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                {VOICE_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">Image Model</label>
              <select
                value={generationDefaults.image}
                onChange={(e) => handleDefaultChange('image', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                {IMAGE_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">Video Render</label>
              <select
                value={generationDefaults.video}
                onChange={(e) => handleDefaultChange('video', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 outline-none focus:ring-2 focus:ring-cyan-500/20"
              >
                {VIDEO_MODEL_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Leonardo default uses a basic SDXL 1.0 profile with safe dimensions for the legacy generations endpoint.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-semibold text-slate-200 border-b border-slate-800 pb-2">YouTube Data API v3</h2>
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">Client ID</label>
              <input
                type="text"
                name="youtubeClientId"
                value={keys.youtubeClientId}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">Client Secret</label>
              <input
                type="password"
                name="youtubeClientSecret"
                value={keys.youtubeClientSecret}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400 block">Refresh Token</label>
              <input
                type="password"
                name="youtubeRefreshToken"
                value={keys.youtubeRefreshToken}
                onChange={handleChange}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
              />
            </div>
          </div>
        </div>

        <div className="pt-6 flex items-center justify-between border-t border-slate-800">
          <span className="text-emerald-400 text-sm font-medium">{message}</span>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white py-3 px-8 rounded-xl font-medium transition-all disabled:opacity-50 ml-auto"
          >
            {loading ? 'Saving...' : <Save />} Save Configuration
          </button>
        </div>
      </form>
    </div>
  );
}
