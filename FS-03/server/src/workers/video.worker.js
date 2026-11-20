// Standalone worker process: `npm run worker`. Run this separately in production.
const { connectDb } = require('../config/db');
const { startWorker } = require('../features/video/video.worker');
const logger = require('../shared/utils/logger');

connectDb()
  .then(() => { startWorker(); logger.info('Video worker started, waiting for jobs'); })
  .catch((e) => { console.error(e); process.exit(1); });
