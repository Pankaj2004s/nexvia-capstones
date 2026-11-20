const router = require('express').Router();
const service = require('./lessons.service');
const v = require('./lessons.validation');
const validate = require('../../shared/middleware/validate');
const { authenticate, optionalAuth, authorize } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');

const staff = [authenticate, authorize('instructor', 'admin')];

router.post('/courses/:courseId/lessons', ...staff, validate({ body: v.create }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, lesson: await service.create(req.user, req.params.courseId, req.body) })));

router.patch('/lessons/:id', ...staff, validate({ body: v.update }),
  asyncHandler(async (req, res) => res.json({ success: true, lesson: await service.update(req.user, req.params.id, req.body) })));

router.delete('/lessons/:id', ...staff,
  asyncHandler(async (req, res) => { await service.remove(req.user, req.params.id); res.json({ success: true }); }));

// full lesson (text content) only for enrolled users, the owner, admins, or free previews
router.get('/lessons/:id', optionalAuth,
  asyncHandler(async (req, res) => {
    const { lesson } = await service.assertAccess(req.user, req.params.id);
    res.json({ success: true, lesson });
  }));

module.exports = router;
