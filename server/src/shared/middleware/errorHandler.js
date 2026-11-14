const AppError = require('../utils/AppError');
const logger = require('../utils/logger');
const { isProd } = require('../../config/env');

const notFound = (req, res, next) => next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let status = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details;

  if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyPattern || {}).join(', ') || 'field'}`;
  } else if (err.name === 'ValidationError') {
    status = 400;
    details = Object.values(err.errors || {}).map((e) => e.message);
    message = 'Validation failed';
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}`;
  } else if (err.name === 'MulterError') {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large (max 500 MB)' : err.message;
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    status = 401;
    message = 'Invalid or expired token';
  }

  if (status >= 500) logger.error(err);
  res.status(status).json({
    success: false,
    message: status >= 500 && isProd ? 'Internal Server Error' : message,
    ...(details ? { details } : {}),
  });
};

module.exports = { notFound, errorHandler };
