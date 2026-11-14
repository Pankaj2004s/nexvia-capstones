const http = require('http');
const { io: connect } = require('socket.io-client');
const app = require('../src/app');
const { attachLiveSocket } = require('../src/features/liveclasses');
const { closeSocket } = require('../src/features/liveclasses/liveclasses.socket');
const { api, resetDb, closeDb, makeUser, auth, publishedCourse } = require('./helpers');

let server; let url; const sockets = [];

beforeAll(async () => {
  await resetDb();
  server = http.createServer(app);
  attachLiveSocket(server);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${server.address().port}/live`;
});
afterAll(async () => {
  sockets.forEach((s) => s.close());
  await closeSocket();
  await new Promise((r) => server.close(r));
  await closeDb();
});

const open = (token) => new Promise((resolve, reject) => {
  const s = connect(url, { auth: { token }, transports: ['websocket'], reconnection: false });
  sockets.push(s);
  s.on('connect', () => resolve(s));
  s.on('connect_error', reject);
});
const call = (s, event, payload) => new Promise((resolve) => s.emit(event, payload, resolve));
const next = (s, event, ms = 3000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), ms);
  s.once(event, (d) => { clearTimeout(t); resolve(d); });
});

describe('live class signaling', () => {
  let ctx; let classId; let teacher; let student; let stranger;

  beforeAll(async () => {
    ctx = await publishedCourse();
    student = await makeUser('student', 'asha');
    stranger = await makeUser('student', 'stranger');
    await api().post(`/api/courses/${ctx.courseId}/enroll`).set(auth(student.token));
    const lc = await api().post(`/api/courses/${ctx.courseId}/live-classes`).set(auth(ctx.instructor.token)).send({ title: 'Doubt clearing', scheduledAt: new Date(Date.now() + 3600e3).toISOString() });
    expect(lc.status).toBe(201);
    classId = lc.body.liveClass._id;
  });

  test('sockets without a valid token cannot connect', async () => {
    await expect(open('garbage')).rejects.toThrow(/Authentication failed/);
  });

  test('scheduling rules: students cannot schedule/start; past dates are rejected', async () => {
    expect((await api().post(`/api/courses/${ctx.courseId}/live-classes`).set(auth(student.token)).send({ title: 'Nope', scheduledAt: new Date(Date.now() + 1e6).toISOString() })).status).toBe(403);
    expect((await api().post(`/api/courses/${ctx.courseId}/live-classes`).set(auth(ctx.instructor.token)).send({ title: 'Old', scheduledAt: '2020-01-01T00:00:00Z' })).status).toBe(400);
    expect((await api().post(`/api/live-classes/${classId}/start`).set(auth(student.token))).status).toBe(403);
    expect((await api().get(`/api/courses/${ctx.courseId}/live-classes`).set(auth(stranger.token))).status).toBe(403);
    expect((await api().get(`/api/courses/${ctx.courseId}/live-classes`).set(auth(student.token))).body.liveClasses).toHaveLength(1);
  });

  test('cannot join before the class is live', async () => {
    teacher = await open(ctx.instructor.token);
    const r = await call(teacher, 'join', { classId });
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/not live/i) });
  });

  test('instructor goes live and joins; student joins and both see each other', async () => {
    expect((await api().post(`/api/live-classes/${classId}/start`).set(auth(ctx.instructor.token))).body.liveClass.status).toBe('live');
    expect((await api().post(`/api/live-classes/${classId}/start`).set(auth(ctx.instructor.token))).status).toBe(409);
    const t = await call(teacher, 'join', { classId });
    expect(t).toMatchObject({ ok: true, role: 'instructor', peers: [] });

    student = await open(student.token);
    const joined = next(teacher, 'peer-joined');
    const s = await call(student, 'join', { classId });
    expect(s.ok).toBe(true);
    expect(s.role).toBe('student');
    expect(s.peers).toHaveLength(1);
    expect(s.peers[0]).toMatchObject({ socketId: t.selfId, role: 'instructor' });
    expect((await joined)).toMatchObject({ socketId: s.selfId, name: 'asha' });
    student.selfId = s.selfId;
    teacher.selfId = t.selfId;
  });

  test('non-enrolled users are rejected', async () => {
    const x = await open(stranger.token);
    expect(await call(x, 'join', { classId })).toMatchObject({ ok: false, error: expect.stringMatching(/Enroll/) });
  });

  test('WebRTC offer/answer/ICE are relayed only to the addressed peer', async () => {
    const offer = { type: 'offer', sdp: 'v=0 fake-sdp' };
    const got = next(student, 'signal');
    teacher.emit('signal', { to: student.selfId, data: offer });
    expect(await got).toEqual({ from: teacher.selfId, data: offer });

    const back = next(teacher, 'signal');
    student.emit('signal', { to: teacher.selfId, data: { candidate: 'candidate:1 1 udp ...' } });
    expect((await back).data.candidate).toMatch(/^candidate:1/);

    // a socket that never joined the room cannot inject signals
    const outsider = await open(stranger.token);
    let leaked = false;
    student.once('signal', () => { leaked = true; });
    outsider.emit('signal', { to: student.selfId, data: { evil: true } });
    await new Promise((r) => setTimeout(r, 300));
    expect(leaked).toBe(false);
  });

  test('chat is broadcast with sender name and kept as history for late joiners', async () => {
    const at = next(teacher, 'chat');
    student.emit('chat', { text: '  Hello sir!  ' });
    expect(await at).toMatchObject({ from: 'asha', role: 'student', text: 'Hello sir!' });
    const late = await open(ctx.instructor.token);
    const r = await call(late, 'join', { classId });
    expect(r.history.map((m) => m.text)).toEqual(['Hello sir!']);
    late.close();
  });

  test('media-state is relayed; peer-left fires on disconnect', async () => {
    const ms = next(teacher, 'media-state');
    student.emit('media-state', { audio: false, video: true });
    expect(await ms).toMatchObject({ socketId: student.selfId, audio: false, video: true });
    const left = next(teacher, 'peer-left');
    student.close();
    expect((await left).socketId).toBe(student.selfId);
  });

  test('ending the class notifies the room', async () => {
    const ended = next(teacher, 'class-ended');
    expect((await api().post(`/api/live-classes/${classId}/end`).set(auth(ctx.instructor.token))).body.liveClass.status).toBe('ended');
    expect((await ended).classId).toBe(classId);
    expect((await api().post(`/api/live-classes/${classId}/end`).set(auth(ctx.instructor.token))).status).toBe(409);
  });

  test('room capacity is enforced (instructor + 6 students)', async () => {
    const lc = await api().post(`/api/courses/${ctx.courseId}/live-classes`).set(auth(ctx.instructor.token)).send({ title: 'Big class', scheduledAt: new Date(Date.now() + 7200e3).toISOString() });
    const id = lc.body.liveClass._id;
    await api().post(`/api/live-classes/${id}/start`).set(auth(ctx.instructor.token));
    const host = await open(ctx.instructor.token);
    expect((await call(host, 'join', { classId: id })).ok).toBe(true);
    const results = [];
    for (let i = 0; i < 7; i += 1) {
      const u = await makeUser('student', `s${i}`);
      await api().post(`/api/courses/${ctx.courseId}/enroll`).set(auth(u.token));
      const sk = await open(u.token);
      results.push(await call(sk, 'join', { classId: id }));
    }
    expect(results.filter((r) => r.ok)).toHaveLength(6);
    expect(results[6]).toMatchObject({ ok: false, error: 'Class is full' });
  });
});
