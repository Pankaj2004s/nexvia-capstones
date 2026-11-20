const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true, index: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalKey: { type: String, required: true },
    originalName: String,
    sizeBytes: Number,
    status: { type: String, enum: ['queued', 'processing', 'ready', 'failed'], default: 'queued', index: true },
    progress: { type: Number, default: 0, min: 0, max: 100 },
    renditions: [{ name: String, height: Number, bandwidth: Number }],
    hlsPrefix: String, // folder holding master.m3u8 and rendition playlists
    thumbnailKey: String,
    durationSec: Number,
    attempts: { type: Number, default: 0 },
    processingMs: Number,
    error: String,
  },
  { timestamps: true }
);

module.exports = mongoose.models.Video || mongoose.model('Video', videoSchema);
