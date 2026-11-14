const IORedis = require('ioredis');
const { redisUrl } = require('./env');

// BullMQ requires maxRetriesPerRequest: null on its connections.
function createRedis() {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

module.exports = { createRedis };
