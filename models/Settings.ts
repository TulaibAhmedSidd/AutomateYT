import mongoose from 'mongoose';
import { DEFAULT_MODEL_SELECTIONS } from '@/lib/generation-config';

const settingsSchema = new mongoose.Schema({
  apiKeys: {
    openai: { type: String, default: '' },
    gemini: { type: String, default: '' },
    elevenlabs: { type: String, default: '' },
    leonardo: { type: String, default: '' },
    youtubeClientId: { type: String, default: '' },
    youtubeClientSecret: { type: String, default: '' },
    youtubeRefreshToken: { type: String, default: '' },
  },
  generationDefaults: {
    script: { type: String, default: DEFAULT_MODEL_SELECTIONS.script },
    voice: { type: String, default: DEFAULT_MODEL_SELECTIONS.voice },
    image: { type: String, default: DEFAULT_MODEL_SELECTIONS.image },
    video: { type: String, default: DEFAULT_MODEL_SELECTIONS.video },
  },
  scheduleTimes: [{ type: String }], // Array of time strings like '14:00', '18:30'
  uploadEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
