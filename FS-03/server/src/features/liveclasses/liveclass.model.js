const mongoose = require('mongoose');

const liveClassSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 140 },
    description: String,
    scheduledAt: { type: Date, required: true, index: true },
    durationMin: { type: Number, default: 60, min: 5, max: 480 },
    status: { type: String, enum: ['scheduled', 'live', 'ended'], default: 'scheduled', index: true },
    startedAt: Date,
    endedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.LiveClass || mongoose.model('LiveClass', liveClassSchema);
