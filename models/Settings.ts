import mongoose from 'mongoose';

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
  scheduleTimes: [{ type: String }], // Array of time strings like '14:00', '18:30'
  uploadEnabled: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Settings = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
