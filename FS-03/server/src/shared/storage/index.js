const cfg = require('../../config/env');
const LocalStorageAdapter = require('./local.adapter');
const S3StorageAdapter = require('./s3.adapter');
const logger = require('../utils/logger');

let instance;

// Picks S3 when configured, otherwise falls back to local disk and says so in the log.
function getStorage() {
  if (instance) return instance;
  if (cfg.storage.driver === 's3' && cfg.storage.s3Bucket) {
    instance = new S3StorageAdapter({ bucket: cfg.storage.s3Bucket, region: cfg.storage.s3Region });
  } else {
    if (cfg.storage.driver === 's3') logger.warn('STORAGE_DRIVER=s3 but S3_BUCKET missing: falling back to local disk');
    instance = new LocalStorageAdapter(cfg.storage.localDir);
  }
  logger.info(`Storage driver: ${instance.name}`);
  return instance;
}

const setStorage = (s) => { instance = s; };

module.exports = { getStorage, setStorage };
