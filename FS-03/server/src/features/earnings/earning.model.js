const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema(
  {
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
    gross: { type: Number, required: true },
    instructorAmount: { type: Number, required: true },
    platformFee: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Earning || mongoose.model('Earning', earningSchema);
