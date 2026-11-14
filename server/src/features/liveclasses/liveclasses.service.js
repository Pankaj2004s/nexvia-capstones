const LiveClass = require('./liveclass.model');
const AppError = require('../../shared/utils/AppError');
const { assertId } = require('../../shared/utils/helpers');

const courses = () => require('../courses/courses.service');
const enrollments = () => require('../enrollments/enrollments.service');

const MAX_PARTICIPANTS = 7; // instructor + up to 6 students (mesh WebRTC limit)

async function getOrThrow(id) {
  assertId(id, 'live class id');
  const lc = await LiveClass.findById(id);
  if (!lc) throw new AppError('Live class not found', 404);
  return lc;
}

async function schedule(user, courseId, data) {
  const course = await courses().getCourseOrThrow(courseId);
  courses().assertManage(course, user);
  return LiveClass.create({ ...data, course: courseId, instructor: course.instructor });
}

async function listForCourse(user, courseId) {
  const course = await courses().getCourseOrThrow(courseId);
  if (!(await courses().canAccessContent(course, user))) throw new AppError('Enroll to see live classes', 403);
  return LiveClass.find({ course: courseId }).sort({ scheduledAt: 1 });
}

async function upcomingForUser(user) {
  const Enrollment = require('../enrollments/enrollment.model');
  const enrolled = (await Enrollment.find({ user: user.id }).select('course')).map((e) => e.course);
  const mine = (await courses().listMine(user.id)).map((c) => c._id);
  return LiveClass.find({ course: { $in: [...enrolled, ...mine] }, status: { $ne: 'ended' } }).sort({ scheduledAt: 1 }).limit(50);
}

async function setStatus(user, id, status) {
  const lc = await getOrThrow(id);
  courses().assertManage(await courses().getCourseOrThrow(lc.course), user);
  if (status === 'live' && lc.status !== 'scheduled') throw new AppError(`Class is already ${lc.status}`, 409);
  if (status === 'ended' && lc.status !== 'live') throw new AppError('Only a live class can be ended', 409);
  lc.status = status;
  if (status === 'live') lc.startedAt = new Date();
  if (status === 'ended') lc.endedAt = new Date();
  await lc.save();
  return lc;
}

async function remove(user, id) {
  const lc = await getOrThrow(id);
  courses().assertManage(await courses().getCourseOrThrow(lc.course), user);
  if (lc.status === 'live') throw new AppError('End the class before deleting it', 409);
  await lc.deleteOne();
}

// Used by the socket layer: who may join, and as what.
async function canJoin(user, id) {
  const lc = await getOrThrow(id);
  if (lc.status !== 'live') throw new AppError('Class is not live yet', 409);
  const course = await courses().getCourseOrThrow(lc.course);
  const isHost = courses().isOwnerOrAdmin(course, user);
  if (!isHost && !(await enrollments().isEnrolled(user.id, lc.course))) throw new AppError('Enroll in the course to join this class', 403);
  return { liveClass: lc, role: isHost ? 'instructor' : 'student' };
}

function iceServers() {
  const servers = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) servers.push({ urls: process.env.TURN_URL, username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  return servers;
}

module.exports = { MAX_PARTICIPANTS, getOrThrow, schedule, listForCourse, upcomingForUser, setStatus, remove, canJoin, iceServers };
