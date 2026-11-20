const { api, resetDb, closeDb, makeUser, auth, publishedCourse } = require('./helpers');
const { grade } = require('../src/features/quizzes/quizzes.service');

beforeAll(resetDb);
afterAll(closeDb);

const quizBody = {
  title: 'Basics quiz', passingPercent: 60,
  questions: [
    { text: 'Node.js runs on which engine?', type: 'single', options: [{ text: 'V8', isCorrect: true }, { text: 'SpiderMonkey' }, { text: 'Chakra' }], points: 2 },
    { text: 'Which are HTTP verbs?', type: 'multi', options: [{ text: 'GET', isCorrect: true }, { text: 'FETCHIT' }, { text: 'POST', isCorrect: true }], points: 2 },
    { text: 'Express is a framework', type: 'truefalse', options: [{ text: 'True', isCorrect: true }, { text: 'False' }], points: 1 },
  ],
};

describe('grading (unit)', () => {
  const quiz = { passingPercent: 60, questions: [
    { _id: 'a', points: 2, options: [{ isCorrect: true }, { isCorrect: false }] },
    { _id: 'b', points: 2, options: [{ isCorrect: true }, { isCorrect: false }, { isCorrect: true }] },
  ] };
  test('all correct', () => expect(grade(quiz, [{ question: 'a', selected: [0] }, { question: 'b', selected: [2, 0] }])).toMatchObject({ score: 4, percent: 100, passed: true }));
  test('multi-select needs the exact set (partial = 0)', () => expect(grade(quiz, [{ question: 'a', selected: [0] }, { question: 'b', selected: [0] }])).toMatchObject({ score: 2, percent: 50, passed: false }));
  test('unanswered counts as wrong; duplicate selections are de-duplicated', () => expect(grade(quiz, [{ question: 'a', selected: [0, 0] }])).toMatchObject({ score: 2, passed: false }));
});

describe('quiz API, progress and certificate', () => {
  let ctx; let student; let quizId; let qs;

  beforeAll(async () => {
    ctx = await publishedCourse();
    student = await makeUser('student', 'Priya Verma');
    await api().post(`/api/courses/${ctx.courseId}/enroll`).set(auth(student.token));
  });

  test('quiz validation rejects bad question shapes', async () => {
    const bad = { title: 'bad', questions: [{ text: 'Two correct but single?', type: 'single', options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }] }] };
    expect((await api().post(`/api/courses/${ctx.courseId}/quizzes`).set(auth(ctx.instructor.token)).send(bad)).status).toBe(400);
    expect((await api().post(`/api/courses/${ctx.courseId}/quizzes`).set(auth(student.token)).send(quizBody)).status).toBe(403);
  });

  test('students never receive correct answers; instructors do', async () => {
    const created = await api().post(`/api/courses/${ctx.courseId}/quizzes`).set(auth(ctx.instructor.token)).send(quizBody);
    expect(created.status).toBe(201);
    quizId = created.body.quiz.id;
    const asStudent = await api().get(`/api/quizzes/${quizId}`).set(auth(student.token));
    expect(JSON.stringify(asStudent.body)).not.toMatch(/isCorrect/);
    qs = asStudent.body.quiz.questions;
    const asTeacher = await api().get(`/api/quizzes/${quizId}`).set(auth(ctx.instructor.token));
    expect(JSON.stringify(asTeacher.body)).toMatch(/isCorrect/);
  });

  test('non-enrolled users cannot take the quiz', async () => {
    const stranger = await makeUser('student');
    expect((await api().post(`/api/quizzes/${quizId}/attempts`).set(auth(stranger.token)).send({ answers: [{ question: qs[0].id, selected: [0] }] })).status).toBe(403);
  });

  test('certificate is refused until lessons are done AND quiz passed', async () => {
    const r = await api().post(`/api/courses/${ctx.courseId}/certificate`).set(auth(student.token));
    expect(r.status).toBe(400);
    expect(r.body.details.eligible).toBe(false);
  });

  test('failing attempt is graded and recorded; out-of-range options rejected', async () => {
    const fail = await api().post(`/api/quizzes/${quizId}/attempts`).set(auth(student.token)).send({ answers: [{ question: qs[0].id, selected: [1] }, { question: qs[1].id, selected: [0] }, { question: qs[2].id, selected: [1] }] });
    expect(fail.body.result).toMatchObject({ score: 0, maxScore: 5, passed: false });
    expect((await api().post(`/api/quizzes/${quizId}/attempts`).set(auth(student.token)).send({ answers: [{ question: qs[0].id, selected: [9] }] })).status).toBe(400);
  });

  test('passing attempt', async () => {
    const pass = await api().post(`/api/quizzes/${quizId}/attempts`).set(auth(student.token)).send({ answers: [{ question: qs[0].id, selected: [0] }, { question: qs[1].id, selected: [0, 2] }, { question: qs[2].id, selected: [0] }] });
    expect(pass.body.result).toMatchObject({ score: 5, percent: 100, passed: true });
    const attempts = await api().get(`/api/quizzes/${quizId}/attempts`).set(auth(student.token));
    expect(attempts.body.attempts).toHaveLength(2);
  });

  test('progress tracks completed lessons and reaches 100%', async () => {
    const p1 = await api().post(`/api/progress/lessons/${ctx.lessonIds[0]}/complete`).set(auth(student.token));
    expect(p1.body.progress.percent).toBe(50);
    await api().post(`/api/progress/lessons/${ctx.lessonIds[0]}/complete`).set(auth(student.token)); // idempotent
    const p2 = await api().post(`/api/progress/lessons/${ctx.lessonIds[1]}/complete`).set(auth(student.token));
    expect(p2.body.progress.percent).toBe(100);
    const mine = await api().get('/api/enrollments/mine').set(auth(student.token));
    expect(mine.body.enrollments[0]).toMatchObject({ percent: 100 });
    expect(mine.body.enrollments[0].completedAt).toBeTruthy();
  });

  let certId;
  test('certificate: issued once, valid PDF, publicly verifiable', async () => {
    const r1 = await api().post(`/api/courses/${ctx.courseId}/certificate`).set(auth(student.token));
    expect(r1.status).toBe(201);
    certId = r1.body.certificate.certId;
    expect(certId).toMatch(/^LS-[0-9A-F]{12}$/);
    const r2 = await api().post(`/api/courses/${ctx.courseId}/certificate`).set(auth(student.token));
    expect(r2.body.certificate.certId).toBe(certId); // no duplicates

    const pdf = await api().get(`/api/certificates/${certId}/download`).set(auth(student.token)).buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(pdf.headers['content-type']).toMatch(/application\/pdf/);
    expect(pdf.body.slice(0, 5).toString()).toBe('%PDF-');
    expect(pdf.body.length).toBeGreaterThan(1500);

    const v = await api().get(`/api/certificates/verify/${certId}`);
    expect(v.body).toMatchObject({ valid: true, studentName: 'Priya Verma' });
    expect((await api().get('/api/certificates/verify/LS-DOESNOTEXIST')).status).toBe(404);
  });

  test("another user cannot download someone else's certificate", async () => {
    const other = await makeUser('student');
    expect((await api().get(`/api/certificates/${certId}/download`).set(auth(other.token))).status).toBe(403);
    expect((await api().get(`/api/certificates/${certId}/download`)).status).toBe(401);
  });
});
