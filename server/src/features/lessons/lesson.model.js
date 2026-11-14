const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    section: { type: String, default: 'General' },
    title: { type: String, required: true, trim: true, maxlength: 140 },
    order: { type: Number, default: 0 },
    type: { type: String, enum: ['video', 'text'], default: 'video' },
    content: { type: String, maxlength: 20000 }, // text lessons
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video' },
    durationSec: { type: Number, default: 0 },
    isPreview: { type: Boolean, default: false },
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, order: 1 });

module.exports = mongoose.models.Lesson || mongoose.model('Lesson', lessonSchema);
