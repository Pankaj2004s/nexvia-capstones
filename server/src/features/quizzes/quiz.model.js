const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  type: { type: String, enum: ['single', 'multi', 'truefalse'], default: 'single' },
  options: [{ text: { type: String, required: true }, isCorrect: { type: Boolean, default: false } }],
  points: { type: Number, default: 1, min: 1 },
});

const quizSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' },
    title: { type: String, required: true },
    passingPercent: { type: Number, default: 60, min: 1, max: 100 },
    questions: [questionSchema],
  },
  { timestamps: true }
);

const attemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    answers: [{ question: String, selected: [Number] }],
    score: Number,
    maxScore: Number,
    percent: Number,
    passed: Boolean,
  },
  { timestamps: true }
);
attemptSchema.index({ user: 1, quiz: 1, createdAt: -1 });

const Quiz = mongoose.models.Quiz || mongoose.model('Quiz', quizSchema);
const Attempt = mongoose.models.Attempt || mongoose.model('Attempt', attemptSchema);
module.exports = { Quiz, Attempt };
