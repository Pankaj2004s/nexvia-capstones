const router = require('express').Router();
const service = require('./certificates.service');
const { authenticate } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');

// public: anyone can verify a certificate id
router.get('/certificates/verify/:certId', asyncHandler(async (req, res) => {
  const result = await service.verify(req.params.certId);
  res.status(result.valid ? 200 : 404).json({ success: result.valid, ...result });
}));

router.use(['/courses/:courseId/certificate', '/certificates/mine', '/certificates/:certId/download'], authenticate);
router.post('/courses/:courseId/certificate', asyncHandler(async (req, res) => res.status(201).json({ success: true, certificate: await service.issue(req.user, req.params.courseId) })));
router.get('/certificates/mine', asyncHandler(async (req, res) => res.json({ success: true, certificates: await service.listMine(req.user.id) })));
router.get('/certificates/:certId/download', asyncHandler(async (req, res) => {
  const { cert, buffer } = await service.download(req.user, req.params.certId);
  res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${cert.certId}.pdf"` }).send(buffer);
}));

module.exports = router;
