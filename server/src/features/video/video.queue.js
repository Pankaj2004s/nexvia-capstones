const { Queue } = require('bullmq');
const { createRedis } = require('../../config/redis');

const QUEUE_NAME = 'video-processing';
let queue;

const getQueue = () => {
  if (!queue) queue = new Queue(QUEUE_NAME, { connection: createRedis() });
  return queue;
};

// 3 attempts with exponential backoff; jobId makes enqueueing the same video idempotent.
async function enqueueVideo(videoId) {
  return getQueue().add('transcode', { videoId: String(videoId) }, {
    jobId: `video-${videoId}-${Date.now()}`,
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 24 * 3600 },
  });
}

const closeQueue = async () => { if (queue) { await queue.close(); queue = null; } };

module.exports = { QUEUE_NAME, getQueue, enqueueVideo, closeQueue };
