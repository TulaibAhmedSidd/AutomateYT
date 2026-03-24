import mongoose from 'mongoose';

const videoSchema = new mongoose.Schema({
  title: String,
  description: String,
  tags: [String],
  script: String,
  thumbnail: String,
  videoPath: String,
  status: {
    type: String,
    enum: ['generating', 'generated', 'uploaded', 'scheduled', 'failed'],
    default: 'generating'
  },
  youtubeId: String,
  createdAt: { type: Date, default: Date.now }
});

export const  Video = mongoose.models.Video || mongoose.model('Video', videoSchema);
