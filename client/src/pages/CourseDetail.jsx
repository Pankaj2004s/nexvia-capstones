import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { api } from '../lib/api';
import { toast } from '../app/slices';
import { inr, duration, groupBy } from '../lib/format';
import { Spinner, ErrorNote } from '../components/ui.jsx';
import { Thumb } from '../components/CourseRow.jsx';

function loadRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Razorpay checkout. Check your connection.'));
    document.body.appendChild(s);
    return undefined;
  });
}

export default function CourseDetail() {
  const { slug } = useParams();
  const user = useSelector((s) => s.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.get(`/courses/${slug}`).then((d) => setCourse(d.course)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, [slug, user]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return <div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="text-2xl font-bold">{error}</h1><Link to="/" className="btn-primary mt-6">Browse courses</Link></div>;
  if (!course) return <Spinner />;

  const sections = groupBy(course.lessons, 'section');

  const enroll = async () => {
    if (!user) return navigate('/login', { state: { from: `/courses/${slug}` } });
    setBusy(true);
    try {
      if (course.price <= 0) {
        await api.post(`/courses/${course.id}/enroll`);
        dispatch(toast('You’re enrolled. Happy learning!', 'success'));
        return navigate(`/learn/${course.id}`);
      }
      await loadRazorpay();
      const { order } = await api.post(`/courses/${course.id}/payments/order`);
      const rzp = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, name: 'LearnSphere', description: order.courseTitle, order_id: order.orderId,
        prefill: { name: user.name, email: user.email }, theme: { color: '#0E4B45' },
        handler: async (r) => {
          try {
            await api.post('/payments/verify', { orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
            dispatch(toast('Payment successful. You’re enrolled.', 'success'));
            navigate(`/learn/${course.id}`);
          } catch (e) { dispatch(toast(`Payment could not be verified: ${e.message}`, 'error')); }
        },
        modal: { ondismiss: () => setBusy(false) },
      });
      rzp.on('payment.failed', (r) => dispatch(toast(`Payment failed: ${r.error.description}`, 'error')));
      rzp.open();
      return undefined;
    } catch (e) {
      dispatch(toast(e.message, 'error'));
      return undefined;
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_340px]">
      <div>
        <p className="text-sm text-ink-mute">{course.category} · {course.level}</p>
        <h1 className="mt-1 text-3xl font-extrabold md:text-4xl">{course.title}</h1>
        <p className="mt-3 max-w-prose">{course.description}</p>
        <p className="mt-3 text-sm text-ink-mute">Taught by <strong className="text-ink">{course.instructorName}</strong>. {course.enrolledCount} enrolled, {course.lessonCount} lessons{course.totalDurationSec ? `, ${duration(course.totalDurationSec)}` : ''}.</p>

        <h2 className="mt-10 text-xl font-bold">What’s inside</h2>
        <div className="mt-3 space-y-5">
          {Object.entries(sections).map(([name, lessons]) => (
            <section key={name}>
              <h3 className="text-sm font-semibold text-ink-mute">{name}</h3>
              <ul className="panel mt-2 divide-y divide-line">
                {lessons.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span>{l.title}</span>
                    <span className="shrink-0 text-xs text-ink-mute">{l.isPreview && !course.isEnrolled ? <Link className="font-semibold text-board underline" to={`/learn/${course.id}?lesson=${l.id}`}>Free preview</Link> : l.locked ? 'Locked' : duration(l.durationSec) || l.type}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="panel overflow-hidden">
          <Thumb course={course} className="rounded-none" />
          <div className="space-y-4 p-5">
            <p className="font-display text-3xl font-extrabold">{inr(course.price)}</p>
            {course.isEnrolled || course.canManage
              ? <Link to={`/learn/${course.id}`} className="btn-primary w-full">{course.isEnrolled ? 'Continue learning' : 'Open course'}</Link>
              : <button className="btn-primary w-full" disabled={busy} onClick={enroll}>{busy ? 'Please wait…' : course.price > 0 ? `Buy for ${inr(course.price)}` : 'Enroll for free'}</button>}
            {!user && <p className="text-xs text-ink-mute">You’ll be asked to log in first.</p>}
            {course.price > 0 && <p className="text-xs text-ink-mute">Payments run in Razorpay test mode. Use a test card, no real money moves.</p>}
            <ErrorNote>{course.status !== 'published' ? `This course is ${course.status} and not visible to students.` : ''}</ErrorNote>
          </div>
        </div>
      </aside>
    </div>
  );
}
