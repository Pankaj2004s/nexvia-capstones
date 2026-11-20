const User = require('../auth/user.model');
const AppError = require('../../shared/utils/AppError');

async function getMe(id) {
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404);
  return user.toSafeJSON();
}

async function updateMe(id, { name, bio }) {
  const user = await User.findByIdAndUpdate(id, { $set: { ...(name && { name }), ...(bio !== undefined && { bio }) } }, { returnDocument: 'after', runValidators: true });
  if (!user) throw new AppError('User not found', 404);
  return user.toSafeJSON();
}

const getNames = async (ids) => {
  const users = await User.find({ _id: { $in: ids } }).select('name');
  return Object.fromEntries(users.map((u) => [u.id, u.name]));
};

module.exports = { getMe, updateMe, getNames };

// ---- admin helpers (kept here so other features never import the User model directly) ----
const AppErr = require('../../shared/utils/AppError');
const { escapeRegex, assertId } = require('../../shared/utils/helpers');

async function listUsers({ role, q, page = 1, limit = 20 }) {
  const filter = {};
  if (role) filter.role = role;
  if (q) filter.$or = [{ name: new RegExp(escapeRegex(q), 'i') }, { email: new RegExp(escapeRegex(q), 'i') }];
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  return { items: items.map((u) => u.toSafeJSON()), total, page, limit };
}

async function adminUpdateUser(actorId, id, { role, isActive }) {
  assertId(id, 'user id');
  if (String(actorId) === String(id)) throw new AppErr('You cannot change your own role or status', 400);
  const user = await User.findById(id);
  if (!user) throw new AppErr('User not found', 404);
  if (role) user.role = role;
  if (isActive !== undefined) user.isActive = isActive;
  await user.save();
  return user.toSafeJSON();
}

const countByRole = async () => ({
  students: await User.countDocuments({ role: 'student' }),
  instructors: await User.countDocuments({ role: 'instructor' }),
  admins: await User.countDocuments({ role: 'admin' }),
});

Object.assign(module.exports, { listUsers, adminUpdateUser, countByRole });
