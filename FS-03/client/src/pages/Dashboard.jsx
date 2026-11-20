import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchEnrollments, fetchCertificates, fetchUpcoming, toast } from '../app/slices';
import { Spinner, Empty, ProgressBar } from '../components/ui.jsx';
import { dateTime } from '../lib/format';
import { downloadCertificate } from '../lib/download';

export default function Dashboard() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const { enrollments, certificates, upcoming, status } = useSelector((s) => s.learning);

  useEffect(() => { dispatch(fetchEnrollments()); dispatch(fetchCertificates()); dispatch(fetchUpcoming()); }, [dispatch]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-extrabold">Hi {user.name.split(' ')[0]}, here’s your learning</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <section>
          <h2 className="text-xl font-bold">My courses</h2>
          {status === 'loading' && <Spinner />}
          {status === 'ready' && enrollments.length === 0 && <div className="mt-3"><Empty title="You haven’t enrolled in anything yet">Find a course and it will show up here with your progress. <Link to="/" className="font-semibold text-board underline">Browse courses</Link></Empty></div>}
          <ul className="mt-3 space-y-3">
            {enrollments.map((e) => (
              <li key={e.id} className="panel flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <Link to={`/learn/${e.course.id}`} className="font-display text-lg font-bold hover:underline">{e.course.title}</Link>
                  <div className="mt-2 flex items-center gap-3"><ProgressBar value={e.percent} className="flex-1" /><span className="w-10 text-right text-sm">{e.percent}%</span></div>
                </div>
                <Link to={`/learn/${e.course.id}`} className="btn-primary">{e.percent === 0 ? 'Start' : e.percent === 100 ? 'Review' : 'Continue'}</Link>
              </li>
            ))}
          </ul>
        </section>

        <div className="space-y-8">
          <section>
            <h2 className="text-xl font-bold">Live classes</h2>
            {upcoming.length === 0 ? <p className="mt-2 text-sm text-ink-mute">No upcoming classes in your courses.</p> : (
              <ul className="panel mt-3 divide-y divide-line">
                {upcoming.map((c) => (
                  <li key={c._id} className="flex items-center justify-between gap-3 p-3 text-sm">
                    <span><strong>{c.title}</strong><br /><span className="text-ink-mute">{dateTime(c.scheduledAt)}</span></span>
                    {c.status === 'live' ? <Link className="btn-chalk" to={`/live/${c._id}`}>Join</Link> : <span className="tag">Scheduled</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-xl font-bold">Certificates</h2>
            {certificates.length === 0 ? <p className="mt-2 text-sm text-ink-mute">Complete a course to earn one.</p> : (
              <ul className="panel mt-3 divide-y divide-line">
                {certificates.map((c) => (
                  <li key={c.certId} className="p-3 text-sm">
                    <p className="font-semibold">{c.courseTitle}</p>
                    <p className="text-ink-mute">{c.certId}</p>
                    <div className="mt-2 flex gap-2">
                      <button className="btn-ghost" onClick={() => downloadCertificate(c.certId).catch((e) => dispatch(toast(e.message, 'error')))}>Download PDF</button>
                      <Link className="btn-ghost" to={`/verify/${c.certId}`}>Verify</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
