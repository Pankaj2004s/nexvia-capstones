const Lesson = require('./lesson.model');
const AppError = require('../../shared/utils/AppError');
const { assertId } = require('../../shared/utils/helpers');

const courses = () => require('../courses/courses.service');

async function recalcCourse(courseId) {
  const all = await Lesson.find({ course: courseId }).select('durationSec');
  await courses().setStats(courseId, {
    lessonCount: all.length,
    totalDurationSec: all.reduce((s, l) => s + (l.durationSec || 0), 0),
  });
}

async function getLessonOrThrow(id) {
  assertId(id, 'lesson id');
  const lesson = await Lesson.findById(id);
  if (!lesson) throw new AppError('Lesson not found', 404);
  return lesson;
}

async function create(user, courseId, data) {
  const course = await courses().getCourseOrThrow(courseId);
  courses().assertManage(course, user);
  const order = data.order ?? (await Lesson.countDocuments({ course: courseId }));
  const lesson = await Lesson.create({ ...data, order, course: courseId });
  await recalcCourse(courseId);
  return lesson;
}

const listByCourse = (courseId) => Lesson.find({ course: courseId }).sort({ order: 1, createdAt: 1 });

async function update(user, lessonId, data) {
  const lesson = await getLessonOrThrow(lessonId);
  courses().assertManage(await courses().getCourseOrThrow(lesson.course), user);
  Object.assign(lesson, data);
  await lesson.save();
  return lesson;
}

async function remove(user, lessonId) {
  const lesson = await getLessonOrThrow(lessonId);
  courses().assertManage(await courses().getCourseOrThrow(lesson.course), user);
  await lesson.deleteOne();
  await recalcCourse(lesson.course);
}

const removeAllForCourse = (courseId) => Lesson.deleteMany({ course: courseId });

// called by the video worker once a video is ready
async function attachVideo(lessonId, videoId, durationSec) {
  const lesson = await Lesson.findByIdAndUpdate(lessonId, { video: videoId, durationSec: Math.round(durationSec || 0) }, { returnDocument: 'after' });
  if (lesson) await recalcCourse(lesson.course);
  return lesson;
}

async function assertAccess(user, lessonId) {
  const lesson = await getLessonOrThrow(lessonId);
  const course = await courses().getCourseOrThrow(lesson.course);
  const allowed = lesson.isPreview || (await courses().canAccessContent(course, user));
  if (!allowed) throw new AppError('Enroll in this course to access this lesson', 403);
  return { lesson, course };
}

module.exports = { getLessonOrThrow, create, listByCourse, update, remove, removeAllForCourse, attachVideo, assertAccess, recalcCourse };
