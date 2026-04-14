import mongoose from 'mongoose';
import { DEFAULT_MODEL_SELECTIONS } from '@/lib/generation-config';

const videoSchema = new mongoose.Schema({
  title: String,
  description: String,
  tags: [String],
  script: String,
  sourceContent: { type: String, default: '' },
  promptType: { type: String, default: 'idea' },
  modelSelections: {
    script: { type: String, default: DEFAULT_MODEL_SELECTIONS.script },
    voice: { type: String, default: DEFAULT_MODEL_SELECTIONS.voice },
    image: { type: String, default: DEFAULT_MODEL_SELECTIONS.image },
    video: { type: String, default: DEFAULT_MODEL_SELECTIONS.video },
  },
  thumbnail: String,
  videoPath: String,
  status: {
    type: String,
    enum: ['generating', 'generated', 'uploaded', 'scheduled', 'failed'],
    default: 'generating'
  },
  scriptStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  voiceStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  imageStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  videoRenderStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  failedStep: String,
  failedTool: String,
  errorSummary: String,
  errorDetails: String,
  youtubeId: String,
  createdAt: { type: Date, default: Date.now }
});

export const Video = mongoose.models.Video || mongoose.model('Video', videoSchema);
