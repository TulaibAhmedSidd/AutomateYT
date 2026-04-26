import mongoose from 'mongoose';
import { DEFAULT_MODEL_SELECTIONS } from '@/lib/generation-config';
import { createProjectManifest } from '@/lib/video-project';

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
  storageMode: { type: String, enum: ['local', 'cloud'], default: 'local' },
  projectManifest: {
    type: mongoose.Schema.Types.Mixed,
    default: () => createProjectManifest({ scenes: [] }),
  },
  mediaRefs: {
    audio: {
      fileId: String,
      filename: String,
      contentType: String,
      url: String,
    },
    video: {
      fileId: String,
      filename: String,
      contentType: String,
      url: String,
    },
    thumbnail: {
      fileId: String,
      filename: String,
      contentType: String,
      url: String,
    },
    images: [{
      fileId: String,
      filename: String,
      contentType: String,
      url: String,
    }],
  },
  thumbnail: String,
  videoPath: String,
  status: {
    type: String,
    enum: ['draft', 'generating', 'generated', 'uploaded', 'scheduled', 'failed'],
    default: 'draft'
  },
  scriptStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  voiceStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  imageStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  videoRenderStatus: { type: String, enum: ['pending', 'done', 'failed'], default: 'pending' },
  uploadStatus: {
    type: String,
    enum: ['not_uploaded', 'uploading', 'uploaded', 'failed'],
    default: 'not_uploaded'
  },
  uploadError: String,
  failedStep: String,
  failedTool: String,
  errorSummary: String,
  errorDetails: String,
  youtubeId: String,
  createdAt: { type: Date, default: Date.now }
});

export const Video = mongoose.models.Video || mongoose.model('Video', videoSchema);
