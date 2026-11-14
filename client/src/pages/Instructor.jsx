import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fetchMyCourses, fetchEarnings, toast } from '../app/slices';
import { api } from '../lib/api';
import { inr } from '../lib/format';
import { Spinner, Empty, Field, ErrorNote } from '../components/ui.jsx';

const Stat = ({ label, value }) => (
  <div className="panel p-5"><p className="text-sm text-ink-mute">{label}</p><p className="mt-1 font-display text-3xl font-extrabold">{value}</p></div>
);

export default function Instructor() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { courses, dashboard, status } = useSelector((s) => s.instructor);
  const [tab, setTab] = useState('courses');
  const [form, setForm] = useState({ title: '', description: '', category: '', level: 'beginner', price: 0 });
  const [error, setError] = useState('');

  useEffect(() => { dispatch(fetchMyCourses()); dispatch(fetchEarnings()); }, [dispatch]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const d = await api.post('/courses', { ...form, price: Number(form.price) });
      dispatch(toast('Draft created. Add lessons next.', 'success'));
      navigate(`/instructor/courses/${d.course._id}`);
    } catch (err) { setError(err.details ? err.details.join(', ') : err.message); }
  };

  const t = dashboard && dashboard.totals;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Teaching</h1>
      <div className="mt-5 flex gap-1" role="tablist">
        {[['courses', 'My courses'], ['earnings', 'Earnings'], ['new', 'New course']].map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-field px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-board text-white' : 'bg-white text-ink'}`}>{l}</button>
        ))}
      </div>

      {tab === 'courses' && (
        <section className="mt-6">
          {courses.length === 0 ? <Empty title="You haven’t created a course yet">Start with a draft, add lessons and upload your videos. <button className="font-semibold text-board underline" onClick={() => setTab('new')}>Create a course</button></Empty> : (
            <ul className="panel divide-y divide-line">
              {courses.map((c) => (
                <li key={c._id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1"><Link className="font-display text-lg font-bold hover:underline" to={`/instructor/courses/${c._id}`}>{c.title}</Link><p className="text-sm text-ink-mute">{c.lessonCount} lessons, {c.enrolledCount} enrolled, {inr(c.price)}</p></div>
                  <span className={`tag ${c.status === 'published' ? 'text-ok' : c.status === 'rejected' ? 'text-coral' : ''}`}>{c.status}</span>
                  <Link className="btn-ghost" to={`/instructor/courses/${c._id}`}>Manage</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'earnings' && (
        <section className="mt-6 space-y-6">
          {status === 'loading' && !dashboard ? <Spinner /> : t && (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Stat label="Your earnings (80% share)" value={inr(t.instructorAmount)} />
                <Stat label="Course sales" value={t.sales} />
                <Stat label="Gross revenue" value={inr(t.gross)} />
              </div>
              <div className="panel p-5">
                <h2 className="font-display text-lg font-bold">Earnings by day</h2>
                {dashboard.perDay.length === 0 ? <p className="mt-2 text-sm text-ink-mute">No paid sales yet. When students buy your courses, daily earnings appear here.</p> : (
                  <div className="mt-4 h-64" role="img" aria-label="Bar chart of daily earnings">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboard.perDay}><CartesianGrid stroke="#D5DCE0" vertical={false} /><XAxis dataKey="date" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip formatter={(v) => inr(v)} /><Bar dataKey="amount" name="Earnings" fill="#0E4B45" radius={[4, 4, 0, 0]} /></BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="panel overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="px-5 py-3 text-left font-display text-lg font-bold">Revenue by course</caption>
                  <thead><tr className="border-y border-line text-left text-ink-mute"><th className="px-5 py-2 font-medium">Course</th><th className="px-5 py-2 font-medium">Sales</th><th className="px-5 py-2 text-right font-medium">Your earnings</th></tr></thead>
                  <tbody>{dashboard.perCourse.map((r) => <tr key={r.courseId} className="border-b border-line last:border-0"><td className="px-5 py-3">{r.title}</td><td className="px-5 py-3">{r.sales}</td><td className="px-5 py-3 text-right font-semibold">{inr(r.revenue)}</td></tr>)}
                    {dashboard.perCourse.length === 0 && <tr><td className="px-5 py-4 text-ink-mute" colSpan={3}>No sales yet.</td></tr>}</tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}

      {tab === 'new' && (
        <form onSubmit={create} className="panel mt-6 max-w-2xl space-y-4 p-6">
          <Field id="title" label="Course title" required minLength={3} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <div><label htmlFor="desc" className="label">Description</label><textarea id="desc" className="field min-h-28" required minLength={10} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="cat" label="Category" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <div><label htmlFor="lvl" className="label">Level</label><select id="lvl" className="field" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></div>
            <Field id="price" label="Price (₹, 0 = free)" type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          </div>
          <ErrorNote>{error}</ErrorNote>
          <button className="btn-primary">Create draft</button>
        </form>
      )}
    </div>
  );
}
