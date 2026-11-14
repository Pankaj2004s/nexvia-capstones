const router = require('express').Router();
const { z } = require('zod');
const users = require('../users/users.service');
const courses = require('../courses/courses.service');
const earnings = require('../earnings/earnings.service');
const validate = require('../../shared/middleware/validate');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');

router.use(authenticate, authorize('admin'));

router.get('/users', validate({ query: z.object({ role: z.enum(['student', 'instructor', 'admin']).optional(), q: z.string().optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(20) }) }),
  asyncHandler(async (req, res) => res.json({ success: true, ...(await users.listUsers(req.query)) })));

router.patch('/users/:id', validate({ body: z.object({ role: z.enum(['student', 'instructor', 'admin']).optional(), isActive: z.boolean().optional() }) }),
  asyncHandler(async (req, res) => res.json({ success: true, user: await users.adminUpdateUser(req.user.id, req.params.id, req.body) })));

router.get('/courses', validate({ query: z.object({ status: z.enum(['draft', 'pending', 'published', 'rejected']).default('pending') }) }),
  asyncHandler(async (req, res) => res.json({ success: true, courses: await courses.listByStatus(req.query.status) })));

router.post('/courses/:id/approve', asyncHandler(async (req, res) => res.json({ success: true, course: await courses.setStatus(req.params.id, 'published') })));
router.post('/courses/:id/reject', asyncHandler(async (req, res) => res.json({ success: true, course: await courses.setStatus(req.params.id, 'rejected') })));

router.get('/stats', asyncHandler(async (req, res) => {
  const [byRole, revenue] = await Promise.all([users.countByRole(), earnings.platformSummary()]);
  res.json({ success: true, users: byRole, revenue: revenue.totals, perDay: revenue.perDay, topCourses: revenue.perCourse.slice(0, 5) });
}));

module.exports = router;
