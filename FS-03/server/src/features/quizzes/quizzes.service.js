const { Quiz, Attempt } = require('./quiz.model');
const AppError = require('../../shared/utils/AppError');
const { assertId } = require('../../shared/utils/helpers');

const courses = () => require('../courses/courses.service');
const enrollments = () => require('../enrollments/enrollments.service');

// Students never receive isCorrect; owners/admins do.
const sanitize = (quiz, withAnswers) => {
  const o = quiz.toObject ? quiz.toObject() : quiz;
  return {
    id: String(o._id), course: String(o.course), lesson: o.lesson && String(o.lesson), title: o.title, passingPercent: o.passingPercent,
    questions: o.questions.map((q) => ({
      id: String(q._id), text: q.text, type: q.type, points: q.points,
      options: q.options.map((op) => (withAnswers ? { text: op.text, isCorrect: op.isCorrect } : { text: op.text })),
    })),
  };
};

async function getQuizOrThrow(id) {
  assertId(id, 'quiz id');
  const quiz = await Quiz.findById(id);
  if (!quiz) throw new AppError('Quiz not found', 404);
  return quiz;
}

async function create(user, courseId, data) {
  const course = await courses().getCourseOrThrow(courseId);
  courses().assertManage(course, user);
  return sanitize(await Quiz.create({ ...data, course: courseId }), true);
}

async function update(user, id, data) {
  const quiz = await getQuizOrThrow(id);
  courses().assertManage(await courses().getCourseOrThrow(quiz.course), user);
  Object.assign(quiz, data);
  await quiz.save();
  return sanitize(quiz, true);
}

async function remove(user, id) {
  const quiz = await getQuizOrThrow(id);
  courses().assertManage(await courses().getCourseOrThrow(quiz.course), user);
  await Attempt.deleteMany({ quiz: quiz._id });
  await quiz.deleteOne();
}

async function listForCourse(user, courseId) {
  const course = await courses().getCourseOrThrow(courseId);
  if (!(await courses().canAccessContent(course, user))) throw new AppError('Enroll to view quizzes', 403);
  const quizzes = await Quiz.find({ course: courseId });
  const manage = courses().isOwnerOrAdmin(course, user);
  return quizzes.map((q) => sanitize(q, manage));
}

async function getForUser(user, id) {
  const quiz = await getQuizOrThrow(id);
  const course = await courses().getCourseOrThrow(quiz.course);
  if (!(await courses().canAccessContent(course, user))) throw new AppError('Enroll to take this quiz', 403);
  return sanitize(quiz, courses().isOwnerOrAdmin(course, user));
}

// Pure grading function: easy to unit test.
function grade(quiz, answers) {
  const byQuestion = new Map(answers.map((a) => [a.question, a.selected]));
  let score = 0;
  let maxScore = 0;
  const review = [];
  for (const q of quiz.questions) {
    maxScore += q.points;
    const correctSet = q.options.map((o, i) => (o.isCorrect ? i : -1)).filter((i) => i >= 0);
    const selected = [...new Set(byQuestion.get(String(q._id)) || [])].sort((a, b) => a - b);
    const ok = selected.length === correctSet.length && selected.every((v, i) => v === correctSet[i]);
    if (ok) score += q.points;
    review.push({ question: String(q._id), correct: ok, correctOptions: correctSet });
  }
  const percent = maxScore ? Math.round((score / maxScore) * 10000) / 100 : 0;
  return { score, maxScore, percent, passed: percent >= quiz.passingPercent, review };
}

async function submitAttempt(user, quizId, answers) {
  const quiz = await getQuizOrThrow(quizId);
  if (!(await enrollments().isEnrolled(user.id, quiz.course))) throw new AppError('Enroll to take this quiz', 403);
  for (const a of answers) {
    const q = quiz.questions.id(a.question);
    if (!q) throw new AppError(`Unknown question ${a.question}`, 400);
    if (a.selected.some((i) => i >= q.options.length)) throw new AppError('Selected option out of range', 400);
  }
  const result = grade(quiz, answers);
  const attempt = await Attempt.create({
    user: user.id, quiz: quiz._id, course: quiz.course, answers,
    score: result.score, maxScore: result.maxScore, percent: result.percent, passed: result.passed,
  });
  return { attemptId: String(attempt._id), ...result };
}

const myAttempts = (userId, quizId) => Attempt.find({ user: userId, quiz: quizId }).sort({ createdAt: -1 }).select('-answers').lean();

async function passedStatus(userId, courseId) {
  const quizzes = await Quiz.find({ course: courseId }).select('title');
  const out = [];
  for (const q of quizzes) {
    const passed = Boolean(await Attempt.exists({ user: userId, quiz: q._id, passed: true }));
    out.push({ quizId: String(q._id), title: q.title, passed });
  }
  return out;
}

module.exports = { create, update, remove, listForCourse, getForUser, submitAttempt, myAttempts, passedStatus, grade };
