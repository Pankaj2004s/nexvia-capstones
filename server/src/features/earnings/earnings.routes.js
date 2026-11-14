const router = require('express').Router();
const service = require('./earnings.service');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');

router.get('/earnings/dashboard', authenticate, authorize('instructor', 'admin'),
  asyncHandler(async (req, res) => res.json({ success: true, dashboard: await service.instructorDashboard(req.user.id) })));

module.exports = router;
