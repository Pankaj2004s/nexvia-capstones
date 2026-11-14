import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAdmin, toast } from '../app/slices';
import { api } from '../lib/api';
import { inr } from '../lib/format';
import { Spinner, Empty } from '../components/ui.jsx';

export default function Admin() {
  const dispatch = useDispatch();
  const me = useSelector((s) => s.auth.user);
  const { stats, pending, users, status } = useSelector((s) => s.admin);
  useEffect(() => { dispatch(fetchAdmin()); }, [dispatch]);

  const act = (fn, msg) => async () => { try { await fn(); dispatch(toast(msg, 'success')); dispatch(fetchAdmin()); } catch (e) { dispatch(toast(e.message, 'error')); } };

  if (!stats) return status === 'loading' ? <Spinner /> : <Empty title="Couldn’t load admin data" />;
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10">
      <h1 className="text-3xl font-extrabold">Admin</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[['Students', stats.users.students], ['Instructors', stats.users.instructors], ['Platform revenue (20%)', inr(stats.revenue.platformFee)], ['Gross sales', inr(stats.revenue.gross)]].map(([l, v]) => (
          <div key={l} className="panel p-5"><p className="text-sm text-ink-mute">{l}</p><p className="mt-1 font-display text-3xl font-extrabold">{v}</p></div>
        ))}
      </div>

      <section>
        <h2 className="text-xl font-bold">Courses waiting for review</h2>
        {pending.length === 0 ? <div className="mt-3"><Empty title="Nothing to review">New course submissions appear here.</Empty></div> : (
          <ul className="panel mt-3 divide-y divide-line">
            {pending.map((c) => (
              <li key={c._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="font-display text-lg font-bold">{c.title}</p><p className="text-sm text-ink-mute">{c.category}, {c.lessonCount} lessons, {inr(c.price)}</p></div>
                <div className="flex gap-2"><button className="btn-primary" onClick={act(() => api.post(`/admin/courses/${c._id}/approve`), 'Course published')}>Approve</button><button className="btn-ghost" onClick={act(() => api.post(`/admin/courses/${c._id}/reject`), 'Course rejected')}>Reject</button></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold">Users</h2>
        <div className="panel mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-line text-left text-ink-mute"><th className="px-4 py-2 font-medium">Name</th><th className="px-4 py-2 font-medium">Email</th><th className="px-4 py-2 font-medium">Role</th><th className="px-4 py-2 font-medium">Status</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">{u.name}</td><td className="px-4 py-2.5">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <select aria-label={`Role for ${u.name}`} className="field w-auto py-1.5" value={u.role} disabled={u.id === me.id} onChange={(e) => act(() => api.patch(`/admin/users/${u.id}`, { role: e.target.value }), 'Role updated')()}>
                      <option value="student">student</option><option value="instructor">instructor</option><option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-2.5"><button className={u.isActive ? 'btn-ghost' : 'btn-danger'} disabled={u.id === me.id} onClick={act(() => api.patch(`/admin/users/${u.id}`, { isActive: !u.isActive }), u.isActive ? 'User disabled' : 'User enabled')}>{u.isActive ? 'Disable' : 'Enable'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
