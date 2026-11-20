const router = require('express').Router();
const { z } = require('zod');
const service = require('./users.service');
const validate = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');

router.use(authenticate);
router.get('/me', asyncHandler(async (req, res) => res.json({ success: true, user: await service.getMe(req.user.id) })));
router.patch(
  '/me',
  validate({ body: z.object({ name: z.string().trim().min(2).max(80).optional(), bio: z.string().max(500).optional() }) }),
  asyncHandler(async (req, res) => res.json({ success: true, user: await service.updateMe(req.user.id, req.body) }))
);

module.exports = router;
