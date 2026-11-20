require('dotenv').config();
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';
const req = (name, devDefault) => {
  const v = process.env[name] || (isProd ? undefined : devDefault);
  if (v === undefined) throw new Error(`Missing required env var ${name}`);
  return v;
};

module.exports = {
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  publicApiUrl: process.env.PUBLIC_API_URL || 'http://localhost:5000',
  mongoUri: req('MONGO_URI', 'mongodb://127.0.0.1:27017/learnsphere'),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  jwt: {
    accessSecret: req('JWT_ACCESS_SECRET', 'dev-access-secret'),
    refreshSecret: req('JWT_REFRESH_SECRET', 'dev-refresh-secret'),
    accessTtl: '15m',
    refreshTtlMs: 7 * 24 * 3600 * 1000,
  },
  mediaSecret: req('MEDIA_SIGNING_SECRET', 'dev-media-secret'),
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    s3Bucket: process.env.S3_BUCKET,
    s3Region: process.env.S3_REGION || 'ap-south-1',
    localDir: process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), 'storage'),
  },
  cloudfront: {
    domain: process.env.CLOUDFRONT_DOMAIN,
    keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
    privateKey: (process.env.CLOUDFRONT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },
  instructorShare: Number(process.env.INSTRUCTOR_SHARE) || 0.8,
  runWorkerInline: process.env.RUN_WORKER_INLINE === 'true',
  // seed an empty database once at boot and rebuild the demo video if its files are gone (free hosts wipe the disk)
  seedDemo: process.env.SEED_DEMO === 'true',
};
