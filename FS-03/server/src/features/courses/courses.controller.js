const service = require('./courses.service');
const asyncHandler = require('../../shared/utils/asyncHandler');

exports.create = asyncHandler(async (req, res) => res.status(201).json({ success: true, course: await service.create(req.user, req.body) }));
exports.list = asyncHandler(async (req, res) => res.json({ success: true, ...(await service.list(req.query)) }));
exports.mine = asyncHandler(async (req, res) => res.json({ success: true, courses: await service.listMine(req.user.id) }));
exports.detail = asyncHandler(async (req, res) => res.json({ success: true, course: await service.getDetail(req.params.idOrSlug, req.user) }));
exports.update = asyncHandler(async (req, res) => res.json({ success: true, course: await service.update(req.user, req.params.id, req.body) }));
exports.submit = asyncHandler(async (req, res) => res.json({ success: true, course: await service.submitForReview(req.user, req.params.id) }));
exports.remove = asyncHandler(async (req, res) => { await service.remove(req.user, req.params.id); res.json({ success: true }); });
