const service = require('./auth.service');
const asyncHandler = require('../../shared/utils/asyncHandler');
const { isProd, jwt } = require('../../config/env');

const cookieOpts = { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', maxAge: jwt.refreshTtlMs, path: '/api/auth' };
const send = (res, status, { user, accessToken, refreshToken }) => {
  res.cookie('refreshToken', refreshToken, cookieOpts);
  res.status(status).json({ success: true, user, accessToken });
};

exports.register = asyncHandler(async (req, res) => send(res, 201, await service.register(req.body)));
exports.login = asyncHandler(async (req, res) => send(res, 200, await service.login(req.body)));
exports.refresh = asyncHandler(async (req, res) => send(res, 200, await service.refresh(req.cookies.refreshToken)));
exports.logout = asyncHandler(async (req, res) => {
  await service.logout(req.user.id);
  res.clearCookie('refreshToken', { ...cookieOpts, maxAge: undefined });
  res.json({ success: true });
});
