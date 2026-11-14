const router = require('express').Router();
const service = require('./progress.service');
const { authenticate } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');

router.use('/progress', authenticate);
router.post('/progress/lessons/:lessonId/complete', asyncHandler(async (req, res) =>
  res.json({ success: true, progress: await service.completeLesson(req.user, req.params.lessonId) })));
router.get('/progress/courses/:courseId', asyncHandler(async (req, res) =>
  res.json({ success: true, progress: await service.getProgress(req.user.id, req.params.courseId), status: await service.completionStatus(req.user.id, req.params.courseId) })));

module.exports = router;
