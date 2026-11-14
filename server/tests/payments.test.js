const { api, resetDb, closeDb, makeUser, auth, publishedCourse } = require('./helpers');
const { createGateway, hmac } = require('../src/features/payments/razorpay.gateway');
const payments = require('../src/features/payments');

const KEYS = { keyId: 'rzp_test_abc', keySecret: 'sec_123', webhookSecret: 'whsec_456' };
let seq = 0;

beforeAll(async () => {
  await resetDb();
  const gw = createGateway(KEYS);
  gw.createOrder = async ({ amountPaise }) => ({ id: `order_T${(seq += 1)}`, amount: amountPaise, currency: 'INR' }); // only the network call is stubbed
  payments.service.setGateway(gw);
});
afterAll(closeDb);

const sign = (orderId, paymentId) => hmac(KEYS.keySecret, `${orderId}|${paymentId}`);

describe('payments (Razorpay test mode)', () => {
  let ctx; let student; let order;

  beforeAll(async () => {
    ctx = await publishedCourse({ price: 499 });
    student = await makeUser('student');
  });

  test('order amount is in paise and requires auth', async () => {
    expect((await api().post(`/api/courses/${ctx.courseId}/payments/order`)).status).toBe(401);
    const res = await api().post(`/api/courses/${ctx.courseId}/payments/order`).set(auth(student.token));
    expect(res.status).toBe(201);
    order = res.body.order;
    expect(order).toMatchObject({ amount: 49900, currency: 'INR', keyId: KEYS.keyId });
  });

  test('free courses cannot be bought', async () => {
    const free = await publishedCourse({ price: 0 });
    expect((await api().post(`/api/courses/${free.courseId}/payments/order`).set(auth(student.token))).status).toBe(400);
  });

  test('forged signature is rejected, payment marked failed, no enrollment', async () => {
    const res = await api().post('/api/payments/verify').set(auth(student.token)).send({ orderId: order.orderId, paymentId: 'pay_FAKE12345', signature: 'f'.repeat(64) });
    expect(res.status).toBe(400);
    expect((await api().get('/api/enrollments/mine').set(auth(student.token))).body.enrollments).toHaveLength(0);
    expect((await api().get('/api/payments/mine').set(auth(student.token))).body.payments[0].status).toBe('failed');
  });

  test("another user cannot verify someone else's order", async () => {
    const thief = await makeUser('student');
    const res = await api().post('/api/payments/verify').set(auth(thief.token)).send({ orderId: order.orderId, paymentId: 'pay_1234567', signature: sign(order.orderId, 'pay_1234567') });
    expect(res.status).toBe(404);
  });

  test('valid signature enrolls the student and records an 80/20 earning', async () => {
    const res = await api().post('/api/payments/verify').set(auth(student.token)).send({ orderId: order.orderId, paymentId: 'pay_REAL0001', signature: sign(order.orderId, 'pay_REAL0001') });
    expect(res.body).toMatchObject({ success: true, status: 'paid', alreadyProcessed: false });
    expect((await api().get('/api/enrollments/mine').set(auth(student.token))).body.enrollments).toHaveLength(1);
    const dash = await api().get('/api/earnings/dashboard').set(auth(ctx.instructor.token));
    expect(dash.body.dashboard.totals).toMatchObject({ gross: 499, instructorAmount: 399.2, platformFee: 99.8, sales: 1 });
    expect(dash.body.dashboard.perCourse[0]).toMatchObject({ courseId: ctx.courseId, sales: 1 });
    expect(dash.body.dashboard.perDay).toHaveLength(1);
  });

  test('verify is idempotent (no double enrollment or double earning)', async () => {
    const again = await api().post('/api/payments/verify').set(auth(student.token)).send({ orderId: order.orderId, paymentId: 'pay_REAL0001', signature: sign(order.orderId, 'pay_REAL0001') });
    expect(again.body.alreadyProcessed).toBe(true);
    const dash = await api().get('/api/earnings/dashboard').set(auth(ctx.instructor.token));
    expect(dash.body.dashboard.totals.sales).toBe(1);
    const course = await api().get(`/api/courses/${ctx.courseId}`);
    expect(course.body.course.enrolledCount).toBe(1);
  });

  test('already enrolled students cannot create another order', async () => {
    expect((await api().post(`/api/courses/${ctx.courseId}/payments/order`).set(auth(student.token))).status).toBe(409);
  });

  test('webhook: bad signature rejected; captured event enrolls exactly once', async () => {
    const buyer = await makeUser('student');
    const o = (await api().post(`/api/courses/${ctx.courseId}/payments/order`).set(auth(buyer.token))).body.order;
    const raw = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_WEBHK001', order_id: o.orderId } } } });

    const bad = await api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'bad').send(raw);
    expect(bad.status).toBe(400);

    const sig = hmac(KEYS.webhookSecret, raw);
    const r1 = await api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', sig).send(raw);
    expect(r1.status).toBe(200);
    const r2 = await api().post('/api/payments/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', sig).send(raw); // Razorpay retries
    expect(r2.status).toBe(200);
    expect((await api().get('/api/enrollments/mine').set(auth(buyer.token))).body.enrollments).toHaveLength(1);
    const dash = await api().get('/api/earnings/dashboard').set(auth(ctx.instructor.token));
    expect(dash.body.dashboard.totals.sales).toBe(2);
  });

  test('earnings are private to the instructor; admin sees platform revenue', async () => {
    const other = await makeUser('instructor', 'rival');
    const dash = await api().get('/api/earnings/dashboard').set(auth(other.token));
    expect(dash.body.dashboard.totals.sales).toBe(0);
    expect((await api().get('/api/earnings/dashboard').set(auth(student.token))).status).toBe(403);
    const stats = await api().get('/api/admin/stats').set(auth(ctx.admin.token));
    expect(stats.body.revenue).toMatchObject({ gross: 998, platformFee: 199.6, sales: 2 });
    expect(stats.body.users.instructors).toBeGreaterThanOrEqual(2);
  });
});
