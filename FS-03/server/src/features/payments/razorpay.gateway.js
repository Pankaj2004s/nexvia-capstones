const crypto = require('crypto');
const AppError = require('../../shared/utils/AppError');
const cfg = require('../../config/env');

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const hmac = (secret, payload) => crypto.createHmac('sha256', secret).update(payload).digest('hex');

// Real Razorpay gateway (test mode keys). Order creation calls Razorpay; verification is local HMAC.
function createGateway(keys = cfg.razorpay) {
  return {
    keyId: keys.keyId,
    async createOrder({ amountPaise, receipt, notes }) {
      if (!keys.keyId || !keys.keySecret) throw new AppError('Payments are not configured on the server', 503);
      const Razorpay = require('razorpay');
      const client = new Razorpay({ key_id: keys.keyId, key_secret: keys.keySecret });
      return client.orders.create({ amount: amountPaise, currency: 'INR', receipt, notes });
    },
    verifyPaymentSignature({ orderId, paymentId, signature }) {
      if (!keys.keySecret) return false;
      return safeEqual(hmac(keys.keySecret, `${orderId}|${paymentId}`), signature);
    },
    verifyWebhookSignature(rawBody, signature) {
      if (!keys.webhookSecret) return false;
      return safeEqual(hmac(keys.webhookSecret, rawBody), signature);
    },
  };
}

module.exports = { createGateway, hmac };
