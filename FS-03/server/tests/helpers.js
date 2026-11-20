const request = require('supertest');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { connectDb, disconnectDb } = require('../src/config/db');
const User = require('../src/features/auth/user.model');

const api = () => request(app);

async function resetDb() {
  await connectDb();
  await mongoose.connection.dropDatabase();
}

async function closeDb() {
  await disconnectDb();
}

// Registers a student/instructor through the API; admins are created directly (cannot self-register).
async function makeUser(role = 'student', name = role) {
  const email = `${name.replace(/[^a-z0-9]/gi, "")}.${Math.random().toString(36).slice(2, 8)}@test.dev`.toLowerCase();
  const password = 'Passw0rd!x';
  if (role === 'admin') {
    await User.create({ name, email, passwordHash: await bcrypt.hash(password, 4), role: 'admin' });
    const res = await api().post('/api/auth/login').send({ email, password });
    return { token: res.body.accessToken, user: res.body.user, email, password };
  }
  const res = await api().post('/api/auth/register').send({ name, email, password, role });
  return { token: res.body.accessToken, user: res.body.user, email, password, cookies: res.headers['set-cookie'] };
}

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// instructor + published course with 2 lessons (+ optional price) ready for students
async function publishedCourse({ price = 0, lessons = 2 } = {}) {
  const instructor = await makeUser('instructor', 'teacher');
  const admin = await makeUser('admin', 'boss');
  const c = await api().post('/api/courses').set(auth(instructor.token)).send({
    title: `Node.js Mastery ${Math.random().toString(36).slice(2, 6)}`, description: 'Learn Node.js properly from scratch.', category: 'Backend', price, tags: ['node', 'express'],
  });
  const courseId = c.body.course._id;
  const lessonIds = [];
  for (let i = 0; i < lessons; i += 1) {
    const l = await api().post(`/api/courses/${courseId}/lessons`).set(auth(instructor.token)).send({ title: `Lesson ${i + 1}`, section: 'Basics', isPreview: i === 0 });
    lessonIds.push(l.body.lesson._id);
  }
  await api().post(`/api/courses/${courseId}/submit`).set(auth(instructor.token));
  await api().post(`/api/admin/courses/${courseId}/approve`).set(auth(admin.token));
  return { courseId, lessonIds, instructor, admin };
}

module.exports = { api, resetDb, closeDb, makeUser, auth, publishedCourse };
