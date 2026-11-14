const Enrollment = require('./enrollment.model');
const AppError = require('../../shared/utils/AppError');

const courses = () => require('../courses/courses.service');
const progress = () => require('../progress/progress.service');

const isEnrolled = async (userId, courseId) => Boolean(await Enrollment.exists({ user: userId, course: courseId }));

// Idempotent: calling twice (e.g. verify + webhook) returns the same enrollment and counts once.
async function enrollUser(userId, courseId, paymentId) {
  const existing = await Enrollment.findOne({ user: userId, course: courseId });
  if (existing) return { enrollment: existing, created: false };
  try {
    const enrollment = await Enrollment.create({ user: userId, course: courseId, payment: paymentId });
    await courses().bumpEnrolled(courseId);
    await progress().ensureProgress(userId, courseId);
    return { enrollment, created: true };
  } catch (e) {
    if (e.code === 11000) return { enrollment: await Enrollment.findOne({ user: userId, course: courseId }), created: false };
    throw e;
  }
}

async function enrollFree(user, courseId) {
  const course = await courses().getCourseOrThrow(courseId);
  if (course.status !== 'published') throw new AppError('Course is not available', 404);
  if (course.price > 0) throw new AppError('This is a paid course. Complete payment to enroll.', 402);
  return enrollUser(user.id, courseId);
}

async function listMine(userId) {
  const list = await Enrollment.find({ user: userId }).sort({ createdAt: -1 }).lean();
  const out = [];
  for (const e of list) {
    const course = await courses().getCourseOrThrow(e.course).catch(() => null);
    if (!course) continue;
    const p = await progress().getProgress(userId, e.course);
    out.push({
      id: String(e._id), enrolledAt: e.createdAt, completedAt: e.completedAt,
      percent: p.percent,
      course: { id: course.id, title: course.title, slug: course.slug, thumbnail: course.thumbnail, lessonCount: course.lessonCount },
    });
  }
  return out;
}

const markCompleted = (userId, courseId) =>
  Enrollment.updateOne({ user: userId, course: courseId, completedAt: null }, { $set: { completedAt: new Date() } });

module.exports = { isEnrolled, enrollUser, enrollFree, listMine, markCompleted };
