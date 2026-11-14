import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { api } from '../lib/api';
import { toast } from '../app/slices';
import { duration, groupBy, dateTime } from '../lib/format';
import { downloadCertificate } from '../lib/download';
import VideoPlayer from '../components/VideoPlayer.jsx';
import { Spinner, ProgressBar, Empty } from '../components/ui.jsx';

export default function Learn() {
  const { courseId } = useParams();
  const [sp, setSp] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [course, setCourse] = useState(null);
  const [progress, setProgress] = useState({ progress: { completedLessons: [], percent: 0 }, status: { quizzes: [], eligible: false } });
  const [quizzes, setQuizzes] = useState([]);
  const [live, setLive] = useState([]);
  const [lessonText, setLessonText] = useState(null);
  const [cert, setCert] = useState(null);
  const [tab, setTab] = useState('overview');

  const loadAll = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([api.get(`/courses/${courseId}`), api.get(`/progress/courses/${courseId}`).catch(() => null)]);
      setCourse(c.course);
      if (p) setProgress(p);
      const hasAccess = c.course.isEnrolled || c.course.canManage;
      if (hasAccess) {
        api.get(`/courses/${courseId}/quizzes`).then((d) => setQuizzes(d.quizzes)).catch(() => {});
        api.get(`/courses/${courseId}/live-classes`).then((d) => setLive(d.liveClasses)).catch(() => {});
        api.get('/certificates/mine').then((d) => setCert(d.certificates.find((x) => x.course === courseId) || null)).catch(() => {});
      }
    } catch (e) { dispatch(toast(e.message, 'error')); navigate('/'); }
  }, [courseId, dispatch, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Pin the selected lesson into the URL once (first unfinished lesson), so completing a lesson doesn't jump away from it.
  useEffect(() => {
    if (!course || sp.get('lesson') || course.lessons.length === 0) return;
    const doneIds = new Set((progress.progress.completedLessons || []).map(String));
    const first = course.lessons.find((l) => !doneIds.has(l.id) && !l.locked) || course.lessons[0];
    setSp({ lesson: first.id }, { replace: true });
  }, [course]); // eslint-disable-line react-hooks/exhaustive-deps

  const lessons = course ? course.lessons : [];
  const done = new Set((progress.progress.completedLessons || []).map(String));
  const lessonId = sp.get('lesson');
  const current = lessons.find((l) => l.id === lessonId);

  useEffect(() => {
    setLessonText(null);
    if (current && current.type === 'text' && !current.locked) api.get(`/lessons/${current.id}`).then((d) => setLessonText(d.lesson.content || '')).catch(() => {});
  }, [current && current.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!course) return <Spinner />;
  const canTrack = course.isEnrolled;
  const sections = groupBy(lessons, 'section');

  const complete = async () => {
    try { const d = await api.post(`/progress/lessons/${lessonId}/complete`); setProgress((p) => ({ ...p, progress: d.progress })); loadAll(); dispatch(toast('Marked as complete', 'success')); } catch (e) { dispatch(toast(e.message, 'error')); }
  };
  const getCertificate = async () => {
    try { const d = await api.post(`/courses/${courseId}/certificate`); setCert(d.certificate); dispatch(toast('Certificate issued!', 'success')); } catch (e) { dispatch(toast(e.message, 'error')); }
  };

  const next = () => { const i = lessons.findIndex((l) => l.id === lessonId); if (lessons[i + 1] && !lessons[i + 1].locked) setSp({ lesson: lessons[i + 1].id }); };

  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[1fr_340px]">
      <div className="min-w-0">
        <Link to={`/courses/${course.slug}`} className="text-sm text-ink-mute hover:underline">← {course.title}</Link>
        {current ? (
          <>
            <h1 className="mb-3 mt-2 text-2xl font-extrabold">{current.title}</h1>
            {current.locked
              ? <Empty title="This lesson is locked">Enroll in the course to watch it.</Empty>
              : current.type === 'video'
                ? <VideoPlayer lessonId={current.id} onEnded={() => canTrack && !done.has(current.id) && complete()} />
                : <article className="panel whitespace-pre-wrap p-6 leading-relaxed">{lessonText === null ? 'Loading…' : lessonText || 'This lesson has no text yet.'}</article>}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {canTrack && <button className="btn-primary" disabled={done.has(current.id)} onClick={complete}>{done.has(current.id) ? 'Completed' : 'Mark as complete'}</button>}
              <button className="btn-ghost" onClick={next}>Next lesson</button>
            </div>
          </>
        ) : <Empty title="No lessons yet">The instructor hasn’t added lessons to this course.</Empty>}

        <div className="mt-8" role="tablist" aria-label="Course sections">
          {[['overview', 'About'], ['quizzes', `Quizzes (${quizzes.length})`], ['live', `Live classes (${live.length})`], ['cert', 'Certificate']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`mr-1 rounded-t-field border-b-2 px-4 py-2 text-sm font-semibold ${tab === k ? 'border-board text-board' : 'border-transparent text-ink-mute'}`}>{l}</button>
          ))}
        </div>
        <div className="panel rounded-tl-none p-5" role="tabpanel">
          {tab === 'overview' && <p className="max-w-prose">{course.description}</p>}
          {tab === 'quizzes' && (quizzes.length === 0 ? <p className="text-ink-mute">No quizzes in this course.</p> : (
            <ul className="divide-y divide-line">
              {quizzes.map((q) => {
                const passed = (progress.status.quizzes.find((x) => x.quizId === q.id) || {}).passed;
                return <li key={q.id} className="flex items-center justify-between py-3"><span>{q.title} <span className="text-xs text-ink-mute">({q.questions.length} questions, pass at {q.passingPercent}%)</span></span><span className="flex items-center gap-3">{passed && <span className="tag text-ok">Passed</span>}{canTrack && <Link className="btn-ghost" to={`/quiz/${q.id}`}>{passed ? 'Retake' : 'Start quiz'}</Link>}</span></li>;
              })}
            </ul>
          ))}
          {tab === 'live' && (live.length === 0 ? <p className="text-ink-mute">No live classes scheduled yet.</p> : (
            <ul className="divide-y divide-line">
              {live.map((c) => (
                <li key={c._id} className="flex items-center justify-between gap-3 py-3">
                  <span><strong>{c.title}</strong><br /><span className="text-sm text-ink-mute">{dateTime(c.scheduledAt)}, {c.durationMin} min</span></span>
                  {c.status === 'live' ? <Link className="btn-chalk" to={`/live/${c._id}`}>Join now</Link> : <span className="tag">{c.status === 'ended' ? 'Ended' : 'Scheduled'}</span>}
                </li>
              ))}
            </ul>
          ))}
          {tab === 'cert' && (cert ? (
            <div className="space-y-3"><p>Your certificate <strong>{cert.certId}</strong> was issued on {dateTime(cert.issuedAt)}.</p>
              <div className="flex flex-wrap gap-2"><button className="btn-primary" onClick={() => downloadCertificate(cert.certId).catch((e) => dispatch(toast(e.message, 'error')))}>Download PDF</button><Link className="btn-ghost" to={`/verify/${cert.certId}`}>Public verification page</Link></div></div>
          ) : (
            <div className="space-y-3">
              <p className="max-w-prose">Finish every lesson and pass every quiz to earn your certificate. Progress so far: {progress.progress.percent}% of lessons, {progress.status.quizzes.filter((q) => q.passed).length} of {progress.status.quizzes.length} quizzes passed.</p>
              <button className="btn-primary" disabled={!progress.status.eligible} onClick={getCertificate}>Get my certificate</button>
            </div>
          ))}
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="panel p-4">
          {canTrack && (<div className="mb-4"><div className="mb-1 flex justify-between text-sm"><span className="font-semibold">Your progress</span><span>{progress.progress.percent}%</span></div><ProgressBar value={progress.progress.percent} /></div>)}
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {Object.entries(sections).map(([name, ls]) => (
              <section key={name}>
                <h2 className="mb-1 font-body text-xs font-semibold text-ink-mute">{name}</h2>
                <ul>{ls.map((l) => (
                  <li key={l.id}>
                    <button disabled={l.locked} onClick={() => setSp({ lesson: l.id })} className={`flex w-full items-center gap-3 rounded-field px-2 py-2 text-left text-sm ${l.id === lessonId ? 'bg-chalk-soft font-semibold' : 'hover:bg-paper'} disabled:opacity-50`}>
                      <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border text-[10px] ${done.has(l.id) ? 'border-ok bg-ok text-white' : 'border-line'}`}>{done.has(l.id) ? '✓' : ''}</span>
                      <span className="flex-1">{l.title}</span>
                      <span className="text-xs text-ink-mute">{l.locked ? 'Locked' : duration(l.durationSec)}</span>
                    </button>
                  </li>))}</ul>
              </section>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
