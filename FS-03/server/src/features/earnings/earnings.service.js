const mongoose = require('mongoose');
const Earning = require('./earning.model');
const { instructorShare } = require('../../config/env');

const courses = () => require('../courses/courses.service');
const round2 = (n) => Math.round(n * 100) / 100;

// Called once per paid payment (payment is unique on Earning, so retries cannot double count).
async function record(payment, course) {
  const instructorAmount = round2(payment.amount * instructorShare);
  try {
    return await Earning.create({
      instructor: course.instructor, course: course._id, payment: payment._id,
      gross: payment.amount, instructorAmount, platformFee: round2(payment.amount - instructorAmount),
    });
  } catch (e) {
    if (e.code === 11000) return Earning.findOne({ payment: payment._id });
    throw e;
  }
}

// Grouping is done in application code over a lean projection: portable across MongoDB-compatible
// servers and easy to test. For very large datasets move this to an aggregation pipeline.
async function summarize(match) {
  const rows = await Earning.find(match).select('course gross instructorAmount platformFee createdAt').lean();
  const totals = { gross: 0, instructorAmount: 0, platformFee: 0, sales: rows.length };
  const byCourse = new Map();
  const byDay = new Map();
  for (const r of rows) {
    totals.gross += r.gross;
    totals.instructorAmount += r.instructorAmount;
    totals.platformFee += r.platformFee;
    const cid = String(r.course);
    const c = byCourse.get(cid) || { courseId: cid, revenue: 0, gross: 0, sales: 0 };
    c.revenue += r.instructorAmount; c.gross += r.gross; c.sales += 1;
    byCourse.set(cid, c);
    const day = new Date(r.createdAt).toISOString().slice(0, 10);
    const d = byDay.get(day) || { date: day, amount: 0, gross: 0, sales: 0 };
    d.amount += r.instructorAmount; d.gross += r.gross; d.sales += 1;
    byDay.set(day, d);
  }
  const perCourse = [...byCourse.values()].sort((a, b) => b.revenue - a.revenue);
  for (const row of perCourse) {
    const c = await courses().getCourseOrThrow(row.courseId).catch(() => null);
    row.title = c ? c.title : 'Deleted course';
    row.revenue = round2(row.revenue);
    row.gross = round2(row.gross);
  }
  const perDay = [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, amount: round2(d.amount), gross: round2(d.gross) }));
  return { totals: { ...totals, gross: round2(totals.gross), instructorAmount: round2(totals.instructorAmount), platformFee: round2(totals.platformFee) }, perCourse, perDay };
}

const instructorDashboard = (instructorId) => summarize({ instructor: new mongoose.Types.ObjectId(String(instructorId)) });
const platformSummary = () => summarize({});

module.exports = { record, instructorDashboard, platformSummary };
