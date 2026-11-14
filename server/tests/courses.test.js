const { api, resetDb, closeDb, makeUser, auth, publishedCourse } = require('./helpers');

beforeAll(resetDb);
afterAll(closeDb);

const body = (o = {}) => ({ title: 'React for Beginners', description: 'Components, hooks and state from zero.', category: 'Frontend', price: 499, tags: ['react'], ...o });

describe('course lifecycle', () => {
  let instructor; let other; let admin; let courseId;

  beforeAll(async () => {
    instructor = await makeUser('instructor', 'teacher');
    other = await makeUser('instructor', 'other');
    admin = await makeUser('admin', 'boss');
  });

  test('create -> draft, hidden from public catalog', async () => {
    const res = await api().post('/api/courses').set(auth(instructor.token)).send(body());
    expect(res.status).toBe(201);
    expect(res.body.course.status).toBe('draft');
    courseId = res.body.course._id;
    const list = await api().get('/api/courses');
    expect(list.body.items.find((c) => c.id === courseId)).toBeUndefined();
    expect((await api().get(`/api/courses/${courseId}`)).status).toBe(404); // drafts are private
    expect((await api().get(`/api/courses/${courseId}`).set(auth(instructor.token))).status).toBe(200);
  });

  test('validation errors are 400 with details', async () => {
    const res = await api().post('/api/courses').set(auth(instructor.token)).send({ title: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
  });

  test('cannot submit without lessons; other instructors cannot edit', async () => {
    expect((await api().post(`/api/courses/${courseId}/submit`).set(auth(instructor.token))).status).toBe(400);
    expect((await api().patch(`/api/courses/${courseId}`).set(auth(other.token)).send({ price: 1 })).status).toBe(403);
    expect((await api().post(`/api/courses/${courseId}/lessons`).set(auth(other.token)).send({ title: 'Hack' })).status).toBe(403);
  });

  test('lessons update course stats; submit -> pending; admin approves -> public', async () => {
    await api().post(`/api/courses/${courseId}/lessons`).set(auth(instructor.token)).send({ title: 'Intro', isPreview: true });
    await api().post(`/api/courses/${courseId}/lessons`).set(auth(instructor.token)).send({ title: 'Hooks' });
    const sub = await api().post(`/api/courses/${courseId}/submit`).set(auth(instructor.token));
    expect(sub.body.course.status).toBe('pending');
    expect(sub.body.course.lessonCount).toBe(2);
    expect((await api().get('/api/courses').then((r) => r.body.items.length))).toBe(0);
    const pending = await api().get('/api/admin/courses').set(auth(admin.token));
    expect(pending.body.courses.length).toBe(1);
    await api().post(`/api/admin/courses/${courseId}/approve`).set(auth(admin.token));
    const pub = await api().get('/api/courses');
    expect(pub.body.items).toHaveLength(1);
    expect(pub.body.items[0].instructorName).toBe('teacher');
  });

  test('detail shows outline with locked flags (preview lesson unlocked)', async () => {
    const res = await api().get(`/api/courses/${courseId}`);
    expect(res.body.course.lessons.map((l) => l.locked)).toEqual([false, true]);
    expect(res.body.course.isEnrolled).toBe(false);
  });

  test('delete blocked once students are enrolled', async () => {
    const s = await makeUser('student');
    const paid = await api().post(`/api/courses/${courseId}/enroll`).set(auth(s.token));
    expect(paid.status).toBe(402); // price 499 -> must pay
    const free = await publishedCourse();
    await api().post(`/api/courses/${free.courseId}/enroll`).set(auth(s.token));
    expect((await api().delete(`/api/courses/${free.courseId}`).set(auth(free.instructor.token))).status).toBe(409);
  });
});

describe('catalog search, filter, sort, pagination', () => {
  beforeAll(async () => {
    await resetDb();
    const t = await makeUser('instructor', 'teacher');
    const admin = await makeUser('admin', 'boss');
    const defs = [
      ['Python Basics', 'Data', 0], ['Advanced Python', 'Data', 999], ['React Pro', 'Frontend', 1499], ['Vue Starter', 'Frontend', 299], ['Docker 101', 'DevOps', 599],
    ];
    for (const [title, category, price] of defs) {
      const c = await api().post('/api/courses').set(auth(t.token)).send(body({ title, category, price, tags: [title.split(' ')[0].toLowerCase()] }));
      await api().post(`/api/courses/${c.body.course._id}/lessons`).set(auth(t.token)).send({ title: 'L1' });
      await api().post(`/api/courses/${c.body.course._id}/submit`).set(auth(t.token));
      await api().post(`/api/admin/courses/${c.body.course._id}/approve`).set(auth(admin.token));
    }
  });

  test('text search', async () => {
    const r = await api().get('/api/courses?q=python');
    expect(r.body.items.map((c) => c.title).sort()).toEqual(['Advanced Python', 'Python Basics']);
  });
  test('regex characters in search are escaped (no crash / no injection)', async () => {
    const r = await api().get('/api/courses?q=' + encodeURIComponent('.*(['));
    expect(r.status).toBe(200);
    expect(r.body.items).toHaveLength(0);
  });
  test('category + price range', async () => {
    const r = await api().get('/api/courses?category=Frontend&maxPrice=500');
    expect(r.body.items.map((c) => c.title)).toEqual(['Vue Starter']);
  });
  test('sort and pagination', async () => {
    const r = await api().get('/api/courses?sort=price_desc&limit=2&page=1');
    expect(r.body.items.map((c) => c.price)).toEqual([1499, 999]);
    expect(r.body).toMatchObject({ total: 5, pages: 3, page: 1 });
    expect((await api().get('/api/courses?limit=500')).status).toBe(400);
  });
});

describe('lesson access control', () => {
  test('locked lessons need enrollment; enrolling unlocks', async () => {
    await resetDb();
    const { courseId, lessonIds } = await publishedCourse();
    const s = await makeUser('student');
    expect((await api().get(`/api/lessons/${lessonIds[0]}`)).status).toBe(200); // preview is public
    expect((await api().get(`/api/lessons/${lessonIds[1]}`).set(auth(s.token))).status).toBe(403);
    expect((await api().post(`/api/courses/${courseId}/enroll`).set(auth(s.token))).status).toBe(201);
    expect((await api().post(`/api/courses/${courseId}/enroll`).set(auth(s.token))).status).toBe(200); // idempotent
    expect((await api().get(`/api/lessons/${lessonIds[1]}`).set(auth(s.token))).status).toBe(200);
    const mine = await api().get('/api/enrollments/mine').set(auth(s.token));
    expect(mine.body.enrollments).toHaveLength(1);
    const detail = await api().get(`/api/courses/${courseId}`).set(auth(s.token));
    expect(detail.body.course.enrolledCount).toBe(1);
  });
});
