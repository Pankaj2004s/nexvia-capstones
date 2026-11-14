const router = require('express').Router();
const service = require('./quizzes.service');
const v = require('./quizzes.validation');
const validate = require('../../shared/middleware/validate');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');

router.use(['/courses/:courseId/quizzes', '/quizzes'], authenticate);
const staff = authorize('instructor', 'admin');

router.post('/courses/:courseId/quizzes', staff, validate({ body: v.create }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, quiz: await service.create(req.user, req.params.courseId, req.body) })));
router.get('/courses/:courseId/quizzes',
  asyncHandler(async (req, res) => res.json({ success: true, quizzes: await service.listForCourse(req.user, req.params.courseId) })));
router.get('/quizzes/:id', asyncHandler(async (req, res) => res.json({ success: true, quiz: await service.getForUser(req.user, req.params.id) })));
router.patch('/quizzes/:id', staff, validate({ body: v.update }),
  asyncHandler(async (req, res) => res.json({ success: true, quiz: await service.update(req.user, req.params.id, req.body) })));
router.delete('/quizzes/:id', staff, asyncHandler(async (req, res) => { await service.remove(req.user, req.params.id); res.json({ success: true }); }));
router.post('/quizzes/:id/attempts', validate({ body: v.attempt }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, result: await service.submitAttempt(req.user, req.params.id, req.body.answers) })));
router.get('/quizzes/:id/attempts', asyncHandler(async (req, res) => res.json({ success: true, attempts: await service.myAttempts(req.user.id, req.params.id) })));

module.exports = router;
