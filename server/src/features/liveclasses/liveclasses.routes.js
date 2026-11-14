const router = require('express').Router();
const service = require('./liveclasses.service');
const v = require('./liveclasses.validation');
const validate = require('../../shared/middleware/validate');
const { authenticate, authorize } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');
const socket = require('./liveclasses.socket');

router.use(['/live-classes', '/courses/:courseId/live-classes'], authenticate);
const staff = authorize('instructor', 'admin');

router.get('/live-classes/ice-servers', (req, res) => res.json({ success: true, iceServers: service.iceServers(), maxParticipants: service.MAX_PARTICIPANTS }));
router.get('/live-classes/mine/upcoming', asyncHandler(async (req, res) => res.json({ success: true, liveClasses: await service.upcomingForUser(req.user) })));
router.post('/courses/:courseId/live-classes', staff, validate({ body: v.create }),
  asyncHandler(async (req, res) => res.status(201).json({ success: true, liveClass: await service.schedule(req.user, req.params.courseId, req.body) })));
router.get('/courses/:courseId/live-classes', asyncHandler(async (req, res) => res.json({ success: true, liveClasses: await service.listForCourse(req.user, req.params.courseId) })));
router.post('/live-classes/:id/start', staff, asyncHandler(async (req, res) => res.json({ success: true, liveClass: await service.setStatus(req.user, req.params.id, 'live') })));
router.post('/live-classes/:id/end', staff, asyncHandler(async (req, res) => {
  const liveClass = await service.setStatus(req.user, req.params.id, 'ended');
  socket.notifyEnded(String(liveClass._id));
  res.json({ success: true, liveClass });
}));
router.delete('/live-classes/:id', staff, asyncHandler(async (req, res) => { await service.remove(req.user, req.params.id); res.json({ success: true }); }));

module.exports = router;
