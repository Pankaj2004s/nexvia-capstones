const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { api, resetDb, closeDb, makeUser, auth } = require('./helpers');
const { startWorker } = require('../src/features/video/video.worker');
const { closeQueue } = require('../src/features/video/video.queue');
const { processVideo } = require('../src/features/video/video.processor');
const Video = require('../src/features/video/video.model');
const { getStorage } = require('../src/shared/storage');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-vid-'));
const sample = path.join(tmp, 'sample.mp4');
let worker;

beforeAll(async () => {
  await resetDb();
  // 6s 1280x720 test pattern + sine tone
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc=duration=6:size=1280x720:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=6', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', sample], { stdio: 'ignore' });
  worker = startWorker({ concurrency: 1 });
});
afterAll(async () => {
  await worker.close();
  await closeQueue();
  await closeDb();
});

const waitFor = async (fn, ms = 90000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const v = await fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('timed out waiting');
};

describe('video upload -> BullMQ -> FFmpeg HLS -> signed delivery', () => {
  let teacher; let student; let courseId; let lessonId; let videoId; let playback;
  const t0 = Date.now();

  beforeAll(async () => {
    teacher = await makeUser('instructor', 'teacher');
    const admin = await makeUser('admin', 'boss');
    student = await makeUser('student');
    const c = await api().post('/api/courses').set(auth(teacher.token)).send({ title: 'Video Course', description: 'Has a real video lesson.', category: 'Media', price: 0 });
    courseId = c.body.course._id;
    const l = await api().post(`/api/courses/${courseId}/lessons`).set(auth(teacher.token)).send({ title: 'Watch me', type: 'video' });
    lessonId = l.body.lesson._id;
    await api().post(`/api/courses/${courseId}/submit`).set(auth(teacher.token));
    await api().post(`/api/admin/courses/${courseId}/approve`).set(auth(admin.token));
  });

  test('only the course owner can upload; non-video files are rejected', async () => {
    expect((await api().post(`/api/lessons/${lessonId}/video`).set(auth(student.token)).attach('video', sample)).status).toBe(403);
    const other = await makeUser('instructor', 'other');
    expect((await api().post(`/api/lessons/${lessonId}/video`).set(auth(other.token)).attach('video', sample)).status).toBe(403);
    const txt = path.join(tmp, 'notes.txt');
    fs.writeFileSync(txt, 'not a video');
    expect((await api().post(`/api/lessons/${lessonId}/video`).set(auth(teacher.token)).attach('video', txt)).status).toBe(400);
    expect((await api().post(`/api/lessons/${lessonId}/video`).set(auth(teacher.token))).status).toBe(400);
  });

  test('upload returns 202 and queues the job', async () => {
    const res = await api().post(`/api/lessons/${lessonId}/video`).set(auth(teacher.token)).attach('video', sample);
    expect(res.status).toBe(202);
    videoId = res.body.video.id;
    expect(['queued', 'processing']).toContain(res.body.video.status);
  });

  test('playback is refused while processing / before enrollment', async () => {
    await api().post(`/api/courses/${courseId}/enroll`).set(auth(student.token));
    const early = await api().get(`/api/lessons/${lessonId}/playback`).set(auth(student.token));
    expect([409, 404]).toContain(early.status);
    const stranger = await makeUser('student');
    expect((await api().get(`/api/lessons/${lessonId}/playback`).set(auth(stranger.token))).status).toBe(403);
  });

  test('worker converts to HLS (360p + 720p) and reports progress to 100', async () => {
    const video = await waitFor(async () => {
      const r = await api().get(`/api/videos/${videoId}`).set(auth(teacher.token));
      if (r.body.video.status === 'failed') throw new Error(`failed: ${r.body.video.error}`);
      return r.body.video.status === 'ready' ? r.body.video : null;
    });
    expect(video.progress).toBe(100);
    expect(video.renditions.map((r) => r.name)).toEqual(['360p', '720p']);
    expect(Math.round(video.durationSec)).toBe(6);
    console.log(`[perf] 6s 720p video processed in ${video.processingMs} ms (wall ${Date.now() - t0} ms)`);
    // lesson picked up the duration
    const lesson = await api().get(`/api/lessons/${lessonId}`).set(auth(student.token));
    expect(Math.round(lesson.body.lesson.durationSec)).toBe(6);
  });

  test('outputs exist in storage: master playlist, rendition playlists, segments, thumbnail', async () => {
    const st = getStorage();
    expect(await st.exists(`videos/${videoId}/master.m3u8`)).toBe(true);
    expect(await st.exists(`videos/${videoId}/360p/index.m3u8`)).toBe(true);
    expect(await st.exists(`videos/${videoId}/720p/seg_000.ts`)).toBe(true);
    expect(await st.exists(`videos/${videoId}/thumb.jpg`)).toBe(true);
    const master = (await st.readBuffer(`videos/${videoId}/master.m3u8`)).toString();
    expect(master).toMatch(/RESOLUTION=1280x720/);
    expect(master).toMatch(/RESOLUTION=640x360/);
  });

  test('playback session is a signed local URL (CloudFront not configured)', async () => {
    const res = await api().get(`/api/lessons/${lessonId}/playback`).set(auth(student.token));
    expect(res.status).toBe(200);
    playback = res.body.playback;
    expect(playback.mode).toBe('local-signed');
    expect(playback.playlistUrl).toMatch(/\/api\/media\/videos\/.+\/master\.m3u8\?token=/);
  });

  test('media route: master is rewritten with tokens; segments stream; bad tokens are 403', async () => {
    const u = new URL(playback.playlistUrl);
    const route = `${u.pathname}${u.search}`;
    const master = await api().get(route);
    expect(master.status).toBe(200);
    expect(master.headers['content-type']).toMatch(/mpegurl/);
    expect(master.text).toMatch(/360p\/index\.m3u8\?token=/);

    const token = u.searchParams.get('token');
    const rendLine = master.text.split('\n').find((l) => l.startsWith('360p/'));
    const rend = await api().get(`/api/media/videos/${videoId}/${rendLine}`);
    expect(rend.status).toBe(200);
    const segLine = rend.text.split('\n').find((l) => l.startsWith('seg_'));
    expect(segLine).toMatch(/\?token=/);
    const seg = await api().get(`/api/media/videos/${videoId}/360p/${segLine}`).buffer(true).parse((res, cb) => { const c = []; res.on('data', (d) => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });
    expect(seg.status).toBe(200);
    expect(seg.body.length).toBeGreaterThan(1000);
    expect(seg.body[0]).toBe(0x47); // MPEG-TS sync byte

    expect((await api().get(`/api/media/videos/${videoId}/master.m3u8`)).status).toBe(403); // no token
    expect((await api().get(`/api/media/videos/${videoId}/master.m3u8?token=abc`)).status).toBe(403);
    expect((await api().get(`/api/media/videos/someOtherVideo/master.m3u8?token=${token}`)).status).toBe(403); // token is scoped
    expect((await api().get(`/api/media/videos/${videoId}/..%2F..%2Fstorage%2Fx?token=${token}`)).status).toBeGreaterThanOrEqual(400);
  });
});

describe('failure handling', () => {
  test('garbage input is marked failed only on the final attempt (retry first)', async () => {
    const st = getStorage();
    const mongoose = require('mongoose');
    const id = new mongoose.Types.ObjectId();
    await st.putBuffer(Buffer.from('this is definitely not a video'), `originals/${id}/bad.mp4`);
    await Video.create({ _id: id, course: new mongoose.Types.ObjectId(), lesson: new mongoose.Types.ObjectId(), uploader: new mongoose.Types.ObjectId(), originalKey: `originals/${id}/bad.mp4`, status: 'queued' });

    await expect(processVideo(id, { attemptsMade: 0, maxAttempts: 3 })).rejects.toThrow();
    expect((await Video.findById(id)).status).toBe('queued'); // will be retried by BullMQ

    await expect(processVideo(id, { attemptsMade: 2, maxAttempts: 3 })).rejects.toThrow();
    const v = await Video.findById(id);
    expect(v.status).toBe('failed');
    expect(v.error).toBeTruthy();
  });
});
