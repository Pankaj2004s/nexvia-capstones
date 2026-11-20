const fs = require('fs');
const os = require('os');
const path = require('path');
const Video = require('./video.model');
const ffmpeg = require('./ffmpeg');
const { getStorage } = require('../../shared/storage');
const logger = require('../../shared/utils/logger');

const lessons = () => require('../lessons/lessons.service');

// The actual job: original -> HLS renditions (+ master playlist, thumbnail) -> storage.
async function processVideo(videoId, { attemptsMade = 0, maxAttempts = 3, storage = getStorage() } = {}) {
  const video = await Video.findById(videoId);
  if (!video) throw new Error(`Video ${videoId} not found`);
  const started = Date.now();
  const work = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ls-video-'));
  try {
    await Video.updateOne({ _id: videoId }, { status: 'processing', progress: 1, attempts: attemptsMade + 1, error: null });
    const input = path.join(work, 'original');
    await storage.downloadToFile(video.originalKey, input);

    const info = await ffmpeg.probe(input);
    const renditions = ffmpeg.chooseRenditions(info.height);
    const outDir = path.join(work, 'hls');
    let lastSaved = 0;
    for (let i = 0; i < renditions.length; i += 1) {
      await ffmpeg.transcodeRendition({
        input, outDir, rendition: renditions[i], durationSec: info.durationSec, hasAudio: info.hasAudio,
        onProgress: async (frac) => {
          const pct = Math.min(95, Math.round(((i + frac) / renditions.length) * 95));
          if (pct - lastSaved >= 5) { lastSaved = pct; await Video.updateOne({ _id: videoId }, { progress: pct }).catch(() => {}); }
        },
      });
    }
    await fs.promises.writeFile(path.join(outDir, 'master.m3u8'), ffmpeg.masterPlaylist(renditions, info.width, info.height));
    await ffmpeg.makeThumbnail(input, path.join(outDir, 'thumb.jpg'), info.durationSec);

    const prefix = `videos/${videoId}`;
    await storage.putDir(outDir, prefix);

    await Video.updateOne({ _id: videoId }, {
      status: 'ready', progress: 100, hlsPrefix: prefix, thumbnailKey: `${prefix}/thumb.jpg`,
      durationSec: info.durationSec, processingMs: Date.now() - started,
      renditions: renditions.map((r) => ({ name: r.name, height: r.height, bandwidth: r.bandwidth })),
    });
    await lessons().attachVideo(video.lesson, video._id, info.durationSec);
    logger.info(`Video ${videoId} ready in ${Date.now() - started}ms`);
    return { videoId: String(videoId), renditions: renditions.map((r) => r.name), durationSec: info.durationSec };
  } catch (err) {
    const finalAttempt = attemptsMade + 1 >= maxAttempts;
    await Video.updateOne({ _id: videoId }, { status: finalAttempt ? 'failed' : 'queued', error: err.message.slice(0, 500) });
    throw err; // rethrow so BullMQ applies retry/backoff
  } finally {
    await fs.promises.rm(work, { recursive: true, force: true });
  }
}

module.exports = { processVideo };
