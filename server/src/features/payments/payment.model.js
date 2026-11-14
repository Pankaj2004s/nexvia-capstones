const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    amount: { type: Number, required: true }, // INR
    currency: { type: String, default: 'INR' },
    provider: { type: String, default: 'razorpay' },
    orderId: { type: String, required: true, unique: true },
    paymentId: String,
    signature: String,
    status: { type: String, enum: ['created', 'paid', 'failed'], default: 'created', index: true },
    paidAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
