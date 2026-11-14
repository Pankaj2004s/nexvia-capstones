const router = require('express').Router();
const { z } = require('zod');
const service = require('./payments.service');
const validate = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/auth');
const asyncHandler = require('../../shared/utils/asyncHandler');

// Webhook: body arrives raw (see app.js) because the signature is computed over the exact bytes.
router.post('/payments/webhook', asyncHandler(async (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
  res.json({ success: true, result: await service.handleWebhook(raw, req.headers['x-razorpay-signature']) });
}));

router.use(['/courses/:courseId/payments', '/payments/verify', '/payments/mine'], authenticate);
router.post('/courses/:courseId/payments/order', asyncHandler(async (req, res) => res.status(201).json({ success: true, order: await service.createOrder(req.user, req.params.courseId) })));
router.post('/payments/verify',
  validate({ body: z.object({ orderId: z.string().min(3), paymentId: z.string().min(3), signature: z.string().min(10) }) }),
  asyncHandler(async (req, res) => {
    const { payment, alreadyProcessed } = await service.verifyPayment(req.user, req.body);
    res.json({ success: true, status: payment.status, alreadyProcessed });
  }));
router.get('/payments/mine', asyncHandler(async (req, res) => res.json({ success: true, payments: await service.myPayments(req.user.id) })));

module.exports = router;
