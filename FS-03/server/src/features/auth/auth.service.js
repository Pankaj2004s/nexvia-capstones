const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('./user.model');
const AppError = require('../../shared/utils/AppError');
const { sha256 } = require('../../shared/utils/helpers');
const { jwt: cfg } = require('../../config/env');

async function issueTokens(user) {
  const accessToken = jwt.sign({ sub: user.id, role: user.role }, cfg.accessSecret, { expiresIn: cfg.accessTtl });
  const refreshToken = jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, cfg.refreshSecret, { expiresIn: Math.floor(cfg.refreshTtlMs / 1000) }); // jti makes every refresh token unique
  await User.updateOne({ _id: user.id }, { refreshTokenHash: sha256(refreshToken) });
  return { accessToken, refreshToken };
}

async function register({ name, email, password, role }) {
  if (await User.exists({ email: email.toLowerCase() })) throw new AppError('Email already registered', 409);
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, role });
  return { user: user.toSafeJSON(), ...(await issueTokens(user)) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  // same message for unknown email and wrong password so emails cannot be enumerated
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new AppError('Invalid email or password', 401);
  if (!user.isActive) throw new AppError('Account is disabled', 403);
  return { user: user.toSafeJSON(), ...(await issueTokens(user)) };
}

async function refresh(refreshToken) {
  if (!refreshToken) throw new AppError('Refresh token missing', 401);
  let payload;
  try { payload = jwt.verify(refreshToken, cfg.refreshSecret); } catch (e) { throw new AppError('Invalid refresh token', 401); }
  const user = await User.findById(payload.sub).select('+refreshTokenHash');
  if (!user || !user.isActive || user.refreshTokenHash !== sha256(refreshToken)) {
    throw new AppError('Invalid refresh token', 401);
  }
  return { user: user.toSafeJSON(), ...(await issueTokens(user)) }; // rotation: old token stops working
}

async function logout(userId) {
  await User.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } });
}

module.exports = { register, login, refresh, logout, issueTokens };
