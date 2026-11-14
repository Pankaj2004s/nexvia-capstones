const mongoose = require('mongoose');

const STATUSES = ['draft', 'pending', 'published', 'rejected'];

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, required: true, maxlength: 5000 },
    category: { type: String, required: true, index: true },
    level: { type: String, enum: ['beginner', 'intermediate', 'advanced'], default: 'beginner' },
    price: { type: Number, default: 0, min: 0 }, // INR, 0 = free
    thumbnail: String,
    tags: [String],
    sections: [{ title: { type: String, required: true }, order: { type: Number, default: 0 } }],
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: STATUSES, default: 'draft', index: true },
    enrolledCount: { type: Number, default: 0 },
    lessonCount: { type: Number, default: 0 },
    totalDurationSec: { type: Number, default: 0 },
  },
  { timestamps: true }
);

courseSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.models.Course || mongoose.model('Course', courseSchema);
module.exports.STATUSES = STATUSES;
