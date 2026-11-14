const Course = require('./course.model');
const AppError = require('../../shared/utils/AppError');
const { slugify, escapeRegex, isId, assertId } = require('../../shared/utils/helpers');

// Lazy requires avoid circular imports between feature services.
const lessons = () => require('../lessons/lessons.service');
const enrollments = () => require('../enrollments/enrollments.service');
const users = () => require('../users/users.service');

const SORTS = { newest: { createdAt: -1 }, popular: { enrolledCount: -1 }, price_asc: { price: 1 }, price_desc: { price: -1 } };

async function getCourseOrThrow(id) {
  assertId(id, 'course id');
  const course = await Course.findById(id);
  if (!course) throw new AppError('Course not found', 404);
  return course;
}

const isOwnerOrAdmin = (course, user) =>
  Boolean(user && (user.role === 'admin' || String(course.instructor) === String(user.id)));

function assertManage(course, user) {
  if (!isOwnerOrAdmin(course, user)) throw new AppError('You do not own this course', 403);
}

async function canAccessContent(course, user) {
  if (!user) return false;
  if (isOwnerOrAdmin(course, user)) return true;
  return enrollments().isEnrolled(user.id, course.id);
}

async function create(user, data) {
  const sections = (data.sections || []).map((s, i) => ({ title: s.title, order: s.order ?? i }));
  return Course.create({ ...data, sections, slug: slugify(data.title), instructor: user.id });
}

async function list(query) {
  const filter = { status: 'published' };
  if (query.category) filter.category = query.category;
  if (query.level) filter.level = query.level;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    filter.price = {};
    if (query.minPrice !== undefined) filter.price.$gte = query.minPrice;
    if (query.maxPrice !== undefined) filter.price.$lte = query.maxPrice;
  }
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: rx }, { tags: rx }, { description: rx }];
  }
  const page = query.page || 1;
  const limit = query.limit || 12;
  const [items, total] = await Promise.all([
    Course.find(filter).sort(SORTS[query.sort || 'newest']).skip((page - 1) * limit).limit(limit).lean(),
    Course.countDocuments(filter),
  ]);
  const names = await users().getNames(items.map((c) => c.instructor));
  return {
    items: items.map((c) => ({ ...c, id: String(c._id), instructorName: names[String(c.instructor)] })),
    page, limit, total, pages: Math.ceil(total / limit),
  };
}

const listMine = (userId) => Course.find({ instructor: userId }).sort({ createdAt: -1 }).lean();

async function getDetail(idOrSlug, viewer) {
  const course = isId(idOrSlug) ? await Course.findById(idOrSlug) : await Course.findOne({ slug: idOrSlug });
  if (!course) throw new AppError('Course not found', 404);
  const canManage = isOwnerOrAdmin(course, viewer);
  if (course.status !== 'published' && !canManage) throw new AppError('Course not found', 404);
  const [lessonList, enrolled, names] = await Promise.all([
    lessons().listByCourse(course.id),
    viewer ? enrollments().isEnrolled(viewer.id, course.id) : false,
    users().getNames([course.instructor]),
  ]);
  const unlocked = canManage || enrolled;
  return {
    ...course.toObject(),
    id: course.id,
    instructorName: names[String(course.instructor)],
    isEnrolled: enrolled,
    canManage,
    // video/content is only exposed through the playback endpoint; list shows structure only
    lessons: lessonList.map((l) => ({
      id: l.id, section: l.section, title: l.title, order: l.order, type: l.type,
      durationSec: l.durationSec, isPreview: l.isPreview, locked: !(unlocked || l.isPreview),
    })),
  };
}

async function update(user, id, data) {
  const course = await getCourseOrThrow(id);
  assertManage(course, user);
  if (data.sections) data.sections = data.sections.map((s, i) => ({ title: s.title, order: s.order ?? i }));
  if (data.title && data.title !== course.title) data.slug = slugify(data.title);
  Object.assign(course, data);
  // editing a published course by its instructor sends it back to review only if price changes or content is replaced
  await course.save();
  return course;
}

async function submitForReview(user, id) {
  const course = await getCourseOrThrow(id);
  assertManage(course, user);
  if (!['draft', 'rejected'].includes(course.status)) throw new AppError(`Course is already ${course.status}`, 409);
  if (course.lessonCount < 1) throw new AppError('Add at least one lesson before submitting', 400);
  course.status = 'pending';
  await course.save();
  return course;
}

async function remove(user, id) {
  const course = await getCourseOrThrow(id);
  assertManage(course, user);
  if (course.enrolledCount > 0) throw new AppError('Cannot delete a course with enrolled students', 409);
  await lessons().removeAllForCourse(course.id);
  await course.deleteOne();
}

async function setStatus(id, status) {
  const course = await getCourseOrThrow(id);
  course.status = status;
  await course.save();
  return course;
}

const listByStatus = (status) => Course.find({ status }).sort({ updatedAt: -1 }).lean();
const setStats = (id, stats) => Course.updateOne({ _id: id }, { $set: stats });
const bumpEnrolled = (id) => Course.updateOne({ _id: id }, { $inc: { enrolledCount: 1 } });

module.exports = {
  getCourseOrThrow, assertManage, canAccessContent, isOwnerOrAdmin,
  create, list, listMine, getDetail, update, submitForReview, remove, setStatus, setStats, bumpEnrolled, listByStatus,
};
