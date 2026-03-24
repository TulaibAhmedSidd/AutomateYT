import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
  type: String,
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  progress: {
    type: Number,
    default: 0
  },
  videoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
  logs: [String],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const Job = mongoose.models.Job || mongoose.model('Job', jobSchema);
