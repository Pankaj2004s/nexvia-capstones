const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { jwt: jwtCfg } = require('../../config/env');

const verifyAccess = (token) => jwt.verify(token, jwtCfg.accessSecret);

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(new AppError('Authentication required', 401));
  try {
    const payload = verifyAccess(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (e) {
    return next(new AppError('Invalid or expired token', 401));
  }
};

// Attaches req.user when a valid token is present, otherwise continues as anonymous.
const optionalAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    try {
      const p = verifyAccess(header.slice(7));
      req.user = { id: p.sub, role: p.role };
    } catch (e) { /* anonymous */ }
  }
  next();
};

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) return next(new AppError('Authentication required', 401));
  if (!roles.includes(req.user.role)) return next(new AppError('You do not have permission to do this', 403));
  return next();
};

module.exports = { authenticate, optionalAuth, authorize, verifyAccess };
