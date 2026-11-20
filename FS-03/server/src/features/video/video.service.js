const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Video = require('./video.model');
const AppError = require('../../shared/utils/AppError');
const { getStorage } = require('../../shared/storage');
const { createPlaybackSession } = require('../../shared/storage/delivery');
const { enqueueVideo } = require('./video.queue');
const { assertId } = require('../../shared/utils/helpers');

const lessons = () => require('../lessons/lessons.service');
const courses = () => require('../courses/courses.service');

async function upload(user, lessonId, file) {
  if (!file) throw new AppError('No video file uploaded (field name: video)', 400);
  const cleanup = () => fs.promises.rm(file.path, { force: true });
  try {
    const lesson = await lessons().getLessonOrThrow(lessonId);
    courses().assertManage(await courses().getCourseOrThrow(lesson.course), user);
    if (lesson.type !== 'video') throw new AppError('This lesson is not a video lesson', 400);

    const id = new mongoose.Types.ObjectId();
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const originalKey = `originals/${id}/${safeName}`;
    await getStorage().putFile(file.path, originalKey);
    const video = await Video.create({
      _id: id, course: lesson.course, lesson: lesson._id, uploader: user.id,
      originalKey, originalName: file.originalname, sizeBytes: file.size, status: 'queued',
    });
    try {
      await enqueueVideo(video._id);
    } catch (e) {
      await Video.updateOne({ _id: id }, { status: 'failed', error: `Could not enqueue job: ${e.message}` });
      throw new AppError('Video queue is unavailable, try again shortly', 503);
    }
    return video;
  } finally {
    await cleanup();
  }
}

async function getStatus(user, videoId) {
  assertId(videoId, 'video id');
  const video = await Video.findById(videoId);
  if (!video) throw new AppError('Video not found', 404);
  courses().assertManage(await courses().getCourseOrThrow(video.course), user);
  return video;
}

async function playback(user, lessonId) {
  const { lesson } = await lessons().assertAccess(user, lessonId);
  if (!lesson.video) throw new AppError('No video attached to this lesson yet', 404);
  const video = await Video.findById(lesson.video);
  if (!video || video.status !== 'ready') {
    throw new AppError('Video is still processing', 409, { status: video ? video.status : 'missing', progress: video ? video.progress : 0 });
  }
  return { ...createPlaybackSession(video.hlsPrefix), durationSec: video.durationSec, renditions: video.renditions, thumbnailKey: video.thumbnailKey };
}

module.exports = { upload, getStatus, playback };
