const crypto = require('crypto');
const mongoose = require('mongoose');
const AppError = require('./AppError');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isId = (v) => mongoose.Types.ObjectId.isValid(v);
const assertId = (v, name = 'id') => { if (!isId(v)) throw new AppError(`Invalid ${name}`, 400); return v; };

const slugify = (title) =>
  `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60)}-${crypto.randomBytes(3).toString('hex')}`;

const paginate = (query) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 12));
  return { page, limit, skip: (page - 1) * limit };
};

module.exports = { sha256, escapeRegex, isId, assertId, slugify, paginate };
