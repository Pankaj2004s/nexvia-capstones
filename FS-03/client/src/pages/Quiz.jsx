import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { api } from '../lib/api';
import { toast } from '../app/slices';
import { Spinner, ErrorNote } from '../components/ui.jsx';
import { dateTime } from '../lib/format';

export default function Quiz() {
  const { quizId } = useParams();
  const dispatch = useDispatch();
  const [quiz, setQuiz] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/quizzes/${quizId}`).then((d) => setQuiz(d.quiz)).catch((e) => setError(e.message));
    api.get(`/quizzes/${quizId}/attempts`).then((d) => setAttempts(d.attempts)).catch(() => {});
  }, [quizId]);

  if (error) return <div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="text-2xl font-bold">{error}</h1></div>;
  if (!quiz) return <Spinner />;

  const pick = (q, i) => setAnswers((a) => {
    const cur = a[q.id] || [];
    if (q.type === 'multi') return { ...a, [q.id]: cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i] };
    return { ...a, [q.id]: [i] };
  });

  const submit = async () => {
    setBusy(true);
    try {
      const d = await api.post(`/quizzes/${quizId}/attempts`, { answers: quiz.questions.map((q) => ({ question: q.id, selected: answers[q.id] || [] })) });
      setResult(d.result);
      api.get(`/quizzes/${quizId}/attempts`).then((x) => setAttempts(x.attempts));
      dispatch(toast(d.result.passed ? 'You passed!' : 'Not passed yet. You can retry.', d.result.passed ? 'success' : 'info'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { dispatch(toast(e.message, 'error')); } finally { setBusy(false); }
  };

  const review = (q) => result && result.review.find((r) => r.question === q.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <Link to={`/learn/${quiz.course}`} className="text-sm text-ink-mute hover:underline">← Back to course</Link>
      <h1 className="mt-2 text-3xl font-extrabold">{quiz.title}</h1>
      <p className="mt-1 text-ink-mute">{quiz.questions.length} questions. You need {quiz.passingPercent}% to pass.</p>

      {result && (
        <div role="status" className={`mt-6 rounded-panel border p-5 ${result.passed ? 'border-ok bg-ok/10' : 'border-coral/50 bg-coral/10'}`}>
          <p className="font-display text-2xl font-bold">{result.passed ? 'Passed' : 'Not passed yet'}: {result.percent}%</p>
          <p className="text-sm">You scored {result.score} of {result.maxScore} points.</p>
        </div>
      )}

      <ol className="mt-6 space-y-5">
        {quiz.questions.map((q, qi) => {
          const r = review(q);
          return (
            <li key={q.id} className="panel p-5">
              <fieldset disabled={Boolean(result) || busy}>
                <legend className="font-display text-lg font-semibold">{qi + 1}. {q.text} <span className="text-xs font-normal text-ink-mute">({q.points} pt{q.points > 1 ? 's' : ''}{q.type === 'multi' ? ', select all that apply' : ''})</span></legend>
                <div className="mt-3 space-y-2">
                  {q.options.map((o, i) => {
                    const checked = (answers[q.id] || []).includes(i);
                    const isCorrect = r && r.correctOptions.includes(i);
                    return (
                      <label key={i} className={`flex cursor-pointer items-center gap-3 rounded-field border px-3 py-2.5 text-sm ${checked ? 'border-board bg-chalk-soft' : 'border-line'} ${isCorrect ? 'ring-2 ring-ok' : ''}`}>
                        <input type={q.type === 'multi' ? 'checkbox' : 'radio'} name={q.id} checked={checked} onChange={() => pick(q, i)} />
                        <span className="flex-1">{o.text}</span>
                        {isCorrect && <span className="text-xs font-semibold text-ok">Correct answer</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              {r && <p className={`mt-3 text-sm font-semibold ${r.correct ? 'text-ok' : 'text-coral'}`}>{r.correct ? 'Correct' : 'Incorrect'}</p>}
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex gap-3">
        {!result ? <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? 'Grading…' : 'Submit answers'}</button>
          : <button className="btn-ghost" onClick={() => { setResult(null); setAnswers({}); }}>Try again</button>}
        <Link to={`/learn/${quiz.course}`} className="btn-ghost">Back to lessons</Link>
      </div>
      <ErrorNote>{error}</ErrorNote>

      {attempts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">Your attempts</h2>
          <ul className="panel mt-2 divide-y divide-line text-sm">
            {attempts.map((a) => <li key={a._id} className="flex justify-between px-4 py-2.5"><span>{dateTime(a.createdAt)}</span><span className={a.passed ? 'font-semibold text-ok' : 'text-ink-mute'}>{a.percent}% {a.passed ? '(passed)' : ''}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}
