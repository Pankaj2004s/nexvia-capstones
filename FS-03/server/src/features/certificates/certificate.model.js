const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    certId: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    studentName: String,
    courseTitle: String,
    instructorName: String,
    pdfKey: String,
    issuedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
certificateSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);
