const router = require('express').Router();
const service = require('./enrollments.service');
const { authenticate } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');

router.use(['/courses/:courseId/enroll', '/enrollments'], authenticate);
router.post('/courses/:courseId/enroll', asyncHandler(async (req, res) => {
  const { enrollment, created } = await service.enrollFree(req.user, req.params.courseId);
  res.status(created ? 201 : 200).json({ success: true, enrollment });
}));
router.get('/enrollments/mine', asyncHandler(async (req, res) => res.json({ success: true, enrollments: await service.listMine(req.user.id) })));

module.exports = router;
