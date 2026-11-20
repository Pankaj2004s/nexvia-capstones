const Payment = require('./payment.model');
const AppError = require('../../shared/utils/AppError');
const { createGateway } = require('./razorpay.gateway');

const courses = () => require('../courses/courses.service');
const enrollments = () => require('../enrollments/enrollments.service');
const earnings = () => require('../earnings/earnings.service');

let gateway;
const getGateway = () => gateway || (gateway = createGateway());
const setGateway = (g) => { gateway = g; };

async function createOrder(user, courseId) {
  const course = await courses().getCourseOrThrow(courseId);
  if (course.status !== 'published') throw new AppError('Course is not available', 404);
  if (course.price <= 0) throw new AppError('This course is free, enroll directly', 400);
  if (await enrollments().isEnrolled(user.id, courseId)) throw new AppError('You are already enrolled', 409);

  const order = await getGateway().createOrder({
    amountPaise: Math.round(course.price * 100),
    receipt: `c_${String(course._id).slice(-8)}_${Date.now().toString(36)}`,
    notes: { courseId: String(course._id), userId: String(user.id) },
  });
  const payment = await Payment.create({ user: user.id, course: course._id, amount: course.price, orderId: order.id });
  return { paymentId: String(payment._id), orderId: order.id, amount: order.amount, currency: order.currency || 'INR', keyId: getGateway().keyId, courseTitle: course.title };
}

// Idempotent: the conditional update only succeeds for the first caller (verify call OR webhook).
async function markPaid(payment, razorpayPaymentId, signature) {
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: 'paid' } },
    { status: 'paid', paymentId: razorpayPaymentId, signature, paidAt: new Date() },
    { returnDocument: 'after' }
  );
  if (!claimed) return { payment: await Payment.findById(payment._id), alreadyProcessed: true };
  const course = await courses().getCourseOrThrow(claimed.course);
  await enrollments().enrollUser(claimed.user, claimed.course, claimed._id);
  await earnings().record(claimed, course);
  return { payment: claimed, alreadyProcessed: false };
}

async function verifyPayment(user, { orderId, paymentId, signature }) {
  const payment = await Payment.findOne({ orderId, user: user.id });
  if (!payment) throw new AppError('Order not found', 404);
  if (!getGateway().verifyPaymentSignature({ orderId, paymentId, signature })) {
    await Payment.updateOne({ _id: payment._id, status: 'created' }, { status: 'failed' });
    throw new AppError('Payment signature verification failed', 400);
  }
  return markPaid(payment, paymentId, signature);
}

async function handleWebhook(rawBody, signature) {
  if (!getGateway().verifyWebhookSignature(rawBody, signature)) throw new AppError('Invalid webhook signature', 400);
  const event = JSON.parse(rawBody);
  const entity = event.payload && event.payload.payment && event.payload.payment.entity;
  if (!entity) return { ignored: true };
  const payment = await Payment.findOne({ orderId: entity.order_id });
  if (!payment) return { ignored: true };
  if (event.event === 'payment.captured' || event.event === 'order.paid') return markPaid(payment, entity.id, 'webhook');
  if (event.event === 'payment.failed') await Payment.updateOne({ _id: payment._id, status: 'created' }, { status: 'failed' });
  return { handled: event.event };
}

const myPayments = (userId) => Payment.find({ user: userId }).sort({ createdAt: -1 }).select('-signature').lean();

module.exports = { createOrder, verifyPayment, handleWebhook, markPaid, myPayments, setGateway, getGateway };
