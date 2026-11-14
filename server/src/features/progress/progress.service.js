const Progress = require('./progress.model');
const AppError = require('../../shared/utils/AppError');

const courses = () => require('../courses/courses.service');
const lessons = () => require('../lessons/lessons.service');
const enrollments = () => require('../enrollments/enrollments.service');
const quizzes = () => require('../quizzes/quizzes.service');

const ensureProgress = (userId, courseId) =>
  Progress.findOneAndUpdate({ user: userId, course: courseId }, { $setOnInsert: { user: userId, course: courseId, completedLessons: [], percent: 0 } }, { upsert: true, returnDocument: 'after' });

async function getProgress(userId, courseId) {
  return (await Progress.findOne({ user: userId, course: courseId })) || { completedLessons: [], percent: 0 };
}

async function completeLesson(user, lessonId) {
  const { lesson, course } = await lessons().assertAccess(user, lessonId);
  if (!(await enrollments().isEnrolled(user.id, course.id))) throw new AppError('Enroll to track progress', 403);
  await ensureProgress(user.id, course.id);
  await Progress.updateOne({ user: user.id, course: course.id }, { $addToSet: { completedLessons: lesson._id }, $set: { lastLesson: lesson._id } });
  const all = await lessons().listByCourse(course.id);
  const doc = await Progress.findOne({ user: user.id, course: course.id });
  const valid = new Set(all.map((l) => String(l._id)));
  const done = doc.completedLessons.filter((id) => valid.has(String(id))).length;
  doc.percent = all.length ? Math.round((done / all.length) * 100) : 0;
  await doc.save();
  if (doc.percent === 100) await enrollments().markCompleted(user.id, course.id);
  return doc;
}

// Eligible for a certificate when all lessons are done and every quiz of the course is passed.
async function completionStatus(userId, courseId) {
  const p = await getProgress(userId, courseId);
  const quizStatus = await quizzes().passedStatus(userId, courseId);
  const quizzesPassed = quizStatus.every((q) => q.passed);
  return { lessonsPercent: p.percent, quizzes: quizStatus, eligible: p.percent === 100 && quizzesPassed };
}

module.exports = { ensureProgress, getProgress, completeLesson, completionStatus };
