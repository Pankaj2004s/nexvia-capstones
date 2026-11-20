import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { api } from '../lib/api';
import { toast } from '../app/slices';
import { Spinner, ProgressBar, Field } from '../components/ui.jsx';
import { dateTime, duration } from '../lib/format';

// One lesson row: shows video status and lets the instructor upload a video (then polls the BullMQ job progress)
function LessonRow({ lesson, onChange }) {
  const dispatch = useDispatch();
  const [upload, setUpload] = useState(null); // { stage, pct, videoId, message }

  const poll = useCallback((videoId) => {
    const tick = async () => {
      try {
        const { video } = await api.get(`/videos/${videoId}`);
        if (video.status === 'ready') { setUpload({ stage: 'ready', pct: 100, message: `Ready (${duration(video.durationSec) || '<1m'}, processed in ${Math.round(video.processingMs / 100) / 10}s)` }); onChange(); return; }
        if (video.status === 'failed') { setUpload({ stage: 'failed', pct: 0, message: video.error || 'Processing failed' }); return; }
        setUpload({ stage: 'processing', pct: video.progress, videoId, message: video.status === 'queued' ? 'Waiting in queue…' : `Converting to streaming format… ${video.progress}%` });
        setTimeout(tick, 2000);
      } catch (e) { setUpload({ stage: 'failed', pct: 0, message: e.message }); }
    };
    tick();
  }, [onChange]);

  const pick = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUpload({ stage: 'uploading', pct: 0, message: 'Uploading…' });
    try {
      const d = await api.upload(`/lessons/${lesson._id || lesson.id}/video`, file, (pct) => setUpload({ stage: 'uploading', pct, message: `Uploading… ${pct}%` }));
      poll(d.video.id);
    } catch (err) { setUpload({ stage: 'failed', pct: 0, message: err.message }); dispatch(toast(err.message, 'error')); }
    e.target.value = '';
  };

  const hasVideo = lesson.durationSec > 0;
  return (
    <li className="space-y-2 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1"><p className="font-semibold">{lesson.title}</p><p className="text-xs text-ink-mute">{lesson.section}{lesson.isPreview ? ', free preview' : ''}{hasVideo ? `, video ${duration(lesson.durationSec)}` : lesson.type === 'video' ? ', no video yet' : ', text lesson'}</p></div>
        {lesson.type === 'video' && <label className="btn-ghost cursor-pointer">{hasVideo ? 'Replace video' : 'Upload video'}<input type="file" accept="video/*" className="sr-only" onChange={pick} disabled={upload && ['uploading', 'processing'].includes(upload.stage)} /></label>}
      </div>
      {upload && (
        <div role="status"><ProgressBar value={upload.pct} /><p className={`mt-1 text-xs ${upload.stage === 'failed' ? 'text-coral' : 'text-ink-mute'}`}>{upload.message}</p></div>
      )}
    </li>
  );
}

const emptyQ = () => ({ text: '', type: 'single', points: 1, options: [{ text: '', isCorrect: true }, { text: '', isCorrect: false }] });

export default function CourseEditor() {
  const { courseId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [live, setLive] = useState([]);
  const [lessonForm, setLessonForm] = useState({ title: '', section: 'Basics', type: 'video', isPreview: false });
  const [quizForm, setQuizForm] = useState(null);
  const [liveForm, setLiveForm] = useState({ title: '', scheduledAt: '', durationMin: 60 });

  const load = useCallback(async () => {
    try {
      const d = await api.get(`/courses/${courseId}`);
      const lessons = await Promise.all(d.course.lessons.map(async (l) => l)); // outline includes durations
      setCourse({ ...d.course, lessons });
      api.get(`/courses/${courseId}/quizzes`).then((x) => setQuizzes(x.quizzes)).catch(() => {});
      api.get(`/courses/${courseId}/live-classes`).then((x) => setLive(x.liveClasses)).catch(() => {});
    } catch (e) { dispatch(toast(e.message, 'error')); navigate('/instructor'); }
  }, [courseId, dispatch, navigate]);
  useEffect(() => { load(); }, [load]);

  const run = (fn, ok) => async (...a) => { try { await fn(...a); if (ok) dispatch(toast(ok, 'success')); await load(); } catch (e) { dispatch(toast(e.details ? e.details.join(', ') : e.message, 'error')); } };

  if (!course) return <Spinner />;

  const addLesson = run(async (e) => { e.preventDefault(); await api.post(`/courses/${courseId}/lessons`, lessonForm); setLessonForm({ ...lessonForm, title: '' }); }, 'Lesson added');
  const delLesson = (id) => run(() => api.del(`/lessons/${id}`), 'Lesson deleted')();
  const submit = run(() => api.post(`/courses/${courseId}/submit`), 'Submitted for review. An admin will approve it.');
  const saveQuiz = run(async () => { await api.post(`/courses/${courseId}/quizzes`, { title: quizForm.title, passingPercent: Number(quizForm.passingPercent), questions: quizForm.questions.map((q) => ({ ...q, points: Number(q.points) })) }); setQuizForm(null); }, 'Quiz saved');
  const delQuiz = (id) => run(() => api.del(`/quizzes/${id}`), 'Quiz deleted')();
  const schedule = run(async (e) => { e.preventDefault(); await api.post(`/courses/${courseId}/live-classes`, { title: liveForm.title, scheduledAt: new Date(liveForm.scheduledAt).toISOString(), durationMin: Number(liveForm.durationMin) }); setLiveForm({ title: '', scheduledAt: '', durationMin: 60 }); }, 'Live class scheduled');
  const startClass = (id) => run(() => api.post(`/live-classes/${id}/start`), 'You’re live. Join the room.')();

  const setQ = (qi, patch) => setQuizForm((f) => ({ ...f, questions: f.questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) }));
  const setOpt = (qi, oi, patch) => setQuizForm((f) => ({ ...f, questions: f.questions.map((q, i) => (i !== qi ? q : { ...q, options: q.options.map((o, j) => (j === oi ? { ...o, ...patch } : q.type !== 'multi' && patch.isCorrect ? { ...o, isCorrect: false } : o)) })) }));
  const changeType = (qi, type) => setQ(qi, { type, options: type === 'truefalse' ? [{ text: 'True', isCorrect: true }, { text: 'False', isCorrect: false }] : quizForm.questions[qi].options });

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <div>
        <Link to="/instructor" className="text-sm text-ink-mute hover:underline">← Teaching</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div><h1 className="text-3xl font-extrabold">{course.title}</h1><p className="mt-1 text-sm text-ink-mute">Status: <strong>{course.status}</strong>. {course.lessonCount} lessons, {course.enrolledCount} students.</p></div>
          {['draft', 'rejected'].includes(course.status) && <button className="btn-primary" onClick={submit}>Submit for review</button>}
        </div>
        {course.status === 'rejected' && <p className="mt-3 rounded-field bg-coral/10 px-3 py-2 text-sm text-coral">An admin rejected this course. Update it and submit again.</p>}
        {course.status === 'pending' && <p className="mt-3 rounded-field bg-chalk-soft px-3 py-2 text-sm">Waiting for admin approval. Students can’t see it yet.</p>}
      </div>

      <section>
        <h2 className="text-xl font-bold">Lessons</h2>
        <ul className="panel mt-3 divide-y divide-line">
          {course.lessons.length === 0 && <li className="p-4 text-sm text-ink-mute">No lessons yet. Add the first one below.</li>}
          {course.lessons.map((l) => (
            <div key={l.id} className="relative"><LessonRow lesson={{ ...l, _id: l.id }} onChange={load} /><button className="absolute right-4 top-4 hidden text-xs text-coral underline md:block" style={{ right: '9.5rem' }} onClick={() => delLesson(l.id)}>Delete</button></div>
          ))}
        </ul>
        <form onSubmit={addLesson} className="panel mt-3 grid gap-3 p-4 sm:grid-cols-[1fr_160px_130px_auto] sm:items-end">
          <Field id="lt" label="Lesson title" required minLength={2} value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} />
          <Field id="ls" label="Section" required value={lessonForm.section} onChange={(e) => setLessonForm({ ...lessonForm, section: e.target.value })} />
          <div><label htmlFor="ltype" className="label">Type</label><select id="ltype" className="field" value={lessonForm.type} onChange={(e) => setLessonForm({ ...lessonForm, type: e.target.value })}><option value="video">Video</option><option value="text">Text</option></select></div>
          <button className="btn-primary">Add lesson</button>
          <label className="flex items-center gap-2 text-sm sm:col-span-4"><input type="checkbox" checked={lessonForm.isPreview} onChange={(e) => setLessonForm({ ...lessonForm, isPreview: e.target.checked })} /> Free preview (anyone can watch this lesson)</label>
        </form>
      </section>

      <section>
        <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Quizzes</h2>{!quizForm && <button className="btn-ghost" onClick={() => setQuizForm({ title: '', passingPercent: 60, questions: [emptyQ()] })}>New quiz</button>}</div>
        <ul className="panel mt-3 divide-y divide-line">
          {quizzes.length === 0 && <li className="p-4 text-sm text-ink-mute">No quizzes yet. A course certificate requires passing all its quizzes.</li>}
          {quizzes.map((q) => <li key={q.id} className="flex items-center justify-between p-4 text-sm"><span>{q.title} <span className="text-ink-mute">({q.questions.length} questions)</span></span><button className="text-coral underline" onClick={() => delQuiz(q.id)}>Delete</button></li>)}
        </ul>
        {quizForm && (
          <div className="panel mt-3 space-y-4 p-5">
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]"><Field id="qt" label="Quiz title" value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} /><Field id="qp" label="Passing %" type="number" min={1} max={100} value={quizForm.passingPercent} onChange={(e) => setQuizForm({ ...quizForm, passingPercent: e.target.value })} /></div>
            {quizForm.questions.map((q, qi) => (
              <fieldset key={qi} className="space-y-2 rounded-field border border-line p-3">
                <legend className="px-1 text-sm font-semibold">Question {qi + 1}</legend>
                <input className="field" placeholder="Question text" aria-label={`Question ${qi + 1} text`} value={q.text} onChange={(e) => setQ(qi, { text: e.target.value })} />
                <div className="flex flex-wrap gap-3">
                  <select className="field w-auto" aria-label="Question type" value={q.type} onChange={(e) => changeType(qi, e.target.value)}><option value="single">One correct answer</option><option value="multi">Multiple correct answers</option><option value="truefalse">True / false</option></select>
                  <input className="field w-24" type="number" min={1} aria-label="Points" value={q.points} onChange={(e) => setQ(qi, { points: e.target.value })} />
                </div>
                {q.options.map((o, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <input type={q.type === 'multi' ? 'checkbox' : 'radio'} name={`c${qi}`} checked={o.isCorrect} onChange={(e) => setOpt(qi, oi, { isCorrect: q.type === 'multi' ? e.target.checked : true })} aria-label="Mark as correct" />
                    <input className="field" placeholder={`Option ${oi + 1}`} aria-label={`Option ${oi + 1}`} disabled={q.type === 'truefalse'} value={o.text} onChange={(e) => setOpt(qi, oi, { text: e.target.value })} />
                  </div>
                ))}
                {q.type !== 'truefalse' && q.options.length < 6 && <button type="button" className="text-sm font-semibold text-board underline" onClick={() => setQ(qi, { options: [...q.options, { text: '', isCorrect: false }] })}>Add option</button>}
              </fieldset>
            ))}
            <div className="flex gap-2"><button className="btn-ghost" onClick={() => setQuizForm({ ...quizForm, questions: [...quizForm.questions, emptyQ()] })}>Add question</button><button className="btn-primary" onClick={saveQuiz}>Save quiz</button><button className="btn-ghost" onClick={() => setQuizForm(null)}>Cancel</button></div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold">Live classes</h2>
        <ul className="panel mt-3 divide-y divide-line">
          {live.length === 0 && <li className="p-4 text-sm text-ink-mute">No live classes scheduled.</li>}
          {live.map((c) => (
            <li key={c._id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <span><strong>{c.title}</strong><br /><span className="text-ink-mute">{dateTime(c.scheduledAt)}, {c.durationMin} min</span></span>
              <span className="flex items-center gap-2"><span className="tag">{c.status}</span>
                {c.status === 'scheduled' && <button className="btn-chalk" onClick={() => startClass(c._id)}>Go live</button>}
                {c.status === 'live' && <Link className="btn-chalk" to={`/live/${c._id}`}>Open room</Link>}</span>
            </li>
          ))}
        </ul>
        <form onSubmit={schedule} className="panel mt-3 grid gap-3 p-4 sm:grid-cols-[1fr_210px_110px_auto] sm:items-end">
          <Field id="lc-t" label="Class title" required minLength={3} value={liveForm.title} onChange={(e) => setLiveForm({ ...liveForm, title: e.target.value })} />
          <Field id="lc-d" label="Starts at" type="datetime-local" required value={liveForm.scheduledAt} onChange={(e) => setLiveForm({ ...liveForm, scheduledAt: e.target.value })} />
          <Field id="lc-m" label="Minutes" type="number" min={5} max={480} value={liveForm.durationMin} onChange={(e) => setLiveForm({ ...liveForm, durationMin: e.target.value })} />
          <button className="btn-primary">Schedule</button>
        </form>
      </section>
    </div>
  );
}
