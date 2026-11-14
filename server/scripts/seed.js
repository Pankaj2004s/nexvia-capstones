/* Seeds demo users, a course catalog, quizzes and (optionally) one real processed video.
   Usage: npm run seed            -> users + catalog + quizzes
          npm run seed -- --video -> also generates a short test video and runs the FFmpeg/HLS pipeline on it */
process.env.RUN_WORKER_INLINE = 'false';
const fs = require('fs');
const os = require('os');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { execFileSync } = require('child_process');
const { connectDb, disconnectDb } = require('../src/config/db');
const User = require('../src/features/auth/user.model');
const Course = require('../src/features/courses/course.model');
const Lesson = require('../src/features/lessons/lesson.model');
const { Quiz } = require('../src/features/quizzes/quiz.model');
const Video = require('../src/features/video/video.model');
const { processVideo } = require('../src/features/video/video.processor');
const { getStorage } = require('../src/shared/storage');
const lessonsService = require('../src/features/lessons/lessons.service');
const { slugify } = require('../src/shared/utils/helpers');

const PASSWORD = 'Demo@1234';
const CATALOG = [
  ['Complete Node.js & Express Bootcamp', 'Backend', 'intermediate', 1499, ['node', 'express', 'api']],
  ['React 19 from Zero to Hero', 'Frontend', 'beginner', 1299, ['react', 'hooks']],
  ['MongoDB & Mongoose Mastery', 'Database', 'intermediate', 999, ['mongodb', 'mongoose']],
  ['JavaScript: The Complete Guide', 'Programming', 'beginner', 0, ['javascript', 'es6']],
  ['TypeScript for Professionals', 'Programming', 'advanced', 1199, ['typescript']],
  ['Docker & Deployment Essentials', 'DevOps', 'intermediate', 899, ['docker', 'deploy']],
  ['Data Structures in JavaScript', 'Computer Science', 'intermediate', 0, ['dsa', 'algorithms']],
  ['Tailwind CSS: Design Systems', 'Frontend', 'beginner', 599, ['css', 'tailwind']],
  ['Python for Data Analysis', 'Data Science', 'beginner', 1099, ['python', 'pandas']],
  ['System Design Fundamentals', 'Architecture', 'advanced', 1999, ['design', 'scale']],
  ['Git & GitHub Workflow', 'Tools', 'beginner', 0, ['git', 'github']],
  ['WebRTC & Real-time Apps', 'Backend', 'advanced', 1699, ['webrtc', 'sockets']],
];
const SECTIONS = {
  Basics: ['Welcome and course roadmap', 'Setting up your environment', 'Core concepts explained'],
  Building: ['Project structure', 'Implementing the main feature', 'Handling errors and edge cases'],
  Shipping: ['Testing your work', 'Deploying to production'],
};

const quizFor = (title) => ({
  title: `${title.split(':')[0]} quick check`, passingPercent: 60,
  questions: [
    { text: 'Which HTTP method is normally used to create a resource?', type: 'single', options: [{ text: 'GET' }, { text: 'POST', isCorrect: true }, { text: 'DELETE' }], points: 1 },
    { text: 'Which of these are valid HTTP status codes for success?', type: 'multi', options: [{ text: '200', isCorrect: true }, { text: '201', isCorrect: true }, { text: '404' }], points: 2 },
    { text: 'JSON stands for JavaScript Object Notation.', type: 'truefalse', options: [{ text: 'True', isCorrect: true }, { text: 'False' }], points: 1 },
  ],
});

async function upsertUser(name, email, role) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const existing = await User.findOne({ email });
  if (!existing) return User.create({ name, email, role, passwordHash });
  Object.assign(existing, { name, role, passwordHash, isActive: true });
  return existing.save();
}

async function main() {
  await connectDb();
  const admin = await upsertUser('Platform Admin', 'admin@learnsphere.dev', 'admin');
  const teachers = [await upsertUser('Riya Kapoor', 'instructor@learnsphere.dev', 'instructor'), await upsertUser('Arjun Mehta', 'instructor2@learnsphere.dev', 'instructor')];
  await upsertUser('Pankaj Student', 'student@learnsphere.dev', 'student');
  await upsertUser('Asha Student', 'student2@learnsphere.dev', 'student');

  await Promise.all([Course.deleteMany({}), Lesson.deleteMany({}), Quiz.deleteMany({}), Video.deleteMany({})]);
  const created = [];
  for (let i = 0; i < CATALOG.length; i += 1) {
    const [title, category, level, price, tags] = CATALOG[i];
    const course = await Course.create({
      title, slug: slugify(title), category, level, price, tags, instructor: teachers[i % 2]._id, status: 'published',
      description: `${title}: a practical, project-driven course with quizzes, live Q&A sessions and a certificate on completion.`,
      thumbnail: `https://picsum.photos/seed/${encodeURIComponent(tags[0])}/640/360`,
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

  if (process.argv.includes('--video')) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-seed-'));
    const file = path.join(dir, 'demo.mp4');
    execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=duration=20:size=1280x720:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=20', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', file], { stdio: 'ignore' });
    const lesson = await Lesson.findOne({ course: created[0]._id, order: 0 });
    const id = new mongoose.Types.ObjectId();
    const key = `originals/${id}/demo.mp4`;
    await getStorage().putFile(file, key);
    await Video.create({ _id: id, course: created[0]._id, lesson: lesson._id, uploader: teachers[0]._id, originalKey: key, originalName: 'demo.mp4', status: 'queued' });
    await processVideo(id, { maxAttempts: 1 });
    console.log('Demo video processed and attached to the first lesson of', created[0].title);
  }

  console.log(`Seeded ${created.length} courses. Logins (password ${PASSWORD}):`);
  console.log(' admin@learnsphere.dev | instructor@learnsphere.dev | instructor2@learnsphere.dev | student@learnsphere.dev | student2@learnsphere.dev');
  await disconnectDb();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
