const http = require('http');
const app = require('./app');
const cfg = require('./config/env');
const { connectDb, disconnectDb } = require('./config/db');
const { attachLiveSocket } = require('./features/liveclasses');
const logger = require('./shared/utils/logger');

async function main() {
  await connectDb();
  logger.info('MongoDB connected');
  const server = http.createServer(app);
  attachLiveSocket(server);

  let worker;
  if (cfg.runWorkerInline) {
    worker = require('./features/video').startWorker();
    logger.info('Video worker running inline (set RUN_WORKER_INLINE=false and run `npm run worker` separately in production)');
  }

  server.listen(cfg.port, () => logger.info(`LearnSphere API on port ${cfg.port} (${cfg.isProd ? 'production' : 'development'})`));

  const shutdown = async (sig) => {
    logger.info(`${sig} received, shutting down`);
    server.close();
    if (worker) await worker.close();
    await disconnectDb();
    process.exit(0);
  };
  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => shutdown(s)));
}

main().catch((e) => { console.error('Failed to start', e); process.exit(1); });
