const crypto = require('crypto');
const Certificate = require('./certificate.model');
const { renderCertificate } = require('./certificate.pdf');
const AppError = require('../../shared/utils/AppError');
const { getStorage } = require('../../shared/storage');
const { clientUrl } = require('../../config/env');

const courses = () => require('../courses/courses.service');
const enrollments = () => require('../enrollments/enrollments.service');
const progress = () => require('../progress/progress.service');
const users = () => require('../users/users.service');

const newCertId = () => `LS-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;

async function issue(user, courseId) {
  const course = await courses().getCourseOrThrow(courseId);
  if (!(await enrollments().isEnrolled(user.id, courseId))) throw new AppError('You are not enrolled in this course', 403);
  const existing = await Certificate.findOne({ user: user.id, course: courseId });
  if (existing) return existing;

  const status = await progress().completionStatus(user.id, courseId);
  if (!status.eligible) throw new AppError('Complete all lessons and pass all quizzes to earn the certificate', 400, status);

  const names = await users().getNames([user.id, course.instructor]);
  const certId = newCertId();
  const issuedAt = new Date();
  const pdf = await renderCertificate({
    certId, studentName: names[user.id], courseTitle: course.title, instructorName: names[String(course.instructor)] || 'Instructor',
    issuedAt, verifyUrl: `${clientUrl.split(',')[0]}/verify/${certId}`,
  });
  const pdfKey = `certificates/${certId}.pdf`;
  await getStorage().putBuffer(pdf, pdfKey, 'application/pdf');
  try {
    return await Certificate.create({
      certId, user: user.id, course: courseId, studentName: names[user.id], courseTitle: course.title,
      instructorName: names[String(course.instructor)], pdfKey, issuedAt,
    });
  } catch (e) {
    if (e.code === 11000) return Certificate.findOne({ user: user.id, course: courseId }); // concurrent request won
    throw e;
  }
}

const listMine = (userId) => Certificate.find({ user: userId }).sort({ issuedAt: -1 }).select('-pdfKey');

async function download(user, certId) {
  const cert = await Certificate.findOne({ certId });
  if (!cert) throw new AppError('Certificate not found', 404);
  if (String(cert.user) !== String(user.id) && user.role !== 'admin') throw new AppError('Not your certificate', 403);
  return { cert, buffer: await getStorage().readBuffer(cert.pdfKey) };
}

async function verify(certId) {
  const cert = await Certificate.findOne({ certId });
  if (!cert) return { valid: false };
  return { valid: true, certId: cert.certId, studentName: cert.studentName, courseTitle: cert.courseTitle, instructorName: cert.instructorName, issuedAt: cert.issuedAt };
}

module.exports = { issue, listMine, download, verify };
