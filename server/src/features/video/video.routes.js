const router = require('express').Router();
const os = require('os');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const service = require('./video.service');
const { authenticate, optionalAuth, authorize } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');
const AppError = require('../../shared/utils/AppError');
const { getStorage } = require('../../shared/storage');
const { verifyMediaToken } = require('../../shared/storage/delivery');

const tmpDir = path.join(os.tmpdir(), 'learnsphere-uploads');
fs.mkdirSync(tmpDir, { recursive: true });
const upload = multer({
  dest: tmpDir,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => (file.mimetype.startsWith('video/') ? cb(null, true) : cb(new AppError('Only video files are allowed', 400))),
});

router.post('/lessons/:lessonId/video', authenticate, authorize('instructor', 'admin'), upload.single('video'),
  asyncHandler(async (req, res) => {
    const video = await service.upload(req.user, req.params.lessonId, req.file);
    res.status(202).json({ success: true, video: { id: video.id, status: video.status, progress: video.progress } });
  }));

router.get('/videos/:id', authenticate, authorize('instructor', 'admin'),
  asyncHandler(async (req, res) => {
    const v = await service.getStatus(req.user, req.params.id);
    res.json({ success: true, video: { id: v.id, status: v.status, progress: v.progress, error: v.error, durationSec: v.durationSec, processingMs: v.processingMs, renditions: v.renditions, attempts: v.attempts } });
  }));

router.get('/lessons/:lessonId/playback', optionalAuth,
  asyncHandler(async (req, res) => res.json({ success: true, playback: await service.playback(req.user, req.params.lessonId) })));

// Local signed delivery (used when CloudFront is not configured). Playlists are rewritten so every segment carries the token.
router.get(/^\/media\/(.+)$/, asyncHandler(async (req, res) => {
  const key = req.params[0];
  const token = req.query.token;
  let allowed = false;
  try { allowed = Boolean(token) && verifyMediaToken(String(token), key); } catch (e) { allowed = false; }
  if (!allowed) throw new AppError('Invalid or expired media token', 403);

  const storage = getStorage();
  if (!storage.resolve) throw new AppError('Media is served via CloudFront for this storage driver', 404);
  if (!(await storage.exists(key))) throw new AppError('Media not found', 404);

  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
  if (key.endsWith('.m3u8')) {
    const text = (await storage.readBuffer(key)).toString('utf8');
    const rewritten = text.split('\n').map((line) => (line && !line.startsWith('#') ? `${line}?token=${token}` : line)).join('\n');
    res.set('Content-Type', 'application/vnd.apple.mpegurl').set('Cache-Control', 'no-store').send(rewritten);
    return;
  }
  res.sendFile(storage.resolve(key));
}));

module.exports = router;
