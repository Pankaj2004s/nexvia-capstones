const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../features/auth/user.model');
const Course = require('../features/courses/course.model');
const Lesson = require('../features/lessons/lesson.model');
const { Quiz } = require('../features/quizzes/quiz.model');
const Video = require('../features/video/video.model');
const { processVideo } = require('../features/video/video.processor');
const lessonsService = require('../features/lessons/lessons.service');
const { getStorage } = require('../shared/storage');
const { slugify } = require('../shared/utils/helpers');
const logger = require('../shared/utils/logger');
const { PASSWORD, CATALOG, SECTIONS, quizFor, thumbName } = require('./catalog');
const { makeDemoVideo } = require('./demoVideo');

async function upsertUser(name, email, role) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const existing = await User.findOne({ email });
  if (!existing) return User.create({ name, email, role, passwordHash });
  Object.assign(existing, { name, role, passwordHash, isActive: true });
  return existing.save();
}

// Creates one Video for a lesson from a generated title card and runs the real FFmpeg/HLS pipeline on it.
async function attachDemoVideo({ course, lesson, uploader, seconds = 12, size = '1280x720', storage = getStorage() }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-demo-'));
  try {
    const file = makeDemoVideo(path.join(dir, 'demo.mp4'), { title: course.title, seconds, size });
    const id = new mongoose.Types.ObjectId();
    const key = `originals/${id}/demo.mp4`;
    await storage.putFile(file, key);
    await Video.create({ _id: id, course: course._id, lesson: lesson._id, uploader, originalKey: key, originalName: 'demo.mp4', status: 'queued' });
    await processVideo(id, { maxAttempts: 1, storage });
    return id;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function seedDatabase({ withVideo = false, videoOptions = {} } = {}) {
  await upsertUser('Platform Admin', 'admin@learnsphere.dev', 'admin');
  const teachers = [
    await upsertUser('Riya Kapoor', 'instructor@learnsphere.dev', 'instructor'),
    await upsertUser('Arjun Mehta', 'instructor2@learnsphere.dev', 'instructor'),
  ];
  await upsertUser('Pankaj Student', 'student@learnsphere.dev', 'student');
  await upsertUser('Asha Student', 'student2@learnsphere.dev', 'student');

  await Promise.all([Course.deleteMany({}), Lesson.deleteMany({}), Quiz.deleteMany({}), Video.deleteMany({})]);
  const created = [];
  for (let i = 0; i < CATALOG.length; i += 1) {
    const [title, category, level, price, tags] = CATALOG[i];
    const course = await Course.create({
      title, slug: slugify(title), category, level, price, tags, instructor: teachers[i % 2]._id, status: 'published',
      description: `${title}: a practical, project-driven course with quizzes, live Q&A sessions and a certificate on completion.`,
      thumbnail: `/thumbs/${thumbName(title)}.svg`,
      sections: Object.keys(SECTIONS).map((t, order) => ({ title: t, order })),
    });
    let order = 0;
    for (const [section, titles] of Object.entries(SECTIONS)) {
      for (const lt of titles) {
        await Lesson.create({ course: course._id, section, title: lt, order, type: 'video', isPreview: order === 0, durationSec: 0 });
        order += 1;
      }
    }
    await lessonsService.recalcCourse(course._id);
    await Quiz.create({ ...quizFor(title), course: course._id });
    created.push(course);
  }

  if (withVideo) {
    const lesson = await Lesson.findOne({ course: created[0]._id, order: 0 });
    await attachDemoVideo({ course: created[0], lesson, uploader: teachers[0]._id, ...videoOptions });
  }
  return { courses: created.length };
}

// The demo video lives on the storage driver. With the local driver on a host whose disk is wiped on restart,
// the Video row survives in MongoDB but its files are gone. This re-creates them.
async function restoreDemoVideo(options = {}) {
  const storage = options.storage || getStorage();
  const demo = await Video.findOne({ originalName: 'demo.mp4' }).sort({ createdAt: 1 });
  if (demo && demo.status === 'ready' && demo.hlsPrefix && (await storage.exists(`${demo.hlsPrefix}/master.m3u8`))) return false;

  let lesson;
  let course;
  let uploader;
  if (demo) {
    lesson = await Lesson.findById(demo.lesson);
    course = await Course.findById(demo.course);
    uploader = demo.uploader;
    await Video.deleteOne({ _id: demo._id });
  }
  if (!lesson || !course) {
    course = await Course.findOne({ status: 'published' }).sort({ createdAt: 1 });
    lesson = course && (await Lesson.findOne({ course: course._id, order: 0 }));
    uploader = course && course.instructor;
  }
  if (!lesson) return false;
  await attachDemoVideo({ course, lesson, uploader, storage, ...options });
  return true;
}

// Called from server.js when SEED_DEMO=true: seed an empty database once, and keep the demo video playable.
async function bootstrapDemo(options = {}) {
  if ((await User.estimatedDocumentCount()) === 0) {
    logger.info('SEED_DEMO: empty database, seeding demo users, courses and video');
    await seedDatabase({ withVideo: true, videoOptions: options });
    return 'seeded';
  }
  const restored = await restoreDemoVideo(options);
  if (restored) logger.info('SEED_DEMO: demo video files were missing and have been rebuilt');
  return restored ? 'restored' : 'ok';
}

module.exports = { seedDatabase, restoreDemoVideo, bootstrapDemo, attachDemoVideo };
