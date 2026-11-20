const { resetDb, closeDb } = require('./helpers');
const Course = require('../src/features/courses/course.model');
const Lesson = require('../src/features/lessons/lesson.model');
const User = require('../src/features/auth/user.model');
const Video = require('../src/features/video/video.model');
const { getStorage } = require('../src/shared/storage');
const { seedDatabase, restoreDemoVideo, bootstrapDemo } = require('../src/seed');
const { CATALOG, thumbName } = require('../src/seed/catalog');

const quick = { seconds: 2, size: '640x360' };

beforeAll(resetDb);
afterAll(closeDb);

describe('seed and demo bootstrap', () => {
  test('seeds users and the full catalog with local thumbnail paths', async () => {
    const { courses } = await seedDatabase();
    expect(courses).toBe(CATALOG.length);
    expect(await User.countDocuments()).toBe(5);
    const first = await Course.findOne({ title: CATALOG[0][0] });
    expect(first.thumbnail).toBe(`/thumbs/${thumbName(CATALOG[0][0])}.svg`);
    expect(first.thumbnail).not.toMatch(/^https?:/);
    expect(await Lesson.countDocuments({ course: first._id, isPreview: true })).toBe(1);
  });

  test('every course has a distinct thumbnail name', () => {
    const names = CATALOG.map(([t]) => thumbName(t));
    expect(new Set(names).size).toBe(CATALOG.length);
  });

  test('bootstrap on a database that already has users does not reseed, but builds a missing demo video', async () => {
    expect(await bootstrapDemo(quick)).toBe('restored');
    const demo = await Video.findOne({ originalName: 'demo.mp4' });
    expect(demo.status).toBe('ready');
    const lesson = await Lesson.findById(demo.lesson);
    expect(String(lesson.video)).toBe(String(demo._id));
    expect(await User.countDocuments()).toBe(5);
  });

  test('restoreDemoVideo does nothing while the files exist, and rebuilds them after the disk is wiped', async () => {
    expect(await restoreDemoVideo(quick)).toBe(false);
    const demo = await Video.findOne({ originalName: 'demo.mp4' });
    await getStorage().remove(demo.hlsPrefix);
    expect(await restoreDemoVideo(quick)).toBe(true);
    const rebuilt = await Video.findOne({ originalName: 'demo.mp4' });
    expect(String(rebuilt._id)).not.toBe(String(demo._id));
    expect(await getStorage().exists(`${rebuilt.hlsPrefix}/master.m3u8`)).toBe(true);
    expect(await Video.countDocuments({ originalName: 'demo.mp4' })).toBe(1);
  });

  test('bootstrap seeds an empty database including the video', async () => {
    await resetDb();
    expect(await bootstrapDemo(quick)).toBe('seeded');
    expect(await Course.countDocuments()).toBe(CATALOG.length);
    expect(await Video.countDocuments({ status: 'ready' })).toBe(1);
  });
});
