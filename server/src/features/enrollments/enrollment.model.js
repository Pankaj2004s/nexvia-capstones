const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    completedAt: Date,
  },
  { timestamps: true }
);

enrollmentSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
