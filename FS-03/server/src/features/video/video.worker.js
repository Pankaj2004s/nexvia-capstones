const { Worker } = require('bullmq');
const { createRedis } = require('../../config/redis');
const { QUEUE_NAME } = require('./video.queue');
const { processVideo } = require('./video.processor');
const logger = require('../../shared/utils/logger');

function startWorker({ concurrency = 2 } = {}) {
  const worker = new Worker(
    QUEUE_NAME,
    (job) => processVideo(job.data.videoId, { attemptsMade: job.attemptsMade, maxAttempts: job.opts.attempts || 3 }),
    { connection: createRedis(), concurrency }
  );
  worker.on('completed', (job) => logger.info(`Job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.warn(`Job ${job && job.id} failed (attempt ${job && job.attemptsMade}): ${err.message}`));
  return worker;
}

module.exports = { startWorker };
