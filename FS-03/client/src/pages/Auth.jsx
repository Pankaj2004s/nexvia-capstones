import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { login, register, clearError } from '../app/slices';
import { Field, ErrorNote } from '../components/ui.jsx';

function Shell({ title, sub, children }) {
  return (
    <div className="mx-auto max-w-md px-4 py-14">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="mt-2 text-ink-mute">{sub}</p>
      <div className="panel mt-6 p-6">{children}</div>
    </div>
  );
}

function useAuthForm() {
  const { user, status, error } = useSelector((s) => s.auth);
  const dispatch = useDispatch();
  const location = useLocation();
  useEffect(() => { dispatch(clearError()); }, [dispatch]);
  return { user, status, error, dispatch, redirect: (location.state && location.state.from) || '/dashboard' };
}

export function Login() {
  const { user, status, error, dispatch, redirect } = useAuthForm();
  const [f, setF] = useState({ email: '', password: '' });
  if (user) return <Navigate to={redirect} replace />;
  return (
    <Shell title="Welcome back" sub="Log in to continue your courses.">
      <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); dispatch(login(f)); }}>
        <Field id="email" label="Email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field id="password" label="Password" type="password" autoComplete="current-password" required value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <ErrorNote>{error}</ErrorNote>
        <button className="btn-primary w-full" disabled={status === 'loading'}>{status === 'loading' ? 'Logging in…' : 'Log in'}</button>
        <p className="text-sm text-ink-mute">New here? <Link className="font-semibold text-board underline" to="/register">Create an account</Link></p>
      </form>
    </Shell>
  );
}

export function Register() {
  const { user, status, error, dispatch, redirect } = useAuthForm();
  const navigate = useNavigate();
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'student' });
  if (user) return <Navigate to={redirect} replace />;
  return (
    <Shell title="Create your account" sub="Learn from instructors, or teach your own course.">
      <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); const r = await dispatch(register(f)); if (register.fulfilled.match(r)) navigate(f.role === 'instructor' ? '/instructor' : '/dashboard'); }}>
        <Field id="name" label="Full name" autoComplete="name" required minLength={2} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <Field id="email" label="Email" type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <Field id="password" label="Password (8+ characters)" type="password" autoComplete="new-password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <fieldset>
          <legend className="label">I want to</legend>
          <div className="grid grid-cols-2 gap-2">
            {[['student', 'Learn'], ['instructor', 'Teach']].map(([v, l]) => (
              <label key={v} className={`cursor-pointer rounded-field border px-3 py-2.5 text-center text-sm font-semibold ${f.role === v ? 'border-board bg-board text-white' : 'border-line bg-white'}`}>
                <input type="radio" name="role" value={v} checked={f.role === v} onChange={() => setF({ ...f, role: v })} className="sr-only" />{l}
              </label>
            ))}
          </div>
        </fieldset>
        <ErrorNote>{error}</ErrorNote>
        <button className="btn-primary w-full" disabled={status === 'loading'}>{status === 'loading' ? 'Creating…' : 'Create account'}</button>
        <p className="text-sm text-ink-mute">Already registered? <Link className="font-semibold text-board underline" to="/login">Log in</Link></p>
      </form>
    </Shell>
  );
}
