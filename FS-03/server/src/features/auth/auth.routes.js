const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const c = require('./auth.controller');
const v = require('./auth.validation');
const validate = require('../../shared/middleware/validate');
const { authenticate } = require('../../shared/middleware/auth');
const { isTest } = require('../../config/env');

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: isTest ? 1000 : 30, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many attempts, try again later' } });

router.post('/register', limiter, validate({ body: v.register }), c.register);
router.post('/login', limiter, validate({ body: v.login }), c.login);
router.post('/refresh', c.refresh);
router.post('/logout', authenticate, c.logout);

module.exports = router;
